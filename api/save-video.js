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

        // Update Klaviyo profile with video_created property for the welcome flow
        const savedSession = updateData[0];
        const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;
        if (savedSession?.email && KLAVIYO_API_KEY) {
            try {
                const profilePayload = {
                    data: {
                        type: 'profile',
                        attributes: {
                            email: savedSession.email.toLowerCase(),
                            properties: {
                                video_created: true,
                                video_created_at: new Date().toISOString(),
                                video_url: videoUrl,
                                video_product: savedSession.product || null
                            }
                        }
                    }
                };

                const profileRes = await fetch('https://a.klaviyo.com/api/profile-import/', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'revision': '2024-10-15'
                    },
                    body: JSON.stringify(profilePayload)
                });
                console.log('[SAVE-VIDEO] Klaviyo profile update result:', profileRes.status);
                if (!profileRes.ok) {
                    const errText = await profileRes.text();
                    console.error('[SAVE-VIDEO] Klaviyo profile update error:', errText);
                }
            } catch (klaviyoErr) {
                console.error('[SAVE-VIDEO] Klaviyo update error (non-blocking):', klaviyoErr.message);
            }
        } else {
            console.log('[SAVE-VIDEO] Skipping Klaviyo update - email:', savedSession?.email, 'apiKey:', !!KLAVIYO_API_KEY);
        }

        return res.status(200).json({ success: true, rowsUpdated: updateData.length });

    } catch (err) {
        console.error('[SAVE-VIDEO] Error:', err);
        return res.status(500).json({ error: 'Failed to save video' });
    }
}
