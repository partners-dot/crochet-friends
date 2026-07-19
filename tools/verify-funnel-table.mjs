// Verifies log_video_funnel_events exists and is writable with the app's anon key.
// Run AFTER applying sql/001_log_video_funnel_events.sql in the Supabase SQL editor.
//   node tools/verify-funnel-table.mjs
// Env: SUPABASE_URL + SUPABASE_ANON_KEY — process.env first, root .env file fallback.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const E = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY };
if (!E.SUPABASE_URL || !E.SUPABASE_ANON_KEY) {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const l of env.split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !E[m[1]]) E[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
  } catch { /* no .env file */ }
}
if (!E.SUPABASE_URL || !E.SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY (set env vars or create a root .env).');
  process.exit(1);
}
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY);

const TABLE = 'log_video_funnel_events';
(async () => {
  // 1. table exists / readable?
  const read = await sb.from(TABLE).select('id').limit(1);
  if (read.error) {
    console.error(`❌ ${TABLE} not reachable: ${read.error.message}`);
    console.error('   → apply sql/001_log_video_funnel_events.sql in the Supabase SQL editor first.');
    process.exit(1);
  }
  console.log(`✅ ${TABLE} exists and is readable.`);

  // 2. insert a probe row (then delete) to confirm the app's anon key can write
  const probe = { event: '__probe__', phase: 'in_app', role: 'unknown', source: 'verify-script', properties: { probe: true } };
  const ins = await sb.from(TABLE).insert(probe).select();
  if (ins.error) {
    console.error(`❌ anon INSERT failed: ${ins.error.message}`);
    console.error('   → if you enabled RLS, add an INSERT policy for the anon role.');
    process.exit(1);
  }
  console.log('✅ anon INSERT works (id ' + ins.data[0].id + ').');
  await sb.from(TABLE).delete().eq('id', ins.data[0].id);
  console.log('✅ cleaned up probe row.');
  console.log('\nTable is ready for the funnel logger.');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
