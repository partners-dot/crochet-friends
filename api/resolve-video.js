/* Server-side Video Resolution — Runs independently of frontend polling.
 * 
 * Called by generate-video.js via fire-and-forget fetch after starting Veo.
 * This endpoint handles the entire lifecycle:
 *   1. Polls Veo for operation status
 *   2. Saves completed video URL to Supabase
 *   3. Sends email notification via Resend
 *   4. On failure: retries video generation with same config
 *
 * This guarantees users get their video email even if they close the browser.
 */
import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req, res) {
    // This is a fire-and-forget endpoint — respond immediately
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { operationId, sessionId, retryConfig } = req.body;
    if (!operationId) return res.status(400).json({ error: 'operationId required' });

    // Acknowledge immediately — work happens below
    res.status(200).json({ status: 'resolving', operationId });

    // --- Background work begins ---
    try {
        const googleCredentials = JSON.parse(process.env.GOOGLE_CONFIG_JSON);
        const PROJECT_ID = googleCredentials.project_id;
        const LOCATION = 'us-central1';
        const MODEL_ID = 'veo-3.1-fast-generate-001';

        const auth = new GoogleAuth({
            credentials: googleCredentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;

        // Poll Veo for completion (up to ~4.5 minutes within Vercel's 300s max for Pro)
        const fetchOperationUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`;

        let videoUrl = null;
        let failed = false;
        let failReason = null;
        let failCode = null;
        const maxAttempts = 50; // 50 × 5s = ~4 minutes

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

            try {
                const pollResponse = await fetch(fetchOperationUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ operationName: operationId })
                });

                if (!pollResponse.ok) continue; // Transient error, retry

                const pollData = await pollResponse.json();

                // Check for error states
                if (pollData.error && !pollData.done) {
                    failReason = pollData.error.message || 'Generation failed';
                    failCode = String(pollData.error.code || 'API_ERROR');
                    failed = true;
                    break;
                }

                if (pollData.metadata) {
                    const state = pollData.metadata.state;
                    if (state === 'FAILED' || state === 'CANCELLED' || state === 'BLOCKED') {
                        failReason = pollData.metadata.failureReason || `Video generation ${state.toLowerCase()}`;
                        failCode = state;
                        failed = true;
                        break;
                    }
                }

                if (pollData.done) {
                    if (pollData.error) {
                        failReason = pollData.error.message || 'Generation failed';
                        failCode = String(pollData.error.code || 'GENERATION_ERROR');
                        failed = true;
                        break;
                    }

                    const result = pollData.response;
                    if (result && result.videos && result.videos.length > 0) {
                        if (result.videos[0].bytesBase64Encoded) {
                            videoUrl = 'data:video/mp4;base64,' + result.videos[0].bytesBase64Encoded;
                        } else {
                            videoUrl = result.videos[0].gcsUri || result.videos[0].uri;
                        }
                        break;
                    } else {
                        failReason = 'No video in response';
                        failCode = 'NO_VIDEO_OUTPUT';
                        failed = true;
                        break;
                    }
                }
                // Still processing — continue polling
            } catch (pollErr) {
                console.error('[resolve-video] Poll error:', pollErr.message);
                // Continue polling on transient errors
            }
        }

        if (!videoUrl && !failed) {
            failReason = 'Server-side resolution timed out';
            failCode = 'RESOLVE_TIMEOUT';
            failed = true;
        }

        if (videoUrl && supabase) {
            // === SUCCESS: Save video and send email ===
            console.log('[resolve-video] Video complete for operation:', operationId);

            // Save video URL to DB
            const { error: updateError } = await supabase
                .from('video_sessions')
                .update({ video_url: videoUrl, status: 'complete' })
                .eq('operation_id', operationId);

            if (updateError) {
                console.error('[resolve-video] DB update error:', updateError);
            }

            // Send email
            await sendVideoEmail(operationId);

        } else if (failed && supabase) {
            // === FAILURE: Log error and attempt retry ===
            console.error('[resolve-video] Generation failed:', failCode, failReason);

            await supabase
                .from('video_sessions')
                .update({
                    status: 'failed',
                    error_reason: failReason,
                    error_code: failCode,
                    error_details: { resolved_by: 'server', original_operation: operationId }
                })
                .eq('operation_id', operationId);

            // Auto-retry if we have the config and haven't already retried
            if (retryConfig && !retryConfig.isRetry) {
                console.log('[resolve-video] Auto-retrying for:', retryConfig.email);
                await retryVideoGeneration(retryConfig);
            }
        }

    } catch (err) {
        console.error('[resolve-video] Fatal error:', err);
    }
}

async function sendVideoEmail(operationId) {
    if (!supabase || !resend) return;

    try {
        const { data: session } = await supabase
            .from('video_sessions')
            .select('email, product, user_type, email_sent')
            .eq('operation_id', operationId)
            .single();

        if (!session || !session.email || session.email_sent) return;

        const BASE_URL = 'https://video.gotyoualittlesomething.com';
        const videoPageUrl = `${BASE_URL}/video-preview.html?id=${encodeURIComponent(operationId)}`;

        const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 16px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <tr><td align="center" style="padding: 40px 30px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                    <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">Your Video is Ready!</h1>
                </td></tr>
                <tr><td align="center" style="padding: 10px 30px 30px;">
                    <p style="margin: 0 0 24px; color: #666666; font-size: 16px; line-height: 1.6;">
                        Your personalized video message is ready to share with someone special!
                    </p>
                    <a href="${videoPageUrl}" style="display: inline-block; background: #ffd166; color: #1a1a1a; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-size: 16px; font-weight: 700;">
                        👀 Watch & Share Your Video
                    </a>
                </td></tr>
                <tr><td align="center" style="padding: 20px 30px; background: #fafafa; border-radius: 0 0 16px 16px;">
                    <p style="margin: 0; color: #aaaaaa; font-size: 12px;">
                        © Got You A Little Something<br>Made with 💛 for gift-givers everywhere
                    </p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;

        const { error: emailError } = await resend.emails.send({
            from: 'Got You A Little Something <info@gotyoualittlesomething.com>',
            to: session.email,
            subject: '🎉 Your Video is Ready to Share!',
            html: emailHtml
        });

        if (emailError) {
            console.error('[resolve-video] Email error:', emailError);
        } else {
            console.log('[resolve-video] Email sent to:', session.email);
            await supabase
                .from('video_sessions')
                .update({ email_sent: true })
                .eq('operation_id', operationId);
        }
    } catch (err) {
        console.error('[resolve-video] Email process error:', err);
    }
}

async function retryVideoGeneration(config) {
    try {
        const BASE_URL = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://video.gotyoualittlesomething.com';

        // Call generate-video to create a new attempt
        const retryRes = await fetch(`${BASE_URL}/api/generate-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: config.message,
                character: config.character,
                email: config.email,
                userType: config.userType,
                sku: config.sku,
                isRetry: true // Flag to prevent infinite retry loops
            })
        });

        if (retryRes.ok) {
            console.log('[resolve-video] Retry started for:', config.email);
        } else {
            console.error('[resolve-video] Retry failed:', await retryRes.text());
        }
    } catch (err) {
        console.error('[resolve-video] Retry error:', err);
    }
}
