// API endpoint: /api/track - Analytics tracking

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { event_type, product, user_type, email, metadata } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type required' });

    const eventData = { event_type, product: product || null, user_type: user_type || null, email: email ? email.toLowerCase() : null, metadata: metadata || null };
    console.log('[Analytics]', JSON.stringify(eventData));

    if (supabase) {
      await supabase.from('analytics_events').insert([eventData]);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Track API] Error:', error);
    return res.status(200).json({ success: false });
  }
}
