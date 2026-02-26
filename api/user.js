// API endpoint: /api/user
// Handles email registration and rate limiting with Supabase
// Also updates Klaviyo profile with user_type (buyer/receiver)
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// Initialize Supabase client
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;
const MAX_VIDEOS_PER_USER = 2;

// Klaviyo config — same API key as klaviyo-subscribe.js
const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;
const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

// Update Klaviyo profile with user_type (buyer/receiver)
// Non-blocking — fire and forget, don't hold up the response
async function updateKlaviyoUserType(email, userType) {
    if (!KLAVIYO_API_KEY || !email || !userType) return;

    try {
        const res = await fetch(`${KLAVIYO_API_BASE}/profile-import/`, {
            method: 'POST',
            headers: {
                'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'revision': KLAVIYO_REVISION
            },
            body: JSON.stringify({
                data: {
                    type: 'profile',
                    attributes: {
                        email: email.toLowerCase(),
                        properties: {
                            user_type: userType  // 'buyer' or 'receiver'
                        }
                    }
                }
            })
        });

        if (res.ok) {
            console.log(`[User API] Klaviyo profile updated: ${email} → user_type: ${userType}`);
        } else {
            console.warn(`[User API] Klaviyo update failed (${res.status}):`, await res.text());
        }
    } catch (err) {
        console.warn('[User API] Klaviyo update error (non-blocking):', err.message);
    }
}

// Emails that bypass the rate limit (unlimited videos)
const VIP_EMAILS = [
    'ori@mtlbrands.com',
    'partners@gotyoualittlesomething.com',
    'gilad@mtlbrands.com',
    'guy@mtlbrands.com',
];

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

        // Check if email is in VIP list (bypass rate limit)
        if (VIP_EMAILS.includes(email.toLowerCase())) {
            console.log('[User API] VIP email detected, bypassing limit:', email);
            return res.status(200).json({
                allowed: true,
                videosRemaining: 999,
                isNewUser: false,
                isVIP: true
            });
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
            // Update Klaviyo with user_type (fire-and-forget)
            if (userType) updateKlaviyoUserType(email, userType);

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

            // Update Klaviyo with user_type (fire-and-forget)
            if (userType) updateKlaviyoUserType(email, userType);

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
