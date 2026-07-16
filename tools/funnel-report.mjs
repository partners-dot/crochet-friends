// funnel-report.mjs — the one command a future agent runs to analyze the video funnel.
// Reads log_video_funnel_events (the agent source of truth) + video_sessions (true video counts).
//
//   node tools/funnel-report.mjs            # all-time
//   node tools/funnel-report.mjs 30         # last 30 days
//
// Prints: funnel by phase, review clicks by phase × role × source (every button),
// role split, and true vs logged video counts. No PostHog, no ad-hoc HogQL needed.
//
// Env: SUPABASE_URL + SUPABASE_ANON_KEY (crochet project) — read from process.env
// first, then from a root .env file if present (fresh clones may have neither file).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const E = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY };
if (!E.SUPABASE_URL || !E.SUPABASE_ANON_KEY) {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const l of env.split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !E[m[1]]) E[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
  } catch { /* no .env file — process.env was the only chance */ }
}
if (!E.SUPABASE_URL || !E.SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY (set env vars or create a root .env).');
  process.exit(1);
}
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY);

const days = parseInt(process.argv[2] || '0', 10);
const sinceISO = days > 0 ? new Date(Date.now() - days * 864e5).toISOString() : null;
const label = days > 0 ? `last ${days} days` : 'all-time';

function tbl(rows) { rows.forEach(r => console.log('   ' + r)); }

async function fetchAll(table, cols) {
  let from = 0, out = [], page;
  do {
    let q = sb.from(table).select(cols).range(from, from + 999);
    if (sinceISO) q = q.gte('created_at', sinceISO);
    const { data, error } = await q;
    if (error) { console.error(`  ${table} error: ${error.message}`); return out; }
    page = data || []; out = out.concat(page); from += 1000;
  } while (page.length === 1000);
  return out;
}

(async () => {
  console.log(`\n=== CROCHET VIDEO FUNNEL REPORT (${label}) ===\n`);

  const ev = await fetchAll('log_video_funnel_events', 'event,phase,role,source,created_at');
  if (!ev.length) {
    console.log('No rows in log_video_funnel_events yet (table empty or not deployed).');
    console.log('History before this table existed lives in PostHog — see ANALYTICS.md.');
  }

  // 1. Funnel by event
  console.log('1. EVENTS (count):');
  const byEvent = {};
  for (const r of ev) byEvent[r.event] = (byEvent[r.event] || 0) + 1;
  const order = ['page_viewed','email_entered','cta_clicked','role_selected','template_used','message_written','create_clicked','video_started','video_created','preview_opened','share_clicked','share_completed','share_page_opened','review_clicked'];
  tbl(order.filter(e => byEvent[e] != null).map(e => `${e.padEnd(20)} ${byEvent[e]}`));
  const extra = Object.keys(byEvent).filter(e => !order.includes(e));
  if (extra.length) tbl(extra.map(e => `${e.padEnd(20)} ${byEvent[e]}  (non-canonical!)`));

  // 2. Review clicks by phase × role × source (every button)
  console.log('\n2. REVIEW CLICKS by phase × role × source (the full coverage map):');
  const rc = ev.filter(r => r.event === 'review_clicked');
  const key = r => `${(r.phase||'?').padEnd(14)} ${(r.role||'?').padEnd(9)} ${r.source||'(none)'}`;
  const grp = {};
  for (const r of rc) grp[key(r)] = (grp[key(r)] || 0) + 1;
  if (Object.keys(grp).length) tbl(Object.entries(grp).sort((a,b)=>b[1]-a[1]).map(([k,c]) => `${k.padEnd(46)} ${c}`));
  else console.log('   (no review clicks yet)');
  console.log(`   --- total review clicks: ${rc.length}`);

  // 3. Role split across all events
  console.log('\n3. ROLE split (all events):');
  const byRole = {};
  for (const r of ev) byRole[r.role||'unknown'] = (byRole[r.role||'unknown'] || 0) + 1;
  tbl(Object.entries(byRole).map(([k,c]) => `${k.padEnd(10)} ${c}`));

  // 4. True video counts (video_sessions = ground truth) vs logged video_created
  console.log('\n4. VIDEOS (ground truth from video_sessions):');
  const vs = await fetchAll('video_sessions', 'status,created_at');
  const byStatus = {};
  for (const r of vs) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const complete = byStatus.complete || 0;
  tbl([`complete ${complete}`, `failed ${byStatus.failed||0}`, `pending ${byStatus.pending||0}`, `(logged video_created events: ${byEvent.video_created||0})`]);
  console.log(`   true success rate: ${vs.length ? Math.round(100*complete/vs.length) : 0}%`);

  console.log('\nDone. Query log_video_funnel_events directly for custom slices.\n');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
