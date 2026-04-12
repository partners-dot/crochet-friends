/* Async Video Generation - Returns operationId immediately */
import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, character, email, userType, sku } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        // Parse Google Credentials from env var
        const googleCredentials = JSON.parse(process.env.GOOGLE_CONFIG_JSON);
        const PROJECT_ID = googleCredentials.project_id;
        const LOCATION = 'us-central1';
        const MODEL_ID = 'veo-3.1-fast-generate-001'; // Fast model for quicker generation (updated from deprecated -preview)

        // Authenticate and get Access Token
        const auth = new GoogleAuth({
            credentials: googleCredentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;

        // Character configuration - maps character names to their image and prompt descriptions
        const BASE_URL = 'https://crochet-friends1.vercel.app';
        const selectedCharacter = character || 'potato'; // Default to potato if not specified
        const selectedUserType = userType || 'buyer'; // Default to buyer if not specified

        // Character config with buyer/receiver specific images
        const characterConfig = {
            potato: {
                buyerImage: `${BASE_URL}/images/potato-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/potato-receiver.jpg`,
                description: 'crocheted potato doll'
            },
            cupcake: {
                buyerImage: `${BASE_URL}/images/cupcake-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/cupcake-receiver.jpg`,
                description: 'crocheted cupcake doll with pink frosting and a cherry on top'
            },
            nursePotato: {
                buyerImage: `${BASE_URL}/images/nursePotato-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/nursePotato-receiver.jpg`,
                description: 'crocheted nurse potato doll with a nurse cap'
            },
            bossLady: {
                buyerImage: `${BASE_URL}/images/bossLady-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/bossLady-receiver.jpg`,
                description: 'crocheted boss lady potato doll with glasses and briefcase'
            },
            cat: {
                buyerImage: `${BASE_URL}/images/cat-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/cat-receiver.jpg`,
                description: 'crocheted cat doll'
            },
            dadJokes: {
                buyerImage: `${BASE_URL}/images/dadJokes-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/dadJokes-receiver.jpg`,
                description: 'crocheted dad jokes potato doll'
            },
            dog: {
                buyerImage: `${BASE_URL}/images/dog-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/dog-receiver.jpg`,
                description: 'crocheted dog doll'
            },
            pup: {
                buyerImage: `${BASE_URL}/images/pup-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/pup-receiver.jpg`,
                description: 'crocheted puppy doll'
            },
            yoda: {
                buyerImage: `${BASE_URL}/images/yoda-buyer.jpg`,
                receiverImage: `${BASE_URL}/images/yoda-receiver.jpg`,
                description: 'crocheted green alien doll with big pointy ears'
            }
        };

        // Get character config or fallback to potato
        const charConfig = characterConfig[selectedCharacter] || characterConfig.potato;
        // Select image based on user type
        const IMAGE_URL = selectedUserType === 'receiver' ? charConfig.receiverImage : charConfig.buyerImage;

        // Fetch and encode image as base64
        const imageResponse = await fetch(IMAGE_URL);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageBase64 = imageBuffer.toString('base64');

        console.log(`Generating video for character: ${selectedCharacter}, image: ${IMAGE_URL}`);

        // Start Video Generation (Long Running Operation)
        const generateUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predictLongRunning`;

        const generateResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: `A cute ${charConfig.description} saying: "${message}". The character should be animated with mouth movements matching the speech. Notice to generate the product to look the same as in the reference image. Add some cute hand movements of the product, only one hand should move, the other hand should keep holding the sign. Ensure the product looks the same as in the reference image. Cinematic lighting, photorealistic texture of yarn.`,
                        image: {
                            bytesBase64Encoded: imageBase64,
                            mimeType: "image/jpeg"
                        }
                    }
                ],
                parameters: {
                    aspectRatio: "16:9",
                    sampleCount: 1,
                    personGeneration: "allow_adult",
                }
            })
        });

        if (!generateResponse.ok) {
            const errorText = await generateResponse.text();
            console.error('Veo generation error:', errorText);
            throw new Error("Veo API Error: " + generateResponse.status + " " + generateResponse.statusText + " - " + errorText);
        }

        const generateData = await generateResponse.json();
        const operationName = generateData.name; // "projects/.../operations/..."

        console.log('Video generation started:', operationName);

        // Save to Supabase if configured and email provided
        let isDuplicate = false;
        if (supabase && email) {
            // Duplicate prevention: check if same email has a pending session created in last 10 seconds
            const { data: recentPending } = await supabase
                .from('video_sessions')
                .select('id, created_at')
                .eq('email', email.toLowerCase())
                .eq('status', 'pending')
                .gte('created_at', new Date(Date.now() - 10000).toISOString())
                .limit(1);

            isDuplicate = recentPending && recentPending.length > 0;

            if (isDuplicate) {
                console.log('[Generate Video] Duplicate detected for:', email, '- skipping DB insert');
            } else {
                // 1. Log video session with operation_id
                const { error: sessionError } = await supabase.from('video_sessions').insert([{
                    email: email.toLowerCase(),
                    product: selectedCharacter,
                    user_type: userType || null,
                    message: message,
                    operation_id: operationName,
                    status: 'pending',
                    sku: sku || null
                }]);

                if (sessionError) {
                    console.error('[Generate Video] video_sessions insert error:', sessionError);
                } else {
                    console.log('[Generate Video] video_sessions insert OK for:', email);
                }

                // 2. Increment videos_created count (skip for retries)
                if (!req.body.isRetry) {
                    const { data: user, error: selectError } = await supabase
                        .from('users')
                        .select('videos_created')
                        .eq('email', email.toLowerCase())
                        .single();

                    if (user) {
                        const { error: updateError } = await supabase
                            .from('users')
                            .update({
                                videos_created: (user.videos_created || 0) + 1,
                                updated_at: new Date().toISOString()
                            })
                            .eq('email', email.toLowerCase());

                        if (updateError) {
                            console.error('[Generate Video] videos_created update error:', updateError);
                        } else {
                            console.log('[Generate Video] videos_created incremented for:', email, 'to', (user.videos_created || 0) + 1);
                        }
                    } else if (selectError && selectError.code !== 'PGRST116') {
                        console.error('[Generate Video] user select error:', selectError);
                    }
                }
            }
        }

        // Fire-and-forget: kick off server-side resolution
        // This runs independently — handles save + email even if user closes browser
        if (!isDuplicate) {
            const resolveUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}/api/resolve-video`
                : 'https://video.gotyoualittlesomething.com/api/resolve-video';

            fetch(resolveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operationId: operationName,
                    retryConfig: {
                        message,
                        character: selectedCharacter,
                        email: email?.toLowerCase(),
                        userType,
                        sku: sku || null,
                        isRetry: req.body.isRetry || false
                    }
                })
            }).catch(err => console.error('[Generate Video] Failed to start resolver:', err));
        }

        // Return immediately with operationId for frontend to poll
        return res.status(200).json({
            operationId: operationName,
            status: 'started'
        });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}
