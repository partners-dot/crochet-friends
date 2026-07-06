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

**Result (fill in ~2026-07-20):** _pending — re-run the app funnel and compare `Message Written`
and `Video Creation Started` vs baseline._

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
