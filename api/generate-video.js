/* Async Video Generation - Returns operationId immediately */
import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, character } = req.body;
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

        const characterConfig = {
            potato: {
                image: `${BASE_URL}/images/potato.jpg`,
                description: 'crocheted potato doll'
            },
            cupcake: {
                image: `${BASE_URL}/images/cupcake.jpg`,
                description: 'crocheted cupcake doll with pink frosting and a cherry on top'
            },
            yoda: {
                image: `${BASE_URL}/images/yoda.jpg`,
                description: 'crocheted green alien doll with big pointy ears'
            }
        };

        // Get character config or fallback to potato
        const charConfig = characterConfig[selectedCharacter] || characterConfig.potato;
        const IMAGE_URL = charConfig.image;

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
                        prompt: `A cute ${charConfig.description} saying: "${message}". The character should be animated with mouth movements matching the speech. Cinematic lighting, photorealistic texture of yarn.`,
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
