# Analytics & Funnel Tracking — read this first

If you're here to **analyze or optimize the video funnel** (reviews, shares, conversion),
read this before touching anything. It exists so you don't have to re-derive how tracking
works (which once took a multi-hour investigation).

## The app in one paragraph

QR code on a product → `claim.html` (enter email) → `index.html` (pick role buyer/receiver,
write message, create an AI video) → redirect to `video-preview.html` (preview + share + "Leave a
Review"). The creator shares a link → the recipient opens `video.html` (watch + share + review).
Separately, **Klaviyo emails** (sent via the flow, not this repo's send path) nudge people back:
Email 5 & 6 carry a "Leave a Review" link that goes through `/api/review-redirect` straight to Amazon.

## Two parallel data streams (this is the key model)

| Stream | What it's for | Reliability |
|---|---|---|
| **Supabase `log_video_funnel_events`** | **Agent / optimization source of truth.** Query it with SQL. | Durable. Written server-side via `/api/track`. |
| **PostHog** (project 303306) | **Human dashboards & funnels.** | Fragile — events drop on mobile, get renamed, lag on ingest. Good for charts, not for truth. |

**Rule of thumb:** for any number you'll *act on*, trust Supabase. Use PostHog to visualize.
This mirrors how `video_sessions` (not PostHog `video_created`) is the truth for "did a video get made."

## `log_video_funnel_events` (the table to query)

Lives in the **crochet Supabase project** (`nhplsjtnvujwvspnbweo`) alongside `video_sessions`.
**NOT** the ROS production DB. One row per funnel action.

Columns: `event, phase, role, email, operation_id, source, product, properties (jsonb), user_agent, created_at`.

- **`event`** — one of (canonical, defined in `analytics-events.js`):
  `page_viewed, email_entered, cta_clicked, role_selected, template_used, message_written,
  create_clicked, video_started, video_created, preview_opened, share_clicked, share_completed,
  share_page_opened, review_clicked`
  (`page_viewed`/`cta_clicked` phase=claim and `message_written`/`create_clicked` phase=in_app
  were added 2026-07-16 — before that date those steps exist ONLY in PostHog, so top-of-funnel
  rates from this table start then.)
- **`phase`** — `claim | in_app | preview | share | email_redirect`
- **`role`** — `buyer | receiver | unknown` (never null, never guessed; resolved from `video_sessions`)
- **`source`** — the specific button: `thankyou, strong, video_preview_buyer, video_preview_receiver,
  video_share_buyer, video_share_receiver, email, claim_page`

### Every review-click touchpoint (full coverage)

| phase | role surface | source value |
|---|---|---|
| in_app | buyer & receiver (thank-you screen) | `thankyou`, `strong` |
| preview | buyer button | `video_preview_buyer` |
| preview | receiver button | `video_preview_receiver` |
| share | buyer button | `video_share_buyer` |
| share | receiver button | `video_share_receiver` |
| email_redirect | from Email 5/6 link | `email` |

## How to analyze (do this, not ad-hoc queries)

```
node tools/funnel-report.mjs        # all-time funnel + review-by-phase×role×source + true video counts
node tools/funnel-report.mjs 30     # last 30 days
node tools/verify-funnel-table.mjs  # confirm the table exists + is writable
node tools/posthog-funnel.mjs presets 14   # PostHog side: the two canonical funnels + weekly trend
```
All tools read `SUPABASE_URL`/`SUPABASE_ANON_KEY` (and `POSTHOG_API_KEY` for the PostHog one)
from process.env first, root `.env` file second — so they run on a fresh clone with env vars only.
Or query `log_video_funnel_events` directly for custom slices (e.g. "do email-sourced buyers
convert to review better than share-page receivers?" = filter `event='review_clicked'` group by
`phase, role`).

## Conventions — don't invent names

`analytics-events.js` is the single source of truth for event / phase / role / source strings.
**Add a new event there first, then use the constant.** A silent rename
(`Review Link Clicked` → `Amazon Review Link Clicked`) once broke every review dashboard — that's
the failure this module prevents. The one PostHog review event is `REVIEW_EVENT` =
`'Amazon Review Link Clicked'`.

## How logging is wired (where to add more)

- **Server chokepoint:** `api/track.js` accepts `{event, phase, role?, email?, operationId?, source?,
  product?, properties?}`, resolves `role` from `video_sessions`, inserts the row, and (for
  review/share) updates Klaviyo. It also still accepts the legacy `{operationId, action}` shape.
- **Client:** each page has a small `logFunnel(event, {source, properties})` helper that POSTs to
  `/api/track` alongside the existing `posthog.capture`. To log a new event, call `logFunnel`.
- **Email path:** `api/review-redirect.js` writes the Supabase row + a server-side PostHog event +
  the Klaviyo update, then 302s to Amazon.

## PostHog dashboards (for humans)

- **Canonical 30-day:** dashboard **1458562** — "MASTER FUNNEL".
- **All-time / since launch:** dashboard **1714708** — has best-truth note tiles.
- (A duplicate broken dashboard 1321805, which read the dead `Review Link Clicked` event, was deleted.)

## Known caveats (historical data)

- **PostHog `video_created` undercounts ~60%** historically — it fired client-side after a long
  mobile poll that often died. Real video counts = `video_sessions` (status='complete').
- **Review clicks before 2026-06-15** were intermittently dropped (fixed by `send_instantly`).
  Clean comparison starts 2026-06-15.
- **`log_video_funnel_events` starts collecting at deploy** — no backfill. Pre-deploy history lives
  in PostHog/Klaviyo with the caveats above.
- **Email review clicks** historically lived only in Klaviyo; from this deploy they also land in
  Supabase (`phase=email_redirect`) and PostHog (`page=email`).

## Out of scope here

This is the *measurement* layer. Flow/UX optimization (e.g. the review ask sits below the share
button on the preview page, which suppresses preview-page review clicks) is the *next* phase —
this table is what you'll measure it with.
