/* Video Generation — Kling v3 Standard via fal.ai
 *
 * Railway version: No timeout limits. Simplified architecture:
 *   1. Save pending session to Supabase
 *   2. Return operationId to frontend immediately
 *   3. Run fal.subscribe in background promise (no timeout concern)
 *   4. On complete: save video URL, send success email
 *   5. On failure: auto-retry once, then send failure email
 *
 * No fire-and-forget HTTP calls needed — background promises stay alive
 * because Railway runs a persistent Node.js process.
 */
import { fal } from '@fal-ai/client';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FAL_MODEL = 'fal-ai/kling-video/v3/standard/image-to-video';

// Character configuration — images served from same domain
const BASE_URL = process.env.SITE_URL || 'https://crochet-friends1.vercel.app';
const characterConfig = {
    potato:      { buyerImage: `${BASE_URL}/images/potato-buyer.jpg`,      receiverImage: `${BASE_URL}/images/potato-receiver.jpg`,      description: 'crocheted potato doll' },
    cupcake:     { buyerImage: `${BASE_URL}/images/cupcake-buyer.jpg`,     receiverImage: `${BASE_URL}/images/cupcake-receiver.jpg`,     description: 'crocheted cupcake doll with pink frosting and a cherry on top' },
    nursePotato: { buyerImage: `${BASE_URL}/images/nursePotato-buyer.jpg`, receiverImage: `${BASE_URL}/images/nursePotato-receiver.jpg`, description: 'crocheted nurse potato doll with a nurse cap' },
    bossLady:    { buyerImage: `${BASE_URL}/images/bossLady-buyer.jpg`,    receiverImage: `${BASE_URL}/images/bossLady-receiver.jpg`,    description: 'crocheted boss lady potato doll with glasses and briefcase' },
    cat:         { buyerImage: `${BASE_URL}/images/cat-buyer.jpg`,         receiverImage: `${BASE_URL}/images/cat-receiver.jpg`,         description: 'crocheted cat doll' },
    dadJokes:    { buyerImage: `${BASE_URL}/images/dadJokes-buyer.jpg`,    receiverImage: `${BASE_URL}/images/dadJokes-receiver.jpg`,    description: 'crocheted dad jokes potato doll' },
    dog:         { buyerImage: `${BASE_URL}/images/dog-buyer.jpg`,         receiverImage: `${BASE_URL}/images/dog-receiver.jpg`,         description: 'crocheted dog doll' },
    pup:         { buyerImage: `${BASE_URL}/images/pup-buyer.jpg`,         receiverImage: `${BASE_URL}/images/pup-receiver.jpg`,         description: 'crocheted puppy doll' },
    yoda:        { buyerImage: `${BASE_URL}/images/yoda-buyer.jpg`,        receiverImage: `${BASE_URL}/images/yoda-receiver.jpg`,        description: 'crocheted green alien doll with big pointy ears' },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, character, email, userType, sku, isRetry } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });
        if (!process.env.FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

        // Configure fal.ai
        fal.config({ credentials: process.env.FAL_KEY });

        const selectedCharacter = character || 'potato';
        const selectedUserType = userType || 'buyer';
        const charConfig = characterConfig[selectedCharacter] || characterConfig.potato;
        const imageUrl = selectedUserType === 'receiver' ? charConfig.receiverImage : charConfig.buyerImage;

        const prompt = `A cute ${charConfig.description} saying: "${message}". The character should be animated with mouth movements matching the speech. Notice to generate the product to look the same as in the reference image. Add some cute hand movements of the product, only one hand should move, the other hand should keep holding the sign. Ensure the product looks the same as in the reference image. Cinematic lighting, photorealistic texture of yarn.`;

        console.log(`[generate-video] Character: ${selectedCharacter}, email: ${email}`);

        // Duplicate prevention
        if (supabase && email) {
            const { data: recentPending } = await supabase
                .from('video_sessions')
                .select('id, created_at')
                .eq('email', email.toLowerCase())
                .eq('status', 'pending')
                .gte('created_at', new Date(Date.now() - 10000).toISOString())
                .limit(1);

            if (recentPending && recentPending.length > 0) {
                console.log('[generate-video] Duplicate detected for:', email);
                return res.status(200).json({ operationId: 'duplicate', status: 'skipped' });
            }
        }

        // Generate unique operationId
        const operationId = `fal:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Save pending session to Supabase
        if (supabase && email) {
            await supabase.from('video_sessions').insert([{
                email: email.toLowerCase(),
                product: selectedCharacter,
                user_type: userType || null,
                message,
                operation_id: operationId,
                status: 'pending',
                sku: sku || null
            }]);

            // Increment videos_created (skip for retries)
            if (!isRetry) {
                const { data: user } = await supabase
                    .from('users')
                    .select('videos_created')
                    .eq('email', email.toLowerCase())
                    .single();

                if (user) {
                    await supabase
                        .from('users')
                        .update({
                            videos_created: (user.videos_created || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('email', email.toLowerCase());
                }
            }
        }

        // ── Return immediately to frontend ──
        res.status(200).json({ operationId, status: 'pending' });

        // ── Background: generate video (Railway keeps this alive — no timeout!) ──
        const falInput = {
            prompt,
            start_image_url: imageUrl,
            duration: '5',
            generate_audio: true,
            negative_prompt: 'blur, distort, and low quality',
            cfg_scale: 0.5,
        };

        processVideoGeneration(operationId, falInput, {
            message, character: selectedCharacter, email, userType, sku
        }, isRetry).catch(err => {
            console.error('[generate-video] Background process fatal error:', err);
        });

    } catch (error) {
        console.error('[generate-video] Error:', error);

        if (supabase && req.body.email) {
            try {
                await supabase.from('video_sessions').insert([{
                    email: req.body.email.toLowerCase(),
                    product: req.body.character || 'potato',
                    user_type: req.body.userType || null,
                    message: req.body.message,
                    operation_id: `fal:error-${Date.now()}`,
                    status: 'failed',
                    sku: req.body.sku || null
                }]);
            } catch (dbErr) {}
        }

        // Only send error if response hasn't been sent yet
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error', details: error.message });
        }
    }
}

// ══════════════════════════════════════════════════════════
// Background video processing — runs after response is sent
// ══════════════════════════════════════════════════════════
async function processVideoGeneration(operationId, falInput, userConfig, isRetry) {
    try {
        console.log(`[bg] 🎬 Starting fal.subscribe for: ${operationId}`);

        const result = await fal.subscribe(FAL_MODEL, {
            input: falInput,
            logs: false,
        });

        const videoUrl = result.data?.video?.url;

        if (!videoUrl) throw new Error('fal.ai completed but no video URL');

        // ── SUCCESS ──
        console.log(`[bg] ✅ Video ready: ${operationId}`);

        if (supabase) {
            await supabase
                .from('video_sessions')
                .update({ video_url: videoUrl, status: 'complete' })
                .eq('operation_id', operationId);
        }

        // Send success email
        await sendSuccessEmail(operationId);

    } catch (err) {
        // ── FAILURE ──
        console.error(`[bg] ❌ Failed: ${operationId} — ${err.message}`);

        if (supabase) {
            await supabase
                .from('video_sessions')
                .update({
                    status: 'failed',
                    error_reason: err.message,
                    error_code: 'FAL_FAILED',
                })
                .eq('operation_id', operationId);
        }

        if (!isRetry && userConfig?.email) {
            // ── Auto-retry (once) ──
            console.log(`[bg] 🔄 Auto-retrying for: ${userConfig.email}`);
            try {
                await retryGeneration(userConfig);
            } catch (retryErr) {
                console.error(`[bg] Retry failed:`, retryErr.message);
                await sendFailureEmail(operationId);
            }
        } else {
            // This IS the retry and it also failed — notify user
            console.log(`[bg] 💀 Both attempts failed — sending failure email`);
            await sendFailureEmail(operationId);
        }
    }
}

async function retryGeneration(userConfig) {
    fal.config({ credentials: process.env.FAL_KEY });

    const charConfig = characterConfig[userConfig.character] || characterConfig.potato;
    const imageUrl = userConfig.userType === 'receiver' ? charConfig.receiverImage : charConfig.buyerImage;
    const prompt = `A cute ${charConfig.description} saying: "${userConfig.message}". The character should be animated with mouth movements matching the speech. Notice to generate the product to look the same as in the reference image. Add some cute hand movements of the product, only one hand should move, the other hand should keep holding the sign. Ensure the product looks the same as in the reference image. Cinematic lighting, photorealistic texture of yarn.`;

    const retryOpId = `fal:retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (supabase) {
        await supabase.from('video_sessions').insert([{
            email: userConfig.email.toLowerCase(),
            product: userConfig.character,
            user_type: userConfig.userType || null,
            message: userConfig.message,
            operation_id: retryOpId,
            status: 'pending',
            sku: userConfig.sku || null
        }]);
    }

    // Run the retry (this is already in a background context, so we can await)
    await processVideoGeneration(retryOpId, {
        prompt,
        start_image_url: imageUrl,
        duration: '5',
        generate_audio: true,
        negative_prompt: 'blur, distort, and low quality',
        cfg_scale: 0.5,
    }, userConfig, true); // isRetry = true
}

// ══════════════════════════════════════════════════════════
// Email functions
// ══════════════════════════════════════════════════════════
async function sendSuccessEmail(operationId) {
    if (!supabase || !resend) return;

    try {
        const { data: session } = await supabase
            .from('video_sessions')
            .select('email, product, user_type, email_sent')
            .eq('operation_id', operationId)
            .single();

        if (!session || !session.email || session.email_sent) return;

        const videoPageUrl = `https://video.gotyoualittlesomething.com/video-preview.html?id=${encodeURIComponent(operationId)}`;

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

        const { error } = await resend.emails.send({
            from: 'Got You A Little Something <info@gotyoualittlesomething.com>',
            to: session.email,
            subject: '🎉 Your Video is Ready to Share!',
            html: emailHtml
        });

        if (error) {
            console.error('[email] Success email error:', error);
        } else {
            console.log('[email] 📧 Success email sent to:', session.email);
            await supabase.from('video_sessions').update({ email_sent: true }).eq('operation_id', operationId);
        }
    } catch (err) {
        console.error('[email] Error:', err);
    }
}

async function sendFailureEmail(operationId) {
    if (!supabase || !resend) return;

    try {
        const { data: session } = await supabase
            .from('video_sessions')
            .select('email, product')
            .eq('operation_id', operationId)
            .single();

        if (!session || !session.email) return;

        const retryUrl = `https://video.gotyoualittlesomething.com/?sku=${encodeURIComponent(session.product || '')}`;

        const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 16px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <tr><td align="center" style="padding: 40px 30px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">😔</div>
                    <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">Oops! Something Went Wrong</h1>
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

        const { error } = await resend.emails.send({
            from: 'Got You A Little Something <info@gotyoualittlesomething.com>',
            to: session.email,
            subject: '😔 Your Video Needs Another Try',
            html: emailHtml
        });

        if (error) {
            console.error('[email] Failure email error:', error);
        } else {
            console.log('[email] 📧 Failure email sent to:', session.email);
            await supabase.from('video_sessions').update({ email_sent: true }).eq('operation_id', operationId);
        }
    } catch (err) {
        console.error('[email] Failure email error:', err);
    }
}
