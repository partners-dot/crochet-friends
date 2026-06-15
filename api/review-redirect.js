// API endpoint: /api/review-redirect
// Email 5/6 "Leave a Review" link → record the click in 3 places, then 302 to Amazon.
//   1. Supabase log_video_funnel_events (phase=email_redirect) — agent source of truth
//   2. PostHog server-side capture (page=email) — so email clicks appear in human dashboards
//   3. Klaviyo profile (review_clicked) — existing behaviour, unchanged
// All best-effort and time-capped so the redirect stays fast.

import { createClient } from '@supabase/supabase-js';
import { EVENTS, PHASES, SOURCES, normalizeRole } from '../analytics-events.js';

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Public PostHog project key — same one already embedded in every page's HTML (not a secret).
const POSTHOG_KEY = 'phc_MEOvdUouUxVndyqyYho5gY524mTnPOfsEGWaLN5Xny8';
const POSTHOG_HOST = 'https://us.i.posthog.com';
const REVIEW_EVENT = 'Amazon Review Link Clicked';

const withTimeout = (p, ms, label) =>
    Promise.race([p, new Promise(r => setTimeout(() => r({ __timeout: label }), ms))]);

// Resolve buyer/receiver role from video_sessions by email (most recent session wins).
async function resolveRoleByEmail(email) {
    if (!supabase || !email) return 'unknown';
    try {
        const { data } = await supabase
            .from('video_sessions')
            .select('user_type')
            .eq('email', email.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        return normalizeRole(data?.user_type);
    } catch {
        return 'unknown';
    }
}

export default async function handler(req, res) {
    const { email, asin } = req.query;

    const defaultAsin = 'B0DVR6VBRR';
    const targetAsin = asin || defaultAsin;
    const amazonReviewUrl = `https://www.amazon.com/review/create-review/?ie=UTF8&channel=glance-detail&asin=${targetAsin}`;

    const role = await withTimeout(resolveRoleByEmail(email), 1500, 'role')
        .then(r => (typeof r === 'string' ? r : 'unknown'));

    // 1. Supabase funnel log (phase=email_redirect)
    const supabasePromise = (supabase && email)
        ? supabase.from('log_video_funnel_events').insert({
            event: EVENTS.REVIEW_CLICKED, phase: PHASES.EMAIL_REDIRECT, role,
            email: email.toLowerCase(), source: SOURCES.EMAIL,
            properties: { asin: targetAsin }, user_agent: req.headers['user-agent'] || null,
        })
        : Promise.resolve({ __skip: 'supabase' });

    // 2. PostHog server-side capture (page=email) so email clicks show in dashboards
    const posthogPromise = email
        ? fetch(`${POSTHOG_HOST}/i/v0/e/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: POSTHOG_KEY, event: REVIEW_EVENT,
                distinct_id: email.toLowerCase(),
                properties: { page: 'email', source: SOURCES.EMAIL, role, asin: targetAsin, $lib: 'review-redirect' },
            }),
        })
        : Promise.resolve({ __skip: 'posthog' });

    // 3. Klaviyo profile (existing behaviour)
    const klaviyoPromise = (email && KLAVIYO_API_KEY)
        ? fetch('https://a.klaviyo.com/api/profile-import/', {
            method: 'POST',
            headers: {
                'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'revision': '2024-10-15',
            },
            body: JSON.stringify({
                data: { type: 'profile', attributes: {
                    email: email.toLowerCase(),
                    properties: { review_clicked: true, review_clicked_at: new Date().toISOString() },
                } },
            }),
        })
        : Promise.resolve({ __skip: 'klaviyo' });

    // Run all three, capped at 3s total so the redirect isn't slow.
    try {
        const results = await withTimeout(
            Promise.allSettled([supabasePromise, posthogPromise, klaviyoPromise]),
            3000, 'all'
        );
        console.log('[Review Redirect] email:', email, 'role:', role,
            'results:', JSON.stringify(results).slice(0, 200));
    } catch (e) {
        console.error('[Review Redirect] tracking error:', e.message);
    }

    // Redirect to Amazon review page
    res.writeHead(302, { Location: amazonReviewUrl });
    res.end();
}
