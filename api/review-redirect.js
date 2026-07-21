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

// master_products lives in the ROS Supabase project (same pattern as api/product-lookup.js).
// Used to resolve the correct per-product ASIN from a SKU. Falls back to the crochet project,
// which does NOT hold master_products — so this lookup is BEST-EFFORT and we ALWAYS have the
// self-contained character map below as a fallback (never a hard dependency on ROS env).
const rosUrl = process.env.ROS_SUPABASE_URL || process.env.SUPABASE_URL;
const rosKey = process.env.ROS_SUPABASE_SERVICE_ROLE_KEY || process.env.ROS_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const rosSupabase = rosUrl && rosKey ? createClient(rosUrl, rosKey) : null;

// Self-contained character -> ASIN map, byte-for-byte the same ASINs the live in-app
// review links use (index.html amazonReviewUrls). This resolves the top products correctly
// with NO database call and NO ROS-env dependency, so a cupcake buyer reaches the cupcake
// listing even when the master_products lookup is unavailable.
const DEFAULT_ASIN = 'B0DVR6VBRR';
const CHARACTER_ASIN = {
    potato:      'B0DVR6VBRR',
    cupcake:     'B0DVGVHSZV',
    nursePotato: 'B0DFMXPQKH',
};

// Only these sources may be logged (prevents arbitrary strings polluting the log).
const ALLOWED_SOURCES = new Set([SOURCES.EMAIL, SOURCES.VIDEO_EMAIL]);

// Resolve the correct Amazon ASIN. Precedence:
//   1. explicit ?asin= (backward compat with any caller that already passes one)
//   2. ?sku= -> master_products lookup (correct full catalog, when ROS env is reachable)
//   3. ?character= -> self-contained CHARACTER_ASIN map (no DB, no ROS dependency)
//   4. default (potato)
async function resolveAsin({ asin, sku, character }) {
    if (asin) return asin;
    if (sku && rosSupabase) {
        try {
            // Time-cap ONLY the DB call. A slow/failed lookup must fall through to the
            // self-contained character map below — never short-circuit to the default.
            const lookup = rosSupabase
                .from('master_products')
                .select('asin')
                .eq('sku', sku)
                .single();
            const { data } = await withTimeout(lookup, 1500, 'asin-lookup');
            if (data?.asin) return data.asin;
        } catch { /* fall through to the character map */ }
    }
    if (character && CHARACTER_ASIN[character]) return CHARACTER_ASIN[character];
    return DEFAULT_ASIN;
}

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
    const { email, asin, sku, character } = req.query;

    // Which surface sent this click. Defaults to the generic Klaviyo email source so the
    // existing Email 5/6 links (which pass no source) log EXACTLY as before.
    const source = ALLOWED_SOURCES.has(req.query.source) ? req.query.source : SOURCES.EMAIL;

    // resolveAsin is internally time-capped (only the DB call) and always falls through to
    // the self-contained character map / default, so it resolves promptly without hanging.
    const targetAsin = await resolveAsin({ asin, sku, character }).catch(() => DEFAULT_ASIN);
    const amazonReviewUrl = `https://www.amazon.com/review/create-review/?ie=UTF8&channel=glance-detail&asin=${targetAsin}`;

    const role = await withTimeout(resolveRoleByEmail(email), 1500, 'role')
        .then(r => (typeof r === 'string' ? r : 'unknown'));

    // 1. Supabase funnel log (phase=email_redirect)
    const supabasePromise = (supabase && email)
        ? supabase.from('log_video_funnel_events').insert({
            event: EVENTS.REVIEW_CLICKED, phase: PHASES.EMAIL_REDIRECT, role,
            email: email.toLowerCase(), source,
            properties: { asin: targetAsin, sku: sku || null }, user_agent: req.headers['user-agent'] || null,
        })
        : Promise.resolve({ __skip: 'supabase' });

    // 2. PostHog server-side capture (page=email) so email clicks show in dashboards
    const posthogPromise = email
        ? fetch(`${POSTHOG_HOST}/i/v0/e/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: POSTHOG_KEY, event: REVIEW_EVENT,
                distinct_id: email.toLowerCase(),
                properties: { page: 'email', source, role, asin: targetAsin, $lib: 'review-redirect' },
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
