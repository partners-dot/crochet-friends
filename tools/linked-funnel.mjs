// linked-funnel.mjs — conversion between two funnel steps, LINKED BY PERSON.
//
// WHY THIS EXISTS. `funnel-report.mjs` prints event COUNTS. Dividing one count by
// another looks like a conversion rate and is not one: if the denominator's size or
// composition shifts between windows, the ratio moves on its own. On 2026-07-19 an
// automated cycle did exactly that — role_selected vs video_started counts gave
// "42.9% → 63.5%, p=0.013, WORKED", while the same steps linked per-person were
// 61% → 63% (flat). The denominator had fallen 24% and its make-up had changed
// (role-picks with no email attached: 35 → 9), so the two windows were never
// comparable. A p-value cannot detect that; only linking can.
//
//   node tools/linked-funnel.mjs <from_event> <to_event> <days> [--until=YYYY-MM-DD]
//   node tools/linked-funnel.mjs role_selected video_started 14 --until=2026-07-19
//   node tools/linked-funnel.mjs role_selected video_started 14 --compare   # vs prior window
//
// A person is identified by email, falling back to operation_id. Rows with neither are
// UNLINKABLE and are reported separately — never silently dropped into the denominator.
// The "to" event counts only if it happens at or after the "from" event for that person.
//
// Env: SUPABASE_URL + SUPABASE_ANON_KEY (crochet project); process.env first, .env second.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const E = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY };
if (!E.SUPABASE_URL || !E.SUPABASE_ANON_KEY) {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const l of env.split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !E[m[1]]) E[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
  } catch { /* no .env */ }
}
if (!E.SUPABASE_URL || !E.SUPABASE_ANON_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY.'); process.exit(1); }
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY);

const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const positional = argv.filter((a) => !a.startsWith('--'));
const [fromEvent, toEvent] = positional;
const days = parseInt(positional[2] || '14', 10);
const COMPARE = argv.includes('--compare');
const KEEP_TEST = argv.includes('--keep-test');
if (!fromEvent || !toEvent) {
  console.error('Usage: node tools/linked-funnel.mjs <from_event> <to_event> <days> [--until=YYYY-MM-DD] [--compare]');
  process.exit(1);
}
const until = flag('until');
const untilMs = until ? Date.parse(`${until}T23:59:59Z`) : Date.now();
if (until && Number.isNaN(untilMs)) { console.error(`Bad --until=${until}`); process.exit(1); }

const TEST_EMAILS = new Set(['ori@mtlbrands.com', 'partners@gotyoualittlesomething.com']);
const isTest = (r) => { const e = (r.email || '').toLowerCase(); return TEST_EMAILS.has(e) || /^(o@n\.|k@k\.|probe@test\.local)/.test(e); };
const who = (r) => (r.email ? `e:${r.email.toLowerCase()}` : (r.operation_id ? `o:${r.operation_id}` : null));

async function fetchWindow(startMs, endMs) {
  let out = [], from = 0, page;
  do {
    const { data, error } = await sb.from('log_video_funnel_events')
      .select('event,email,operation_id,created_at')
      .gte('created_at', new Date(startMs).toISOString())
      .lt('created_at', new Date(endMs).toISOString())
      .range(from, from + 999);
    if (error) { console.error('query error:', error.message); process.exit(1); }
    page = data || []; out = out.concat(page); from += 1000;
  } while (page.length === 1000);
  return KEEP_TEST ? out : out.filter((r) => !isTest(r));
}

async function analyse(endMs, label) {
  const rows = await fetchWindow(endMs - days * 864e5, endMs);
  const firstFrom = new Map(); // person -> earliest `from` timestamp
  let unlinkableFrom = 0, rawFrom = 0, rawTo = 0;
  for (const r of rows) {
    if (r.event === fromEvent) {
      rawFrom++;
      const id = who(r);
      if (!id) { unlinkableFrom++; continue; }
      const t = Date.parse(r.created_at);
      if (!firstFrom.has(id) || t < firstFrom.get(id)) firstFrom.set(id, t);
    } else if (r.event === toEvent) rawTo++;
  }
  const converted = new Set();
  for (const r of rows) {
    if (r.event !== toEvent) continue;
    const id = who(r);
    if (id && firstFrom.has(id) && Date.parse(r.created_at) >= firstFrom.get(id)) converted.add(id);
  }
  const den = firstFrom.size, num = converted.size;
  console.log(`\n== ${label} (${days}d ending ${new Date(endMs).toISOString().slice(0, 10)}) ==`);
  console.log(`  ${fromEvent} → ${toEvent}, linked per person`);
  console.log(`    ${num} of ${den} = ${den ? ((100 * num) / den).toFixed(1) : '—'}%`);
  console.log(`  raw event counts (DO NOT divide these): ${fromEvent}=${rawFrom}  ${toEvent}=${rawTo}`);
  if (unlinkableFrom) {
    const pctUn = Math.round((100 * unlinkableFrom) / (rawFrom || 1));
    console.log(`  ⚠️  ${unlinkableFrom} ${fromEvent} rows (${pctUn}%) had no email/operation_id — excluded, not counted as failures.`);
  }
  return { num, den, unlinkable: unlinkableFrom, rawFrom };
}

(async () => {
  const now = await analyse(untilMs, 'THIS WINDOW');
  if (!COMPARE) {
    console.log(`\nCompare windows with --compare, then test the difference:`);
    console.log(`  node tools/significance.mjs <before_num> <before_den> ${now.num} ${now.den}`);
    return;
  }
  const prior = await analyse(untilMs - days * 864e5, 'PRIOR WINDOW');
  console.log('\n== COMPARISON ==');
  console.log(`  before: ${prior.num}/${prior.den}   after: ${now.num}/${now.den}`);
  console.log(`  node tools/significance.mjs ${prior.num} ${prior.den} ${now.num} ${now.den}`);
  // Denominator-composition warning: the trap that produced the false July win.
  const shift = prior.den ? Math.abs(now.den - prior.den) / prior.den : 0;
  if (shift > 0.2) {
    console.log(`\n  ⚠️  DENOMINATOR MOVED ${Math.round(shift * 100)}% (${prior.den} → ${now.den}).`);
    console.log(`     The population being measured changed size between windows. Check WHY before`);
    console.log(`     reading the rate change as an effect of any shipped change — a shifting`);
    console.log(`     denominator moves a ratio on its own.`);
  }
  const unlShift = Math.abs((now.unlinkable / (now.rawFrom || 1)) - (prior.unlinkable / (prior.rawFrom || 1)));
  if (unlShift > 0.15) {
    console.log(`\n  ⚠️  UNLINKABLE SHARE CHANGED by ${Math.round(unlShift * 100)} pts between windows`);
    console.log(`     (${prior.unlinkable}/${prior.rawFrom} → ${now.unlinkable}/${now.rawFrom}). The tracking`);
    console.log(`     itself changed shape, so the two windows are not like-for-like.`);
  }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
