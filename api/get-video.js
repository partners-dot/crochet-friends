/* Get Video URL by Operation ID */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id required' });

        if (!supabase) {
            return res.status(500).json({ error: 'Database not configured' });
        }

        // Look up the video session
        const { data: session, error } = await supabase
            .from('video_sessions')
            .select('video_url, product, status, user_type')
            .eq('operation_id', id)
            .single();

        if (error || !session) {
            return res.status(404).json({ error: 'Video not found' });
        }

        if (session.status !== 'complete' || !session.video_url) {
            return res.status(404).json({ error: 'Video not ready yet' });
        }

        return res.status(200).json({
            videoUrl: session.video_url,
            product: session.product,
            userType: session.user_type
        });

    } catch (err) {
        console.error('Get video error:', err);
        return res.status(500).json({ error: 'Failed to get video' });
    }
}
