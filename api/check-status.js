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
                            const BASE_URL = 'https://crochet-friends1.vercel.app';
                            const videoPageUrl = `${BASE_URL}/video.html?v=${encodeURIComponent(videoUrl)}`;

                            const characterImages = {
                                potato: `${BASE_URL}/images/potato.jpg`,
                                cupcake: `${BASE_URL}/images/cupcake.jpg`,
                                yoda: `${BASE_URL}/images/yoda.jpg`
                            };
                            const characterImage = characterImages[session.product] || characterImages.potato;
                            const amazonReviewUrl = 'https://www.amazon.com/review/create-review?asin=B0DK1RF3TZ';

                            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a2e;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a2e; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a4e 0%, #0d0d35 100%); border-radius: 24px; overflow: hidden; max-width: 500px;">
                    <tr>
                        <td align="center" style="padding: 40px 30px 20px;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                                🎉 Your Video is Ready!
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 30px;">
                            <img src="${characterImage}" alt="Your Crochet Friend" style="width: 150px; height: 150px; border-radius: 20px; object-fit: cover; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 10px 30px 30px;">
                            <p style="margin: 0; color: #e0e0e0; font-size: 18px; line-height: 1.6;">
                                Your personalized video message is ready!<br>
                                <strong style="color: #ffd166;">Share it with someone special 💝</strong>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 30px 30px;">
                            <a href="${videoPageUrl}" style="display: inline-block; background: linear-gradient(135deg, #ffd166 0%, #f4a942 100%); color: #1a1a4e; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 18px; font-weight: 700; box-shadow: 0 8px 25px rgba(255, 209, 102, 0.4);">
                                👀 Watch & Share Your Video
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 30px;">
                            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 0;">
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 30px;">
                            <p style="margin: 0 0 15px; color: #a0a0a0; font-size: 14px;">
                                ⭐ Love your experience? Help us grow!
                            </p>
                            <a href="${amazonReviewUrl}" style="color: #ffd166; text-decoration: none; font-size: 14px; font-weight: 600;">
                                Leave a Review on Amazon →
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 30px 30px; border-top: 1px solid rgba(255,255,255,0.05);">
                            <p style="margin: 0; color: #666; font-size: 12px;">
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
                                from: 'Got You A Little Something <noreply@resend.dev>',
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
                                    .update({ email_sent: true, video_url: videoUrl, status: 'complete' })
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
