/* Save Video URL to Supabase */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { operationId, videoUrl } = req.body;

        if (!operationId || !videoUrl) {
            return res.status(400).json({ error: 'operationId and videoUrl required' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Database not configured' });
        }

        console.log('[SAVE-VIDEO] Saving video URL for operation:', operationId, 'URL length:', videoUrl.length);

        // Update the session with the video URL
        const { error: updateError } = await supabase
            .from('video_sessions')
            .update({ video_url: videoUrl, status: 'complete' })
            .eq('operation_id', operationId);

        if (updateError) {
            console.error('[SAVE-VIDEO] Failed:', updateError);
            return res.status(500).json({ error: 'Failed to save video URL', details: updateError.message });
        }

        console.log('[SAVE-VIDEO] Success!');
        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('[SAVE-VIDEO] Error:', err);
        return res.status(500).json({ error: 'Failed to save video' });
    }
}
