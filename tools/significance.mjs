// significance.mjs — "is this difference real, or is it noise?"
//
// WHY THIS EXISTS. On 2026-07-16 an automated cycle graded the Jul-6 message-step fix
// as "WORKED — 31%→43%". Independently re-derived, the true numbers were 36%→42%
// (40/112 → 38/91): a +6 point swing with a p-value of 0.38 — i.e. a coin-flip's
// worth of evidence. The changelog's prose warning ("small swings are noise") did not
// stop it. So the rule is now arithmetic, not advice: no verdict of "worked" without
// this tool printing SIGNIFICANT.
//
//   node tools/significance.mjs <before_converted> <before_total> <after_converted> <after_total>
//   node tools/significance.mjs 40 112 38 91
//
// Prints both rates, the difference, the p-value, a verdict, and — when the result is
// inconclusive — how much more data would be needed to call it either way.
//
// Two-proportion z-test, two-sided. Deliberately simple and auditable: the funnel is
// a series of "N people arrived, K continued" steps, which is exactly what this tests.

const [bc, bt, ac, at] = process.argv.slice(2).map(Number);
if ([bc, bt, ac, at].some((n) => !Number.isFinite(n)) || bt <= 0 || at <= 0) {
  console.error('Usage: node tools/significance.mjs <before_converted> <before_total> <after_converted> <after_total>');
  console.error('   e.g. node tools/significance.mjs 40 112 38 91');
  process.exit(1);
}
if (bc > bt || ac > at) { console.error('Converted cannot exceed total.'); process.exit(1); }

const erfc = (x) => {
  // Numerical Recipes 6.2.2 — accurate to ~1.2e-7, plenty for a noise gate.
  const z = Math.abs(x), t = 2 / (2 + z);
  const ty = 4 * t - 2;
  const cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
    -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5,
    -2.0278578112534e-5, -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8];
  let d = 0, dd = 0;
  for (let j = cof.length - 1; j > 0; j--) { const tmp = d; d = ty * d - dd + cof[j]; dd = tmp; }
  const ans = t * Math.exp(-z * z + 0.5 * (cof[0] + ty * d) - dd);
  return x >= 0 ? ans : 2 - ans;
};
const pValue = (z) => erfc(Math.abs(z) / Math.SQRT2);

const p1 = bc / bt, p2 = ac / at;
const pooled = (bc + ac) / (bt + at);
const se = Math.sqrt(pooled * (1 - pooled) * (1 / bt + 1 / at));
const z = se > 0 ? (p2 - p1) / se : 0;
const p = pValue(z);
const diffPts = (p2 - p1) * 100;

// 95% CI on the difference (unpooled SE — the honest interval for the effect size).
const seDiff = Math.sqrt((p1 * (1 - p1)) / bt + (p2 * (1 - p2)) / at);
const lo = diffPts - 1.96 * seDiff * 100, hi = diffPts + 1.96 * seDiff * 100;

// Smallest difference these sample sizes could have detected (80% power, 5% level).
const nAvg = (bt + at) / 2;
const mde = 2.8 * Math.sqrt((2 * pooled * (1 - pooled)) / nAvg) * 100;
// Sample size per window needed to detect the observed difference, if it is real.
const needed = Math.abs(p2 - p1) > 0
  ? Math.ceil((2 * Math.pow(2.8, 2) * pooled * (1 - pooled)) / Math.pow(p2 - p1, 2))
  : Infinity;

const pct = (x) => `${(100 * x).toFixed(1)}%`;
console.log(`before : ${bc}/${bt} = ${pct(p1)}`);
console.log(`after  : ${ac}/${at} = ${pct(p2)}`);
console.log(`change : ${diffPts >= 0 ? '+' : ''}${diffPts.toFixed(1)} points   (95% range: ${lo.toFixed(1)} to ${hi.toFixed(1)} points)`);
console.log(`p-value: ${p.toFixed(3)}`);
console.log('');

if (p < 0.05) {
  console.log(`VERDICT: SIGNIFICANT — a swing this size is unlikely (${(p * 100).toFixed(1)}% odds) to be chance.`);
  console.log(`         "worked" (or "worse") is a permitted verdict for this metric.`);
} else {
  console.log(`VERDICT: NOT SIGNIFICANT — this is indistinguishable from noise (p = ${p.toFixed(2)}).`);
  console.log(`         You may NOT call this "worked" or "worse". Use "not yet measurable" (keep`);
  console.log(`         the entry pending and re-grade next cycle) or "flat".`);
  console.log(`         These samples could only have detected a swing of ~${mde.toFixed(0)} points or more.`);
  if (Number.isFinite(needed)) {
    console.log(`         To call a ${Math.abs(diffPts).toFixed(0)}-point difference, you'd need ~${needed} per window (have ${bt} / ${at}).`);
  }
}
