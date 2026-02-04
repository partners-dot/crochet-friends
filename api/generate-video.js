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
        const { message, character, email, userType } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        // Parse Google Credentials from env var
        const googleCredentials = JSON.parse(process.env.GOOGLE_CONFIG_JSON);
        const PROJECT_ID = googleCredentials.project_id;
        const LOCATION = 'us-central1';
        const MODEL_ID = 'veo-3.1-fast-generate-preview'; // Fast model for quicker generation

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
        if (supabase && email) {
            // 1. Log video session with operation_id
            const { error: sessionError } = await supabase.from('video_sessions').insert([{
                email: email.toLowerCase(),
                product: selectedCharacter,
                user_type: userType || null,
                message: message,
                operation_id: operationName,
                status: 'pending'
            }]);

            if (sessionError) {
                console.error('[Generate Video] video_sessions insert error:', sessionError);
            } else {
                console.log('[Generate Video] video_sessions insert OK for:', email);
            }

            // 2. Increment videos_created count
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
