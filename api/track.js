// API endpoint: /api/track
// The single server-side chokepoint for funnel tracking. Does two jobs, best-effort:
//   1. Writes one row to log_video_funnel_events (agent/optimization source of truth),
//      with role (buyer/receiver/unknown) resolved from video_sessions.
//   2. Updates the Klaviyo profile for review_clicked / video_shared (unchanged behaviour).
//
// Accepts TWO request shapes (back-compat):
//   A) legacy:  { operationId, action }                  // action: 'review_clicked' | 'video_shared'
//   B) funnel:  { event, phase, role?, email?, operationId?, source?, product?, properties? }
// Never blocks the user: always returns 200; logging/Klaviyo failures are swallowed.

import { createClient } from '@supabase/supabase-js';
import { EVENTS, PHASES, ROLES, SOURCES, normalizeRole } from '../analytics-events.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;

// Map a legacy `action` to a funnel event + phase (best guess for the old callers).
const LEGACY_ACTION_TO_EVENT = {
  review_clicked: { event: EVENTS.REVIEW_CLICKED, phase: PHASES.PREVIEW },
  video_shared:   { event: EVENTS.SHARE_COMPLETED, phase: PHASES.PREVIEW },
};

// Resolve role + email + product from video_sessions, given operationId or email.
async function resolveSession({ operationId, email }) {
  if (!supabase) return {};
  try {
    let q = supabase.from('video_sessions').select('email, product, user_type').limit(1);
    if (operationId) q = q.eq('operation_id', operationId);
    else if (email) q = q.eq('email', String(email).toLowerCase());
    else return {};
    const { data } = await q.single();
    return data || {};
  } catch {
    return {};
  }
}

// Insert one funnel-event row. Best-effort.
async function logFunnelEvent(row, req) {
  if (!supabase) return;
  try {
    // supabase-js returns { error } rather than throwing — check it explicitly.
    const { error } = await supabase.from('log_video_funnel_events').insert({
      event: row.event,
      phase: row.phase,
      role: normalizeRole(row.role),
      email: row.email ? String(row.email).toLowerCase() : null,
      operation_id: row.operationId || null,
      source: row.source || null,
      product: row.product || null,
      properties: row.properties || {},
      user_agent: req.headers['user-agent'] || null,
    });
    if (error) console.error('[Track] funnel log insert failed:', error.message);
  } catch (e) {
    console.error('[Track] funnel log insert threw:', e.message);
  }
}

// Update Klaviyo profile for review_clicked / video_shared. Best-effort.
async function updateKlaviyo(action, email) {
  if (!KLAVIYO_API_KEY || !email) return;
  if (action !== 'review_clicked' && action !== 'video_shared') return;
  const properties = action === 'review_clicked'
    ? { review_clicked: true, review_clicked_at: new Date().toISOString() }
    : { video_shared: true, video_shared_at: new Date().toISOString() };
  try {
    const r = await fetch('https://a.klaviyo.com/api/profile-import/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'revision': '2024-10-15',
      },
      body: JSON.stringify({ data: { type: 'profile', attributes: { email: email.toLowerCase(), properties } } }),
    });
    console.log(`[Track] ${action} for ${email}: Klaviyo ${r.status}`);
  } catch (e) {
    console.error('[Track] Klaviyo update failed:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const isLegacy = !body.event && !!body.action;

    // Normalize to a single internal shape.
    let event, phase, role, email, operationId, source, product, properties, legacyAction;

    if (isLegacy) {
      // Shape A: { operationId, action }
      legacyAction = body.action;
      operationId = body.operationId;
      const mapped = LEGACY_ACTION_TO_EVENT[legacyAction] || { event: legacyAction, phase: PHASES.PREVIEW };
      event = mapped.event;
      phase = mapped.phase;
      properties = {};
    } else {
      // Shape B: { event, phase, role, email, operationId, source, product, properties }
      event = body.event;
      phase = body.phase;
      role = body.role;
      email = body.email;
      operationId = body.operationId;
      source = body.source;
      product = body.product;
      properties = body.properties || {};
    }

    if (!event) return res.status(200).json({ tracked: false, reason: 'no event' });

    // Resolve role/email/product from video_sessions when we can (and don't already have them).
    if ((!role || !email || !product) && (operationId || email)) {
      const s = await resolveSession({ operationId, email });
      role = role || s.user_type;
      email = email || s.email;
      product = product || s.product;
    }
    role = normalizeRole(role);

    // 1. Write the funnel-event row (best-effort).
    await logFunnelEvent({ event, phase, role, email, operationId, source, product, properties }, req);

    // 2. Klaviyo update — for the review/share signals (legacy action OR new event).
    const klaviyoAction =
      legacyAction ||
      (event === EVENTS.REVIEW_CLICKED ? 'review_clicked'
        : (event === EVENTS.SHARE_COMPLETED ? 'video_shared' : null));
    if (klaviyoAction) await updateKlaviyo(klaviyoAction, email);

    return res.status(200).json({ tracked: true, role, event });
  } catch (error) {
    console.error('[Track] Error:', error);
    return res.status(200).json({ tracked: false, reason: 'error' });
  }
}
