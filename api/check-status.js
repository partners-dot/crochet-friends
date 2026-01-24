import { GoogleAuth } from 'google-auth-library';
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' }); <a> </a>
    try {
        const { operationId } = req.query;
        if (!operationId) return res.status(400).json({ error: 'operationId required' });
        const googleCredentials = JSON.parse(process.env.GOOGLE_CONFIG_JSON);
        const PROJECT_ID = googleCredentials.project_id;
        const LOCATION = 'us-central1';
        const MODEL_ID = 'veo-3.1-fast-generate-preview';
        const auth = new GoogleAuth({ credentials: googleCredentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await auth.getClient();
        const token = (await client.getAccessToken()).token;
        const fetchOperationUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`;
        const pollResponse = await fetch(fetchOperationUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ operationName: operationId }) });
        if (!pollResponse.ok) { const errorText = await pollResponse.text(); throw new Error(`Poll API Error: ${pollResponse.status} - ${errorText}`); }
        const pollData = await pollResponse.json();
        if (pollData.done) {
            if (pollData.error) return res.status(500).json({ status: 'error', error: pollData.error.message });
            const result = pollData.response;
            if (result.videos && result.videos.length > 0) {
                if (result.videos[0].bytesBase64Encoded) return res.status(200).json({ status: 'done', videoUrl: `data:video/mp4;base64,${result.videos[0].bytesBase64Encoded}` });
                return res.status(200).json({ status: 'done', videoUrl: result.videos[0].gcsUri || result.videos[0].uri });
            }
            return res.status(500).json({ status: 'error', error: 'No video in response' });
        }
        return res.status(200).json({ status: 'pending' });
    } catch (error) { console.error('Server error:', error); return res.status(500).json({ error: 'Server error', details: error.message }); }
}
