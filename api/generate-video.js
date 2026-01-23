export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message, character } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const DID_API_KEY = process.env.DID_API_KEY;

        // Character image URLs - Use production URL since D-ID needs public access
        const BASE_URL = 'https://crochet-friends1.vercel.app';
    const CHARACTER_IMAGES = {
        potato: `${BASE_URL}/images/potato.jpg`,
        avocado: `${BASE_URL}/images/potato.jpg`, // Use potato for now, add more later
        strawberry: `${BASE_URL}/images/potato.jpg`,
        mushroom: `${BASE_URL}/images/potato.jpg`,
        carrot: `${BASE_URL}/images/potato.jpg`,
        sun: `${BASE_URL}/images/potato.jpg`,
    };

    const imageUrl = CHARACTER_IMAGES[character] || CHARACTER_IMAGES.potato;

    try {
        // Step 1: Create the talk
        const createRes = await fetch('https://api.d-id.com/talks', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${DID_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_url: imageUrl,
                script: {
                    type: 'text',
                    input: message,
                    provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' }
                },
                config: { fluent: true, pad_audio: 0.5 }
            })
        });

        if (!createRes.ok) {
            const err = await createRes.text();
            console.error('D-ID create error:', err);
            return res.status(500).json({ error: 'Failed to create video', details: err });
        }

        const { id } = await createRes.json();

        // Step 2: Poll for completion (max 60 seconds)
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));

            const statusRes = await fetch(`https://api.d-id.com/talks/${id}`, {
                headers: { 'Authorization': `Basic ${DID_API_KEY}` }
            });

            const status = await statusRes.json();

            if (status.status === 'done') {
                return res.status(200).json({ videoUrl: status.result_url });
            }
            if (status.status === 'error') {
                return res.status(500).json({ error: 'Video generation failed', details: status.error });
            }
        }

        return res.status(504).json({ error: 'Video generation timed out' });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}

