// posthog-funnel.mjs — query PostHog (project 303306) from the command line, key from env.
// Built for the biweekly funnel-optimizer agent: PostHog holds the ONLY record of
// claim_page_view history (pre Jul-2026) and the in-app micro-steps; the Supabase log
// (tools/funnel-report.mjs) is the durable second source. Cross-check both.
//
//   node tools/posthog-funnel.mjs presets 14                       # the two canonical funnels + review trend, last 14d
//   node tools/posthog-funnel.mjs funnel 14 claim_page_view claim_email_submitted "Video Creation Started"
//   node tools/posthog-funnel.mjs trend 14 claim_page_view "Amazon Review Link Clicked"
//   node tools/posthog-funnel.mjs hogql "select event, count() from events where timestamp > now() - interval 14 day group by event order by count() desc limit 20"
//
// Env: POSTHOG_API_KEY (personal API key, query scope — REQUIRED; never hardcode keys here),
//      POSTHOG_PROJECT_ID (default 303306), POSTHOG_HOST (default https://us.posthog.com).
// process.env first, root .env file fallback. All funnel/trend queries set
// filterTestAccounts: true (test users are configured in PostHog project settings).

import { readFileSync } from 'fs';

const E = { ...process.env };
try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const l of env.split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !E[m[1]]) E[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
} catch { /* no .env file */ }

// Absorb quoting/whitespace/CR footguns (quoted .env values, Windows CRLF, copy-paste).
const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '');
const KEY = clean(E.POSTHOG_API_KEY);
const PROJECT = clean(E.POSTHOG_PROJECT_ID) || '303306';
const HOST = clean(E.POSTHOG_HOST) || 'https://us.posthog.com';
if (!KEY) { console.error('Missing POSTHOG_API_KEY (personal API key with query scope).'); process.exit(1); }

async function phQuery(query) {
  const r = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`PostHog ${r.status}: ${(await r.text()).slice(0, 500)}`);
  return r.json();
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');

async function runFunnel(days, events, title = null) {
  const res = await phQuery({
    kind: 'FunnelsQuery',
    series: events.map((e) => ({ kind: 'EventsNode', event: e })),
    dateRange: { date_from: `-${days}d` },
    filterTestAccounts: true,
    funnelsFilter: { funnelWindowInterval: 14, funnelWindowIntervalUnit: 'day' },
  });
  console.log(`\n== FUNNEL${title ? ` · ${title}` : ''} (last ${days}d, test accounts filtered, 14d window) ==`);
  const steps = Array.isArray(res.results) ? res.results : [];
  if (!steps.length) { console.log('  (no results)'); console.log(JSON.stringify(res).slice(0, 400)); return; }
  const first = steps[0]?.count ?? 0;
  steps.forEach((s, i) => {
    const prev = i ? steps[i - 1].count : null;
    console.log(`  ${String(i + 1)}. ${(s.custom_name || s.name || events[i]).padEnd(34)} ${String(s.count).padStart(6)}   of-first ${pct(s.count, first).padStart(4)}   of-prev ${i ? pct(s.count, prev) : '   —'}`);
  });
}

async function runTrend(days, events) {
  const res = await phQuery({
    kind: 'TrendsQuery',
    series: events.map((e) => ({ kind: 'EventsNode', event: e, math: 'dau' })), // unique users
    dateRange: { date_from: `-${days}d` },
    interval: 'week',
    filterTestAccounts: true,
  });
  console.log(`\n== TREND — unique users/week (last ${days}d, test accounts filtered) ==`);
  for (const s of res.results || []) {
    const label = s.label || s.action?.name || '?';
    const pairs = (s.days || []).map((d, i) => `${d.slice(5)}:${s.data[i]}`).join('  ');
    console.log(`  ${label}\n    ${pairs}   (total ${s.count})`);
  }
}

async function runHogql(q) {
  const res = await phQuery({ kind: 'HogQLQuery', query: q });
  console.log((res.columns || []).join(' | '));
  for (const row of res.results || []) console.log(row.map((v) => (v === null ? '∅' : String(v))).join(' | '));
}

// The two canonical funnels from FUNNEL_CHANGELOG.md ("The funnel we track").
// NOTE: the in-app role-pick event has a dynamic name ('User Selected - …') so the
// app preset uses the stable steps around it. Anchor "finished" on Video Creation
// Started — NEVER video_created (lost its client trigger; under-reports).
const PRESETS = (days) => [
  runFunnel(days, ['claim_page_view', 'claim_email_submitted', 'claim_video_cta_clicked', 'Video Creation Started'], 'CLAIM → VIDEO (land → finish)'),
  // Step order = actual firing order: since PR #11 (Jul 2026) 'Create Video Button
  // Clicked' fires immediately BEFORE 'Message Written' in the same handler — an
  // ordered funnel with message-first silently undercounts the create step.
  runFunnel(days, ['page_view', 'Create Video Button Clicked', 'Message Written', 'Video Creation Started'], 'IN-APP (arrived → finish)'),
  runTrend(days, ['claim_page_view', 'Video Creation Started', 'Amazon Review Link Clicked']),
];

(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'presets') {
    const days = parseInt(rest[0] || '14', 10);
    for (const p of PRESETS(days)) await p;
  } else if (mode === 'funnel') {
    const days = parseInt(rest[0] || '14', 10);
    await runFunnel(days, rest.slice(1));
  } else if (mode === 'trend') {
    const days = parseInt(rest[0] || '14', 10);
    await runTrend(days, rest.slice(1));
  } else if (mode === 'hogql') {
    await runHogql(rest.join(' '));
  } else {
    console.log('Usage: node tools/posthog-funnel.mjs presets|funnel|trend <days> [events...] | hogql "<query>"');
    process.exit(1);
  }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
