# Funnel Optimization Cycle Log

> A running log of measured before/after on the video funnel, one entry per optimization
> cycle. **Read `ANALYTICS.md` first** (it explains the two data streams and the trust rules).
> The point of this file: each cycle records a dated baseline + method so the *next* agent
> can re-run the exact same measurement and see whether the last batch of changes held up.

## How to measure a cycle (reproducible method)

1. **Truth for "videos made"** = Supabase `video_sessions` (status filter), **never** PostHog
   `video_created` — that event undercounts badly post-change (client polling was removed; it now
   logs server-side to `log_video_funnel_events`). Query windowed by `created_at` (full-table
   `select('*')` times out — always filter server-side). Anon key is in crochet `.env`
   (`SUPABASE_URL` / `SUPABASE_ANON_KEY`).
2. **Upstream funnel + review clicks history** = PostHog (project 303306), via the **PostHog MCP**
   (`https://mcp.posthog.com/mcp`, OAuth — run `/mcp` → posthog → Authenticate). The old `phx_`
   personal keys are dead; the `phc_` key in code is write-only and can't query.
3. **Filter test accounts.** PostHog does **not** filter them. Test emails to exclude everywhere:
   `ori@mtlbrands.com`, `partners@gotyoualittlesomething.com`, plus junk `o@n.`, `k@k.`,
   `probe@test.local`. The `Amazon Review Link Clicked` event carries an `email` event property,
   so you can filter in HogQL: `lower(coalesce(properties.email,'')) IN (...)`.
4. **Upstream funnel query** (PostHog `query-funnel`, `filterTestAccounts: true`), steps:
   `claim_page_view → claim_email_submitted → claim_video_cta_clicked → Video Creation Started`.
   Run it **week by week** (don't trust a single window — see the 2026-06-24 correction below).
5. **Review-to-video ratio** = real `Amazon Review Link Clicked` (PostHog, test-filtered) ÷ real
   videos made (`video_sessions`). NOTE review clicks **lag** video creation (email reminders fire
   days later), so average over a multi-week window; same-week ratios bounce (one week showed >100%).

---

## Cycle 1 — email-first delivery + Lever 3 + claim redesign (shipped ~2026-06-15/16)

**Changes shipped (crochet PRs #1–#9):** review-click `send_instantly` tracking; durable Supabase
funnel log; per-SKU correct review link; **email-first delivery (removed the 5-min mobile poll;
video delivered by email; review ask became the in-app thank-you hero)**; **Lever 3 (value-prop
first screen + skip the duplicate in-app email ask)**; **claim two-reward layout (to lift email
capture)**; server-side `video_created` logging.

**What each change was trying to move:**
- Claim two-reward layout (#8) → **lift claim-page email capture** (baseline ~37–44%).
- Lever 3 + email-first (#7, #5) → **lift the email → video-started leak** (the #1 historical drop).
- Server-side logging (#5, #9) → **fix the phantom `video_created` undercount**.
- Review hero (#5) → review ask prominence.

### Baseline measured 2026-06-24 (weekly upstream funnel, PostHog, test-filtered)

| Week | Claim views | Email capture | Into-app → **video started** | Overall view → started |
|---|---|---|---|---|
| Apr 26 | 107 | 39% | 34% (14/41) | 13.1% |
| May 3 | 161 | 39% | 27% (16/60) | 9.9% |
| May 10 | 213 | 44% | 27% (25/92) | 11.7% |
| May 17 | 97 | 48% | 30% (14/46) | 14.4% |
| May 24 | 97 | 46% | 36% (15/42) | 15.5% |
| May 31 | 83 | 45% | 28% (10/36) | 12.1% |
| Jun 7–15 | 79 | 44% | 18% (6/34) | 7.6% |
| **Jun 16–24 (post-change)** | 135 | 41% | **41% (22/54)** | **16.3%** |

### Verdict (consistency-checked across 7 prior weeks)

- ✅ **Into-app → video-started: real, consistent lift.** Post-change 41% beats **every** pre-change
  week (prior range 18–36%, avg ~29%). Honest magnitude ≈ **+40% relative** (29% → 41%).
  ⚠️ Do **not** repeat the earlier "2.3×/doubling" claim — that was an artifact of comparing only to
  the weakest pre-change week (Jun 7–15 @ 18%). Corroborated by ground truth: real videos 6 → 25.
- ⚠️ **Claim email capture: flat** (39–48% across all weeks; post 41% sits mid-range). **PR #8 did
  not move its target.** → open lever.
- ✅ **`video_created` undercount: fixed** (now 100% and matches `video_sessions`).
- ⚪ **Review-to-video ratio: flat** at ~⅓ (pre 45/135 ≈ 33% vs post ~8–9/25 ≈ 32–35%). All clean
  review clicks come from the in-app thank-you screen; **preview + post-share surfaces produce ~0**.
  → open lever.

### Open levers for the NEXT cycle
1. **Claim-page email capture** (~42%, PR #8 didn't help — try a different approach).
2. **Review ask on preview + post-share pages** (~0 clicks today — everything rides on the thank-you screen).

### For the next agent (target re-check ~2026-07-08)
Re-run the weekly upstream funnel (method above) and add a Cycle-2 entry. Watch:
- Does into-app → started **hold ≥40%** over the following 2–3 full weeks (proving Cycle 1 stuck)?
- Did whatever Cycle 2 ships move **email capture** above its ~42% ceiling, or get **preview/share
  review clicks** off zero?
