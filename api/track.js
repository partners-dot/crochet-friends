// API endpoint: /api/track
// Tracks user actions (review clicks, etc.) and updates Klaviyo profile
// Used by video-preview.html for sender-side tracking

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { operationId, action } = req.body;

    if (!operationId || !action) {
      return res.status(400).json({ error: 'operationId and action required' });
    }

    // Look up the email from video_sessions
    if (!supabase) return res.status(200).json({ tracked: false, reason: 'no db' });

    const { data: session } = await supabase
      .from('video_sessions')
      .select('email, product')
      .eq('operation_id', operationId)
      .single();

    if (!session?.email) {
      return res.status(200).json({ tracked: false, reason: 'no email found' });
    }

    // Update Klaviyo profile with the action
    if (KLAVIYO_API_KEY && action === 'review_clicked') {
      const profilePayload = {
        data: {
          type: 'profile',
          attributes: {
            email: session.email.toLowerCase(),
            properties: {
              review_clicked: true,
              review_clicked_at: new Date().toISOString()
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
      console.log(`[Track] ${action} for ${session.email}: Klaviyo ${profileRes.status}`);
    }

    return res.status(200).json({ tracked: true });

  } catch (error) {
    console.error('[Track] Error:', error);
    return res.status(200).json({ tracked: false, reason: 'error' });
  }
}
