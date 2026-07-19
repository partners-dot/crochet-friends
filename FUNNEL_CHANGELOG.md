# Funnel Changelog — Video Review App

Every change to the claim/create funnel, and what it did to the numbers. The point is
to optimize on **evidence, not vibes** — each entry records what we changed, why, and
the measured before/after so we never re-guess.

> New change? Add an entry under **Changes** the day it ships (status `SHIPPED`, with the
> baseline it started from). Come back ~1–2 weeks later, re-measure, and fill in **Result**.

---

## The funnel we track

Landing → finished video, measured in PostHog (project 303306), **test users filtered**:

```
claim_page_view  →  claim_email_submitted  →  claim_video_cta_clicked  →  Video Creation Started
   (landed)            (gave email)              (into create app)            (started a video)
```

Then inside the create app:

```
page_view → picked role → Message Written → Create Video Button Clicked → Video Creation Started
```

**Anchor "finished" on `Video Creation Started`, not `video_created`.** `video_created`
under-reports in PostHog (it lost its client-side trigger when we moved to email-first
delivery) — server-side, almost everyone who *starts* a video completes it. Use
`Video Creation Started` as the honest finish line.

### The noise floor — read this before grading anything

At ~12–16 landers/day a two-week window holds only ~100–200 people per step. **At that
size, only swings of roughly 13–20 points can be told apart from luck.** Proving a
6-point change would need ~1,000 people per window — over two months of traffic.

Consequences, learned the hard way (2026-07-16, an automated cycle graded a noise-level
swing as a win using an unreproducible baseline):

1. **Never write "worked" or "worse" without running the test:**
   `node tools/significance.mjs <before_conv> <before_total> <after_conv> <after_total>`
   Paste its output next to the verdict. No stats, no verdict.
2. **Always quote raw counts with a rate** — "42% (38 of 91)", never a bare percentage.
3. **Freeze both windows** with `--until=YYYY-MM-DD` so any number can be re-derived
   exactly by anyone who wants to check you.
4. **"Not yet measurable" is a respected verdict.** Entries may stay pending for several
   cycles; forcing a verdict to look productive is the worst thing you can do here,
   because a false ✅ becomes the next cycle's baseline.
5. **Prefer bold, structural changes** — remove a step, change what's asked and when.
   A small copy tweak can never be proven to work at this traffic. Polish is allowed,
   but must be labelled *unmeasurable by design* and never later claimed as a tested win.

### How to re-measure
- **App funnel (rates):** PostHog → `query-funnel` on the events above, `filterTestAccounts: true`.
- **Email flow (open/click per email):** `node scripts/klaviyo-metrics.js`.
- **Test emails to exclude:** `ori@mtlbrands.com`, `partners@gotyoualittlesomething.com`
  (PostHog's test-account filter should already catch these; double-check on small samples).

### Watch-outs when reading results
- **Low volume = noisy.** ~12–16 landers/day. A swing of a few points on a 3-week window
  can be noise. Trust big effects on enough data; treat small ones as "flat."
- **Traffic ≠ conversion.** QR-scan volume moves with product-insert shipments and season —
  compare **rates**, not raw counts.
- **Review clicks lag video creation** (email reminders arrive days later) — never judge a
  same-week review/video ratio; average over a multi-week window.

---

## Baseline snapshot — 2026-07-06

The numbers a new change has to beat. (PostHog, test-filtered.)

| Stage | Rate |
|---|---|
| Landed → gave email | **~43%** |
| Gave email → into app | ~97% (auto-forward) |
| Into app → **started a video** | **~30–41%** |
| Landed → started a video (end-to-end) | **~13%** |
| Started video → review click | ~⅓ (≈32%), almost all from the in-app thank-you screen |

Inside the create app, every step roughly halves: arrived → role (56%) → wrote message
(32%) → hit create (16%) → started (15%). The heaviest single drop is **writing the
message**.

---

## Changes

### 2026-07-16 · Complete the Supabase log + env-based PostHog tool — `INFRA`
**Files:** `claim.html`, `index.html`, `analytics-events.js`, `tools/*` · **Targets:** measurement, not conversion

**What & why.** Groundwork for the biweekly automated optimizer (runs as a ROS cron):
1. **Four missing funnel steps now land in `log_video_funnel_events`:** `page_viewed` +
   `cta_clicked` (phase=claim — the top-of-funnel denominator was PostHog-only) and
   `message_written` + `create_clicked` (phase=in_app). Our own log can now compute
   land→video end-to-end without PostHog. Rates from these events start 2026-07-16.
2. **`tools/posthog-funnel.mjs`** — PostHog query tool with the key from env (no hardcoded
   keys); `presets` mode runs the two canonical funnels test-filtered. NOTE: in the in-app
   ordered funnel, `Create Video Button Clicked` fires just BEFORE `Message Written` (same
   handler since the Jul-6 change) — funnel steps must be in that order or the create step
   silently undercounts (17 vs 41 in the same 14d window).
3. **All tools read env vars first, `.env` file second** — they now run on a fresh clone.

**Result:** n/a (measurement infra; no user-facing change). Verified live in a local browser:
all 4 new events landed in the table with correct phase/role/properties; test rows deleted.

---

### 2026-07-06 · Kill the message-step friction — `SHIPPED`
**File:** `index.html` · **Targets:** into-app → started video (esp. role → message → create)

**What & why.** The create screen was the biggest leak for our *warmest* users (already
gave email, promised a free video). Two friction landmines removed:
1. **Blank message box** → now pre-filled with a ready-to-send, on-brand default matched to
   the role (thank-you vs. greeting) and character. No more blank-box paralysis.
2. **The `NAME` landmine** → templates said `"Happy Birthday, NAME!"` and a browser alert
   *blocked* submission until the user retyped it. Now templates read naturally with
   `"friend"`, and any stray `NAME` is silently fixed on submit. Nobody can dead-end.

**Baseline it starts from:** into-app → started video **~41%** (post-Jun-16); end-to-end
land → video **~15%**.

**Result — `NOT YET MEASURABLE` (graded 2026-07-19, stays pending):**

| Metric (PostHog, test-filtered, frozen windows) | Before (14d → Jul 5) | After (14d → Jul 19) | Change |
|---|---|---|---|
| Arrived in app → started a video | 35.7% (40 of 112) | 41.8% (38 of 91) | +6.1 pts |
| Wrote message → started a video | 97.6% (40 of 41) | 100% (38 of 38) | +2.4 pts |

```
$ node tools/significance.mjs 40 112 38 91
change : +6.0 points   (95% range: -7.4 to 19.5 points)
p-value: 0.379
VERDICT: NOT SIGNIFICANT — indistinguishable from noise (p = 0.38).
         These samples could only have detected a swing of ~19 points or more.
         To call a 6-point difference, you'd need ~1016 per window (have 112 / 91).
```

**Verdict: not yet measurable — and possibly never.** The direction is encouraging but the
swing is well inside the noise floor. Two honest caveats: the "message-writers now finish"
story does **not** hold up — that step was already at 97.6% before the change, so it was
never the leak; and the real in-app drop is *arrival → pressing Create* (45%, 34 of 76 in
the Jul-5 window), which contains the role-pick and message steps together.

⚠️ **Precedent for every future grading:** an automated cycle first graded this entry
"WORKED, 31%→43%". The 31% baseline could not be reproduced (the real figure was 35.7%),
which doubled the apparent win, and the +6 points was noise either way. **No verdict of
worked/worse may be written without `tools/significance.mjs` output pasted beside it.**

---

### 2026-06-16 · Email-first delivery + value-prop hero + email-skip — `MEASURED ✅`
**Files:** `index.html`, `api/generate-video.js` · **Targets:** into-app → started video

**What & why.** Removed the fragile 5-minute client polling loop (delivered the video by
email instead, with a "📧 Check your email" screen), added a value-prop hero on the welcome
screen, and let claim users skip the in-app email step. Also moved `video_created` logging
server-side to fix a phantom mobile undercount.

**Result — real lift, held up over 3 weeks:**

| Metric | Before (May 1–Jun 15) | After (Jun 16–Jul 6) | Change |
|---|---|---|---|
| Into-app → started video | 27.2% | **41.1%** | ✅ +14 pts (+51%) |
| Landed → started video | 11.8% | **15.4%** | ✅ +3.6 pts (+31%) |
| Landed → gave email | 44.5% | 39.0% | 🔻 flat/−5.5 pts (within noise) |

**Verdict:** the win landed exactly where it aimed (getting warm users to actually start a
video). Claim-page email capture did **not** improve — that's the next target.

---

### 2026-06-15 · Durable funnel event log + review-click tracking fix — `INFRA`
**Files:** `api/track.js`, `analytics-events.js`, all 4 pages · **Targets:** measurement, not conversion

Added `send_instantly` to review-click captures (so the Amazon tab nav can't drop the
event) and a durable Supabase event log (`log_video_funnel_events`) so future optimization
is a query, not an investigation. No conversion change expected — this is the measurement
foundation these entries rely on.

---

## Open targets (next levers)

1. **Claim-page email capture (~40%, flat).** The biggest top-of-funnel loss and unmoved by
   past attempts. 60% of people who scan the QR never enter an email.
2. **Preview / post-share review asks (~0% clicks).** Almost all review clicks come from the
   in-app thank-you screen; the preview and share surfaces produce basically none.
3. **Welcome/entry drop (arrived → picked role, ~44% lost).** The first interaction inside
   the app still sheds nearly half.
