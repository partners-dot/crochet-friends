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

        const videoUrlLength = videoUrl ? videoUrl.length : 0;
        console.log('[SAVE-VIDEO] Operation ID:', operationId);
        console.log('[SAVE-VIDEO] Video URL length:', videoUrlLength, 'bytes');
        console.log('[SAVE-VIDEO] Video URL type:', typeof videoUrl);
        console.log('[SAVE-VIDEO] First 100 chars:', videoUrl ? videoUrl.substring(0, 100) : 'null');

        // First, check if the operation exists
        const { data: existingRow, error: selectError } = await supabase
            .from('video_sessions')
            .select('id, operation_id, video_url')
            .eq('operation_id', operationId)
            .single();

        if (selectError) {
            console.error('[SAVE-VIDEO] Select error:', selectError);
        } else {
            console.log('[SAVE-VIDEO] Found existing row:', existingRow?.id, 'current video_url length:', existingRow?.video_url?.length || 0);
        }

        // Update the session with the video URL
        const { data: updateData, error: updateError, count } = await supabase
            .from('video_sessions')
            .update({ video_url: videoUrl, status: 'complete' })
            .eq('operation_id', operationId)
            .select('id, operation_id, video_url, email, product');

        console.log('[SAVE-VIDEO] Update result - error:', updateError, 'data:', updateData?.length, 'rows affected');

        if (updateError) {
            console.error('[SAVE-VIDEO] Update failed:', updateError.message, updateError.details, updateError.hint);
            return res.status(500).json({ error: 'Failed to save video URL', details: updateError.message });
        }

        if (!updateData || updateData.length === 0) {
            console.error('[SAVE-VIDEO] No rows updated! Operation ID might not exist:', operationId);
            return res.status(404).json({ error: 'No matching session found for operation ID' });
        }

        console.log('[SAVE-VIDEO] Success! Updated', updateData.length, 'row(s)');

        // Fire "Video Created" event to Klaviyo for the welcome flow
        const savedSession = updateData[0];
        if (savedSession?.email) {
            try {
                const BASE_URL = process.env.VERCEL_URL
                    ? `https://${process.env.VERCEL_URL}`
                    : 'https://crochet-friends1.vercel.app';

                const eventRes = await fetch(`${BASE_URL}/api/klaviyo-event`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: savedSession.email,
                        eventName: 'Video Created',
                        properties: {
                            video_url: videoUrl,
                            product: savedSession.product || null,
                            operation_id: operationId
                        }
                    })
                });
                console.log('[SAVE-VIDEO] Klaviyo event result:', eventRes.status);
            } catch (klaviyoErr) {
                // Don't block the response if Klaviyo fails
                console.error('[SAVE-VIDEO] Klaviyo event error (non-blocking):', klaviyoErr.message);
            }
        }

        return res.status(200).json({ success: true, rowsUpdated: updateData.length });

    } catch (err) {
        console.error('[SAVE-VIDEO] Error:', err);
        return res.status(500).json({ error: 'Failed to save video' });
    }
}
