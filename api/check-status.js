/* Check Video Generation Status
 * 
 * Frontend polls this every 5s after calling generate-video.
 * 
 * Logic:
 *   1. Look up session in Supabase by operationId
 *   2. If complete → return { status: 'done', videoUrl }
 *   3. If failed → return { status: 'error', error, errorCode }
 *   4. If pending → return { status: 'pending' }
 *   5. If not found → return { status: 'pending' } (generate-video hasn't saved yet)
 *
 * The resolve-video.js background worker updates the DB when the video is ready.
 */
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
        const { operationId } = req.query;
        if (!operationId) return res.status(400).json({ error: 'operationId required' });

        if (!supabase) {
            return res.status(500).json({ error: 'Database not configured' });
        }

        // Look up the video session in Supabase
        const { data: session, error: dbError } = await supabase
            .from('video_sessions')
            .select('status, video_url, error_reason, error_code, created_at')
            .eq('operation_id', operationId)
            .single();

        // Not found in DB yet → generate-video hasn't saved it, or still inserting
        if (dbError || !session) {
            return res.status(200).json({ status: 'pending' });
        }

        switch (session.status) {
            case 'complete':
                return res.status(200).json({
                    status: 'done',
                    videoUrl: session.video_url
                });

            case 'failed':
                return res.status(200).json({
                    status: 'error',
                    error: session.error_reason || 'Video generation failed',
                    errorCode: session.error_code || 'GENERATION_ERROR'
                });

            case 'pending':
            default:
                // Check for stale sessions (older than 8 minutes = something went wrong)
                // Railway has no timeout, but 8 min is a generous upper bound for generation
                const createdAt = session.created_at ? new Date(session.created_at) : null;
                if (createdAt && (Date.now() - createdAt.getTime()) > 8 * 60 * 1000) {
                    // Mark as failed in DB to prevent zombie sessions
                    await supabase
                        .from('video_sessions')
                        .update({
                            status: 'failed',
                            error_reason: 'Session timed out — resolver did not complete in time',
                            error_code: 'STALE_TIMEOUT'
                        })
                        .eq('operation_id', operationId);

                    return res.status(200).json({
                        status: 'error',
                        error: 'Video generation timed out. Please try again.',
                        errorCode: 'TIMEOUT'
                    });
                }

                return res.status(200).json({ status: 'pending' });
        }

    } catch (error) {
        console.error('[check-status] Server error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}
