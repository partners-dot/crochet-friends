/* analytics-events.js — SINGLE SOURCE OF TRUTH for funnel analytics names.
 *
 * Add a new event? Add it HERE first, then use the constant. NEVER invent an
 * event/phase/source string inline — that drift is exactly what made the review
 * metric un-analyzable (a "Review Link Clicked" vs "Amazon Review Link Clicked"
 * rename silently broke dashboards). See ANALYTICS.md.
 *
 * Used by: api/track.js, api/review-redirect.js (import), and mirrored as inline
 * constants in the HTML pages' <script> (kept in sync by hand — small + stable).
 */

// Canonical funnel events written to Supabase log_video_funnel_events.
export const EVENTS = {
  PAGE_VIEWED:       'page_viewed',       // top-of-funnel: a funnel page rendered (phase says which)
  EMAIL_ENTERED:     'email_entered',
  CTA_CLICKED:       'cta_clicked',       // claim page "create your video" button
  ROLE_SELECTED:     'role_selected',
  TEMPLATE_USED:     'template_used',
  MESSAGE_WRITTEN:   'message_written',   // in-app: message finalized (create form submitted)
  CREATE_CLICKED:    'create_clicked',    // in-app: Create Video button pressed
  VIDEO_STARTED:     'video_started',
  VIDEO_CREATED:     'video_created',
  PREVIEW_OPENED:    'preview_opened',
  SHARE_CLICKED:     'share_clicked',
  SHARE_COMPLETED:   'share_completed',
  SHARE_PAGE_OPENED: 'share_page_opened',
  REVIEW_CLICKED:    'review_clicked',
};

// Which surface the event happened on.
export const PHASES = {
  CLAIM:          'claim',          // claim.html (QR landing)
  IN_APP:         'in_app',         // index.html (create video + thank-you)
  PREVIEW:        'preview',        // video-preview.html (creator previews/shares)
  SHARE:          'share',          // video.html (recipient opens shared link)
  EMAIL_REDIRECT: 'email_redirect', // /api/review-redirect (Email 5/6 → Amazon)
};

// Role classification — never null, never guessed.
export const ROLES = { BUYER: 'buyer', RECEIVER: 'receiver', UNKNOWN: 'unknown' };

// The ONE PostHog event name for a review click. Do not create variants.
export const REVIEW_EVENT = 'Amazon Review Link Clicked';

// Known `source` values (the specific button / origin).
export const SOURCES = {
  IN_APP_THANKYOU:  'thankyou',
  IN_APP_STRONG:    'strong',
  PREVIEW_BUYER:    'video_preview_buyer',
  PREVIEW_RECEIVER: 'video_preview_receiver',
  SHARE_BUYER:      'video_share_buyer',
  SHARE_RECEIVER:   'video_share_receiver',
  EMAIL:            'email',   // generic; email_5 vs email_6 split deferred
};

// Normalize a raw user_type into a valid ROLE (defensive).
export function normalizeRole(raw) {
  if (raw === ROLES.BUYER || raw === ROLES.RECEIVER) return raw;
  return ROLES.UNKNOWN;
}
