/* Async Video Generation - Returns operationId immediately */
import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const { message, character } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });
        const googleCredentials = JSON.parse(process.env.GOOGLE_CONFIG_JSON);
        const PROJECT_ID = googleCredentials.project_id;
        const LOCATION = 'us-central1';
        const MODEL_ID = 'veo-3.1-fast-generate-preview';
        const auth = new GoogleAuth({
            credentials: googleCredentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;
        const BASE_URL = 'https://crochet-friends1.vercel.app';
        const IMAGE_URL = `${BASE_URL}/images/potato.jpg`;
        const imageResponse = await fetch(IMAGE_URL);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageBase64 = imageBuffer.toString('base64');
        const generateUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predictLongRunning`;
        const generateResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                instances: [{ prompt: `A cute crocheted potato doll saying: "${message}". The potato should be animated with mouth movements.`, image: { bytesBase64Encoded: imageBase64, mimeType: "image/jpeg" } }],
                parameters: { aspectRatio: "16:9", sampleCount: 1, personGeneration: "allow_adult" }
            })
        });
        if (!generateResponse.ok) { const errorText = await generateResponse.text(); throw new Error(`Veo API Error: ${generateResponse.status} - ${errorText}`); }
        const generateData = await generateResponse.json();
        return res.status(200).json({ operationId: generateData.name, status: 'started' });
    } catch (error) { console.error('Server error:', error); return res.status(500).json({ error: 'Server error', details: error.message }); }
}
