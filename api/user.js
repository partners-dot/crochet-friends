// API endpoint: /api/user
// Handles email registration and rate limiting with Supabase
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// Initialize Supabase client
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;
const MAX_VIDEOS_PER_USER = 2;
export default async function handler(req, res) {
    // DEBUG: Log environment variables (remove after debugging)
    console.log('[User API] SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
    console.log('[User API] SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
    console.log('[User API] Supabase client initialized:', !!supabase);
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const { email, userType, product } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        // If Supabase is not configured, allow with graceful fallback
        if (!supabase) {
            console.log('[User API] Supabase not configured, allowing request');
            return res.status(200).json({
                allowed: true,
                videosRemaining: MAX_VIDEOS_PER_USER,
                isNewUser: true
            });
        }
        // Check if user exists
        const { data: existingUser, error: selectError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();
        if (selectError && selectError.code !== 'PGRST116') {
            // PGRST116 = no rows found (new user)
            console.error('[User API] DB select error:', selectError);
            throw selectError;
        }
        if (existingUser) {
            // Existing user - count only SUCCESSFUL videos from video_sessions
            const { count, error: countError } = await supabase
                .from('video_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('email', email.toLowerCase())
                .eq('status', 'complete');

            if (countError) {
                console.error('[User API] Error counting videos:', countError);
                // Fall back to old method if count fails
                const videosCreated = existingUser.videos_created || 0;
                return res.status(200).json({
                    allowed: videosCreated < MAX_VIDEOS_PER_USER,
                    videosRemaining: Math.max(0, MAX_VIDEOS_PER_USER - videosCreated),
                    isNewUser: false
                });
            }

            const successfulVideos = count || 0;
            const allowed = successfulVideos < MAX_VIDEOS_PER_USER;
            const videosRemaining = Math.max(0, MAX_VIDEOS_PER_USER - successfulVideos);
            console.log('[User API] Existing user:', email, 'successful_videos:', successfulVideos, 'allowed:', allowed);
            return res.status(200).json({
                allowed,
                videosRemaining,
                isNewUser: false
            });
        } else {
            // New user - create record
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([
                    {
                        email: email.toLowerCase(),
                        videos_created: 0,
                        user_type: userType || null,
                        product: product || null
                    }
                ])
                .select()
                .single();
            if (insertError) {
                console.error('[User API] DB insert error:', insertError);
                throw insertError;
            }
            console.log('[User API] New user created:', email);
            return res.status(200).json({
                allowed: true,
                videosRemaining: MAX_VIDEOS_PER_USER,
                isNewUser: true
            });
        }
    } catch (error) {
        console.error('[User API] Error:', error);
        // Graceful degradation - allow if DB fails
        return res.status(200).json({
            allowed: true,
            videosRemaining: MAX_VIDEOS_PER_USER,
            error: 'Database unavailable, allowing request'
        });
    }
}
