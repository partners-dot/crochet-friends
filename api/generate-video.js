/* Using require for GoogleAuth to ensure compatibility */
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
        const MODEL_ID = 'veo-3.1-generate-001'; 

        // Authenticate and get Access Token
        const auth = new GoogleAuth({
            credentials: googleCredentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;

        // Character image URL (Production URL)
        const BASE_URL = 'https://crochet-friends1.vercel.app';
        const IMAGE_URL = `${BASE_URL}/images/potato.jpg`;

        // Fetch and encode image
        const imageResponse = await fetch(IMAGE_URL);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageBase64 = imageBuffer.toString('base64');

        // Step 1: Start Video Generation
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
                        prompt: `A cute crocheted potato doll saying: "${message}". The potato should be animated with mouth movements matching the speech. Cinematic lighting, photorealistic texture of yarn.`,
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
            throw new Error(`Veo API Error: ${generateResponse.status} ${generateResponse.statusText} - ${errorText}`);
        }

        const generateData = await generateResponse.json();
        const operationName = generateData.name; 

        // Step 2: Poll for Completion
        console.log('Video generation started, polling for completion...', operationName);
        
        const fetchOperationUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`;
        
        let videoUri = null;
        let attempts = 0;
        // Increase polling duration for Veo (can take >60s)
        const maxAttempts = 40; 

        while (!videoUri && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 3000));
            attempts++;

            const pollResponse = await fetch(fetchOperationUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ operationName })
            });

            if (!pollResponse.ok) {
                console.error('Polling error:', await pollResponse.text());
                continue;
            }

            const pollData = await pollResponse.json();
            
            if (pollData.done) {
                if (pollData.error) {
                     throw new Error(`Generation failed: ${JSON.stringify(pollData.error)}`);
                }
                
                const result = pollData.response; 
                if (result.videos && result.videos.length > 0) {
                     videoUri = result.videos[0].gcsUri || result.videos[0].uri;
                } else {
                     throw new Error('No video found in response');
                }
            }
        }

        if (!videoUri) {
            return res.status(504).json({ error: 'Video generation timed out' });
        }
        
        return res.status(200).json({ videoUrl: videoUri });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}
