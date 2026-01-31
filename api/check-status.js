/* Check Video Generation Status - Polls Veo API for operation status */
import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { operationId } = req.query;
        if (!operationId) return res.status(400).json({ error: 'operationId required' });

        // Parse Google Credentials from env var
        const googleCredentials = JSON.parse(process.env.GOOGLE_CONFIG_JSON);
        const PROJECT_ID = googleCredentials.project_id;
        const LOCATION = 'us-central1';
        const MODEL_ID = 'veo-3.1-fast-generate-preview';

        // Authenticate and get Access Token
        const auth = new GoogleAuth({
            credentials: googleCredentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;

        // Poll the operation status
        const fetchOperationUrl = 'https://' + LOCATION + '-aiplatform.googleapis.com/v1/projects/' + PROJECT_ID + '/locations/' + LOCATION + '/publishers/google/models/' + MODEL_ID + ':fetchPredictOperation';

        const pollResponse = await fetch(fetchOperationUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ operationName: operationId })
        });

        if (!pollResponse.ok) {
            const errorText = await pollResponse.text();
            console.error('Polling error:', errorText);
            throw new Error('Poll API Error: ' + pollResponse.status + ' - ' + errorText);
        }

        const pollData = await pollResponse.json();

        // Log the full response for debugging
        console.log('Poll response for operation:', operationId);
        console.log('Poll data:', JSON.stringify(pollData, null, 2));

        // Check for error state before done check
        if (pollData.error && !pollData.done) {
            console.error('Poll returned error:', JSON.stringify(pollData.error, null, 2));
            return res.status(200).json({
                status: 'error',
                error: pollData.error.message || pollData.error.code || 'Generation failed',
                details: pollData.error
            });
        }

        // Check for failed/cancelled state in metadata
        if (pollData.metadata) {
            const state = pollData.metadata.state;
            if (state === 'FAILED' || state === 'CANCELLED' || state === 'BLOCKED') {
                console.error('Generation state:', state, JSON.stringify(pollData.metadata, null, 2));
                return res.status(200).json({
                    status: 'error',
                    error: pollData.metadata.failureReason || 'Video generation ' + state.toLowerCase()
                });
            }
        }

        if (pollData.done) {
            if (pollData.error) {
                console.error('Generation completed with error:', JSON.stringify(pollData.error, null, 2));
                return res.status(200).json({
                    status: 'error',
                    error: pollData.error.message || pollData.error.code || 'Generation failed',
                    details: pollData.error
                });
            }

            // Success - extract video URL
            const result = pollData.response;
            if (result && result.videos && result.videos.length > 0) {
                let videoUrl;

                // If it's base64 encoded video data
                if (result.videos[0].bytesBase64Encoded) {
                    const videoData = result.videos[0].bytesBase64Encoded;
                    videoUrl = 'data:video/mp4;base64,' + videoData;
                    console.log('Video generation successful (base64)');
                } else {
                    videoUrl = result.videos[0].gcsUri || result.videos[0].uri;
                    console.log('Video generation successful, URL:', videoUrl);
                }

                // Save video URL to Supabase immediately
                console.log('[DEBUG] About to save video, supabase exists:', !!supabase);
                if (supabase) {
                    console.log('[DEBUG] Saving video URL, length:', videoUrl ? videoUrl.length : 0);
                    const { error: updateError } = await supabase
                        .from('video_sessions')
                        .update({ video_url: videoUrl, status: 'complete' })
                        .eq('operation_id', operationId);

                    if (updateError) {
                        console.error('Failed to save video URL:', updateError);
                    } else {
                        console.log('Video URL saved to database successfully');
                    }
                }

                // Send email if Supabase and Resend are configured
                if (supabase && resend) {
                    try {
                        // Look up the session to get email and product
                        const { data: session } = await supabase
                            .from('video_sessions')
                            .select('email, product, user_type, email_sent')
                            .eq('operation_id', operationId)
                            .single();

                        if (session && session.email && !session.email_sent) {
                            const BASE_URL = 'https://video.gotyoualittlesomething.com';
                            // Use operation ID to keep email small - video.html will fetch from DB
                            const videoPageUrl = `${BASE_URL}/video.html?id=${encodeURIComponent(operationId)}`;

                            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 16px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <tr>
                        <td align="center" style="padding: 40px 30px 20px;">
                            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                            <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">
                                Your Video is Ready!
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 10px 30px 30px;">
                            <p style="margin: 0 0 24px; color: #666666; font-size: 16px; line-height: 1.6;">
                                Your personalized video message is ready to share with someone special!
                            </p>
                            <a href="${videoPageUrl}" style="display: inline-block; background: #ffd166; color: #1a1a1a; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-size: 16px; font-weight: 700;">
                                👀 Watch & Share Your Video
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 30px; background: #fafafa; border-radius: 0 0 16px 16px;">
                            <p style="margin: 0; color: #aaaaaa; font-size: 12px;">
                                © Got You A Little Something<br>
                                Made with 💛 for gift-givers everywhere
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
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
                                console.error('Email send error:', emailError);
                            } else {
                                console.log('Email sent successfully to:', session.email);
                                // Mark email as sent
                                await supabase
                                    .from('video_sessions')
                                    .update({ email_sent: true })
                                    .eq('operation_id', operationId);
                            }
                        }
                    } catch (emailErr) {
                        console.error('Email process error:', emailErr);
                    }
                }

                return res.status(200).json({
                    status: 'done',
                    videoUrl: videoUrl
                });
            } else {
                console.error('No video in response:', JSON.stringify(result, null, 2));
                return res.status(200).json({
                    status: 'error',
                    error: 'No video in response'
                });
            }
        }

        // Still processing
        console.log('Still processing...');
        return res.status(200).json({ status: 'pending' });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}
