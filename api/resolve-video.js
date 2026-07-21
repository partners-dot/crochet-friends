/* Background Video Resolution — fal.ai Kling v3 Standard
 *
 * Phase 2 of 2-phase approach. Called by generate-video.js fire-and-forget.
 * 
 * Flow:
 *   1. Calls fal.subscribe with the full input config (60-240s)
 *   2. On success: saves video_url to Supabase, sends email via Resend
 *   3. On failure: saves error to Supabase, auto-retries once
 *
 * IMPORTANT: We do NOT respond to the HTTP request until fal.subscribe completes.
 * If we respond early, Vercel kills the function and the video is lost.
 * 
 * fal.subscribe handles WebSocket-based polling internally (~60-120s typical,
 * max observed 243s). Vercel Pro allows 300s — fits comfortably.
 */
import { fal } from '@fal-ai/client';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FAL_MODEL = 'fal-ai/kling-video/v3/standard/image-to-video';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { operationId, falInput, retryConfig } = req.body;
    if (!operationId || !falInput) {
        return res.status(400).json({ error: 'operationId and falInput required' });
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

    // Configure fal.ai SDK
    fal.config({ credentials: FAL_KEY });

    // DO NOT respond early — Vercel kills the function after response.
    let finalStatus = 'unknown';
    let videoUrl = null;

    try {
        console.log(`[resolve-video] Starting fal.subscribe for: ${operationId}`);

        // Call fal.subscribe with the full input config
        // This submits the job AND waits for completion via WebSocket
        const result = await fal.subscribe(FAL_MODEL, {
            input: falInput,
            logs: false,
        });

        videoUrl = result.data?.video?.url;

        if (videoUrl) {
            // ══════════════════════════════════════════
            // SUCCESS — Save video URL and send email
            // ══════════════════════════════════════════
            console.log(`[resolve-video] ✅ Video ready for: ${operationId}`);
            finalStatus = 'complete';

            if (supabase) {
                const { error: updateError } = await supabase
                    .from('video_sessions')
                    .update({ video_url: videoUrl, status: 'complete' })
                    .eq('operation_id', operationId);

                if (updateError) {
                    console.error('[resolve-video] DB update error:', updateError);
                }
            }

            // Send email notification
            await sendVideoEmail(operationId);

        } else {
            throw new Error('fal.ai completed but no video URL in response');
        }

    } catch (err) {
        // ══════════════════════════════════════════
        // FAILURE — Log error and attempt retry
        // ══════════════════════════════════════════
        console.error('[resolve-video] ❌ Generation failed:', err.message);
        finalStatus = 'failed';

        if (supabase) {
            await supabase
                .from('video_sessions')
                .update({
                    status: 'failed',
                    error_reason: err.message,
                    error_code: 'FAL_FAILED',
                    error_details: { resolved_by: 'server', original_operation: operationId }
                })
                .eq('operation_id', operationId);
        }

        // ── Auto-retry (once) ──
        // retryConfig exists = first attempt → retry once
        // retryConfig is null = this IS the retry → both attempts failed, send failure email
        if (retryConfig) {
            console.log(`[resolve-video] 🔄 Auto-retrying for: ${retryConfig.email}`);
            try {
                const retryUrl = process.env.SITE_URL || 'https://video.gotyoualittlesomething.com';

                const retryRes = await fetch(`${retryUrl}/api/generate-video`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: retryConfig.message,
                        character: retryConfig.character,
                        email: retryConfig.email,
                        userType: retryConfig.userType,
                        sku: retryConfig.sku,
                        isRetry: true // Prevents infinite retry loop (no retryConfig on retry)
                    })
                });

                if (retryRes.ok) {
                    const retryData = await retryRes.json();
                    console.log(`[resolve-video] 🔄 Retry submitted: ${retryData.operationId}`);
                } else {
                    console.error('[resolve-video] Retry HTTP error:', retryRes.status);
                    // Retry call itself failed — send failure email
                    await sendFailureEmail(operationId);
                }
            } catch (retryErr) {
                console.error('[resolve-video] Retry error:', retryErr.message);
                await sendFailureEmail(operationId);
            }
        } else {
            // This IS the retry attempt and it also failed — notify the user
            console.log('[resolve-video] 💀 Both attempts failed — sending failure email');
            await sendFailureEmail(operationId);
        }
    }

    // Respond AFTER all work is done (keeps Vercel runtime alive until completion)
    return res.status(200).json({
        status: finalStatus,
        operationId,
        videoUrl: videoUrl ? 'saved' : null
    });
}

async function sendVideoEmail(operationId) {
    if (!supabase || !resend) return;

    try {
        const { data: session } = await supabase
            .from('video_sessions')
            .select('email, product, user_type, sku, email_sent')
            .eq('operation_id', operationId)
            .single();

        if (!session || !session.email || session.email_sent) return;

        const BASE_URL = 'https://video.gotyoualittlesomething.com';
        const videoPageUrl = `${BASE_URL}/video-preview.html?id=${encodeURIComponent(operationId)}`;

        // Tracked "leave an honest review" link. Routes through /api/review-redirect so the
        // click is logged (Supabase phase=email_redirect, source=video_email) and lands on the
        // CORRECT per-product Amazon listing: sku resolves the full catalog when available, and
        // the character (product) resolves the top products even without that lookup.
        const reviewParams = new URLSearchParams({ email: session.email, source: 'video_email' });
        if (session.sku) reviewParams.set('sku', session.sku);
        if (session.product) reviewParams.set('character', session.product);
        const reviewUrl = `${BASE_URL}/api/review-redirect?${reviewParams.toString()}`;

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
                <tr><td align="center" style="padding: 0 40px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top: 1px solid #eeeeee; padding-top: 24px;" align="center">
                        <p style="margin: 0 0 6px; color: #555555; font-size: 15px; line-height: 1.6;">
                            If it made you smile, would you tell others?
                        </p>
                        <p style="margin: 0 0 16px; color: #888888; font-size: 13px; line-height: 1.6;">
                            An honest review on Amazon helps another gift-giver find a little something too. No pressure at all.
                        </p>
                        <a href="${reviewUrl}" style="display: inline-block; color: #1a1a1a; text-decoration: underline; font-size: 14px; font-weight: 600;">
                            Leave an honest review
                        </a>
                    </td></tr></table>
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
            console.log('[resolve-video] 📧 Email sent to:', session.email);
            await supabase
                .from('video_sessions')
                .update({ email_sent: true })
                .eq('operation_id', operationId);
        }
    } catch (err) {
        console.error('[resolve-video] Email process error:', err);
    }
}

async function sendFailureEmail(operationId) {
    if (!supabase || !resend) return;

    try {
        const { data: session } = await supabase
            .from('video_sessions')
            .select('email, product, user_type, email_sent')
            .eq('operation_id', operationId)
            .single();

        if (!session || !session.email) return;

        const BASE_URL = 'https://video.gotyoualittlesomething.com';
        // Link back to the main page with their product pre-selected
        const retryUrl = `${BASE_URL}/?sku=${encodeURIComponent(session.product || '')}`;

        const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 16px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <tr><td align="center" style="padding: 40px 30px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">😔</div>
                    <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">
                        Oops! Something Went Wrong
                    </h1>
                </td></tr>
                <tr><td align="center" style="padding: 10px 30px 30px;">
                    <p style="margin: 0 0 24px; color: #666666; font-size: 16px; line-height: 1.6;">
                        We weren't able to create your video this time. 
                        Don't worry — this happens rarely and your free video hasn't been used up!
                    </p>
                    <a href="${retryUrl}" style="display: inline-block; background: #ffd166; color: #1a1a1a; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-size: 16px; font-weight: 700;">
                        🔄 Try Again — It's Free!
                    </a>
                    <p style="margin: 20px 0 0; color: #999999; font-size: 13px; line-height: 1.5;">
                        Just click the button above and create your video again.<br>
                        It usually works perfectly on the next try!
                    </p>
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
            subject: '😔 Your Video Needs Another Try',
            html: emailHtml
        });

        if (emailError) {
            console.error('[resolve-video] Failure email error:', emailError);
        } else {
            console.log('[resolve-video] 📧 Failure email sent to:', session.email);
            // Mark email_sent so we don't send duplicates
            await supabase
                .from('video_sessions')
                .update({ email_sent: true })
                .eq('operation_id', operationId);
        }
    } catch (err) {
        console.error('[resolve-video] Failure email process error:', err);
    }
}
