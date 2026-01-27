// API endpoint: /api/user
// Handles email registration and rate limiting with Supabase

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const MAX_VIDEOS_PER_USER = 2;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, userType, product } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

    if (!supabase) {
      console.log('[User API] Supabase not configured, allowing request');
      return res.status(200).json({ allowed: true, videosRemaining: MAX_VIDEOS_PER_USER, isNewUser: true });
    }

    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (selectError && selectError.code !== 'PGRST116') throw selectError;

    if (existingUser) {
      const videosCreated = existingUser.videos_created || 0;
      const allowed = videosCreated < MAX_VIDEOS_PER_USER;
      return res.status(200).json({ allowed, videosRemaining: Math.max(0, MAX_VIDEOS_PER_USER - videosCreated), isNewUser: false });
    } else {
      await supabase.from('users').insert([{ email: email.toLowerCase(), videos_created: 0, user_type: userType || null, product: product || null }]);
      return res.status(200).json({ allowed: true, videosRemaining: MAX_VIDEOS_PER_USER, isNewUser: true });
    }
  } catch (error) {
    console.error('[User API] Error:', error);
    return res.status(200).json({ allowed: true, videosRemaining: MAX_VIDEOS_PER_USER, error: 'Database unavailable' });
  }
}
