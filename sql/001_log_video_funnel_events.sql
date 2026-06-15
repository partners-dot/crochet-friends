-- Migration 001: log_video_funnel_events
-- Agent-ready event log for the crochet video funnel.
-- Runs in the CROCHET Supabase project (nhplsjtnvujwvspnbweo) — the one that holds video_sessions.
--
-- HOW TO APPLY: this project's .env has only the anon key (no service-role key), so this DDL
-- cannot be run from the app. Paste this whole file into the Supabase SQL editor for project
-- nhplsjtnvujwvspnbweo and run it once. It is idempotent (IF NOT EXISTS), safe to re-run.
-- Then confirm with:  node tools/verify-funnel-table.mjs
--
-- RLS NOTE: video_sessions in this project runs with RLS OFF (the app inserts with the anon key).
-- This table mirrors that model so /api/track and /api/review-redirect can insert with the anon
-- key exactly like they already do for video_sessions. No new sensitive data beyond the email,
-- which video_sessions already stores the same way.

CREATE TABLE IF NOT EXISTS public.log_video_funnel_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    timestamptz NOT NULL DEFAULT now(),
    event         text NOT NULL,             -- canonical name; see analytics-events.js EVENTS
    phase         text NOT NULL,             -- claim | in_app | preview | share | email_redirect
    role          text NOT NULL DEFAULT 'unknown',  -- buyer | receiver | unknown
    email         text,                      -- lowercased; null when not yet known (e.g. share page)
    operation_id  text,                      -- links to video_sessions; null on claim/email phases
    source        text,                      -- button/source: thankyou, video_preview_buyer, email, ...
    product       text,                      -- character/sku when known
    properties    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- freeform (message_length, share method, asin)
    user_agent    text                       -- for device split
);

COMMENT ON TABLE public.log_video_funnel_events IS
    'Agent-ready event log for the crochet QR-video funnel. One row per funnel action, classified by phase + role (buyer/receiver/unknown). Dual-streams with PostHog (PostHog = human dashboards, this table = agent/optimization source of truth). Written by /api/track and /api/review-redirect. See ANALYTICS.md.';

CREATE INDEX IF NOT EXISTS idx_lvfe_event        ON public.log_video_funnel_events (event);
CREATE INDEX IF NOT EXISTS idx_lvfe_phase_role   ON public.log_video_funnel_events (phase, role);
CREATE INDEX IF NOT EXISTS idx_lvfe_email        ON public.log_video_funnel_events (email);
CREATE INDEX IF NOT EXISTS idx_lvfe_operation_id ON public.log_video_funnel_events (operation_id);
CREATE INDEX IF NOT EXISTS idx_lvfe_created_at   ON public.log_video_funnel_events (created_at);

-- RLS left DISABLED to match video_sessions (the app uses the anon key to insert).
-- If you later enable RLS, add an INSERT policy for the anon role or the inserts will silently fail.
