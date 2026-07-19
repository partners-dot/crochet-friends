# Funnel Context — what this funnel is FOR, and what it costs to change it

> `ANALYTICS.md` says where the data lives. `FUNNEL_CHANGELOG.md` says what we tried and
> what happened. **This file says what the business is actually doing** — the promise the
> customer was made before they ever reached us, the mechanics behind each reward, and
> what breaks if you "optimize" a step without understanding why it exists.
>
> Read this before proposing any change to the claim page or the email gate.

## The journey starts OFF the website

The promise is **printed on the product box**. The customer reads it after buying a
crocheted gift on Amazon. This is the exact wording (owner-supplied, 2026-07-19):

> **did this potato make you smile?**
> **scan to enjoy 15% off your next order**
> [ QR code ]
> **there's a spud for anybud**

There is **also a printed insert card carrying similar content** (same offer, same voice),
so most scanners meet this promise twice — once on the box, once on the card. Treat the
promise as well-established in the customer's mind by the time they scan.

**This print CANNOT be changed in the near term.** It is a fixed input. Every optimization
must adapt the *page* to the box — never assume the box or card can be reworded to match a
page.

What the box establishes, and what it does not:

- **The call-to-action is the discount** — that is the promise that makes someone pull out
  a phone and scan. It is the only reason anyone enters this funnel.
- **The discount is "15% off your next order"** — a repeat-purchase offer, and framed as
  small and easy, not as a prize to be won.
- **The personalized video is NOT mentioned anywhere on the box.** Nobody scans expecting
  it. On the page it is an unannounced bonus — which may be delightful, or may read as a
  bait-and-switch when it appears *before* the thing they actually came for.
- **The tone is warm, playful and light** ("there's a spud for anybud"). A page that answers
  that voice with a formal-feeling form is a tonal break as well as a friction point.

> ✅ **RESOLVED (owner, 2026-07-19): the real promo is 30%.** The print says 15%, so the
> box **under-promises and we over-deliver**. Nobody is let down — the opposite. Do NOT
> "fix" the page down to 15%, and do not treat the mismatch as a bug.
>
> **This is an unused asset.** Today the page simply announces "You've Got 30% Off" as if
> that were the deal all along, so the pleasant surprise is silently thrown away. Someone
> who scanned for 15% and is handed *double* has been given a reason to trust us in the
> first three seconds — the strongest possible answer to a promise, and currently invisible.
> Naming the gap out loud (in the box's own playful voice) is a live, untried candidate for
> the biggest leak in the funnel. It is untried ground, not a repeat of PR #8, because it
> changes what is SAID and WHEN value arrives, not how the page is laid out.

The QR link carries **only `?sku=<PRODUCT>`** (verified across all claim traffic: no
`code`, no `source` parameter ever arrives). Everything else — which discount, how it's
delivered — is decided by our own pages and by Klaviyo.

Products actually scanning in (last ~5 weeks, by volume): PTT-GREEN1 (64), PTT-FRIENDFUN
(28), PTT-CPCK1 (23), PTT-GREEN-DAD (19), PTT-SISFUN (11), then a long tail.

## The two rewards, and why email gates both

The claim page offers **30% off (the hero) + a free personalized video (the bonus)**. Both
are delivered by email:

- **The discount code is not on the page and not in the QR link.** The page shows the
  *offer* ("30% OFF") and a popup, but never a code string — `showPrize()` plays a
  transition and forwards to the video app. Klaviyo sends the code after the email is
  submitted.
- **The codes are UNIQUE and single-use, not one shared code** (verified against the
  Klaviyo API 2026-07-19). Two coupon pools exist: `AMAZON` (Amazon promo format, e.g.
  `4W2R-SVS6E8-5UV8A5` — ~809 of the first 1,200 already assigned to profiles) and
  `PrizeForms` (e.g. `TNCU99U9` — almost entirely unassigned). Klaviyo assigns a code to a
  *profile*, which is why an email is required before a code can be issued today.
  ⇒ **You cannot simply print "the code" on screen.** There isn't one.
- **The video is delivered by email too** (since the email-first change of 2026-06-16: the
  create app shows "Check your email" and stops; the server emails the finished video).

**So the email gate is not a growth-hack bolted on — it is currently the delivery mechanism
for everything we promised.** A change that removes or defers the email ask MUST say what
now delivers the discount and the video instead, or it is broken, not bold.

## The cost side of email capture — what is lost if it drops

Email is not only a funnel step. It feeds:

1. **The discount code** — no email, no code, and the customer got nothing for scanning.
2. **Video delivery** — no email, no video.
3. **The Klaviyo list**, including the review-reminder emails (Email 5 / Email 6). A real
   share of all review clicks arrive from those emails (`phase=email_redirect` in the log —
   measure it for the current window rather than trusting this sentence).

Reviews are the point of the whole funnel. **So a change that lifts email capture but
weakens review generation may be a net loss, and a change that lifts video starts by
skipping email may cost reviews downstream.** Always state the downstream cost, measured
where possible, not just the local rate you are improving.

## The tension worth solving (the biggest open prize)

~59% of people who scan never submit an email (41%, 80 of 195 in a typical fortnight —
the largest single loss in the funnel, ~115 people). They scanned because they were
promised a discount, and the page answers by asking for something before giving anything.

**Read that against the box.** Someone was told "scan to enjoy 15% off your next order" —
a small, casual, no-strings offer, seen twice (box and insert card). What they meet is:

| They were promised | The page gives them |
|---|---|
| 15% off — small, casual, no strings | "You've Got 30% Off" — a *different, bigger* number, presented as if it were always the deal (the surprise is wasted, and an unexplained bigger number can read as a catch) |
| (nothing about a video) | A personalized video as a co-headline — an unannounced bonus arriving before the thing they came for |
| A warm, playful voice | An email field standing between them and their discount |

The gap between the promise made and the page that answers it is the most plausible
explanation for the single biggest loss in this funnel — and a far better hypothesis than
"the layout needs work", which was tried in PR #8 and did nothing.

A **presentation** fix has already been tried and failed: PR #8 rebuilt the claim page with
a two-reward layout and clearer hierarchy — capture stayed flat (44.5% → 39.0%). So the
remaining moves are **structural**, and each has a real cost:

| Direction | What it would need | What it might cost |
|---|---|---|
| **Issue a unique code at scan time and show it on screen instantly**, then ask for the email to send the video (and a copy of the code) | Pull an UNASSIGNED code from the Klaviyo pool server-side and display it — a change in `api/` plus `claim.html`. There is a real pool to draw on (`PrizeForms` is almost entirely unassigned). Klaviyo assigns codes to profiles, so the assignment mechanism without an email needs designing and confirming with the owner. | Burns codes on people who never convert (pool depletion is measurable — check unassigned counts); removes the leverage that currently drives email capture, so review-reminder emails and the Klaviyo list shrink |
| Ask for the email later — after the video is created or previewed | Video delivery would have to work without an email up front (reversing part of the email-first change) | Re-introduces the delivery fragility email-first was built to fix |
| Reduce what the email ask costs the user (fewer fields, clearer why, instant proof) | Modest, inside the current mechanics | Low risk, but presentation-shaped — and presentation already failed once |

**Anything in this table is a business change, not a design tweak.** Propose it as a
recommendation with the trade-off stated plainly, flag it as business-impacting in the
cycle report, and let the owner decide. Do not quietly ship a change that alters what the
customer is promised or how they receive it.

## Hard constraints (do not violate)

- **Amazon TOS:** review asks say "honest review". Never offer or imply any incentive in
  exchange for a review. The discount is for scanning the card — it is never a reward for
  reviewing, and the two must never appear linked.
- **Never break the promise on the card.** If the customer was promised a discount, they
  must end up with a discount.
- **The owner's design bar:** premium and refined, not childish. Few emoji, clean type
  hierarchy, real section titles, even spacing. Copy sounds human and warm, never pushy.
- **You cannot spend money** and cannot change server/deploy config. If a fix genuinely
  needs those, say so in the report instead of building a lesser version of it.
