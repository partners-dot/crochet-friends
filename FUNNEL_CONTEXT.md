# Funnel Context — what this funnel is FOR, and what it costs to change it

> `ANALYTICS.md` says where the data lives. `FUNNEL_CHANGELOG.md` says what we tried and
> what happened. **This file says what the business is actually doing** — the promise the
> customer was made before they ever reached us, the mechanics behind each reward, and
> what breaks if you "optimize" a step without understanding why it exists.
>
> Read this before proposing any change to the claim page or the email gate.

## The journey starts OFF the website

A physical insert card ships inside every product. The customer finds it after buying a
crocheted gift on Amazon. **The card's call-to-action is the discount** — that is the
promise that makes someone pull out their phone and scan. The video is not the hook; the
discount is.

The QR link carries **only `?sku=<PRODUCT>`** (verified across all claim traffic: no
`code`, no `source` parameter ever arrives). Everything else — which discount, how it's
delivered — is decided by our own pages and by Klaviyo.

> ⚠️ **Unknown, needs the owner:** we do not have the card artwork or its exact wording in
> this repo. If you are reasoning about promise-versus-delivery, say so explicitly rather
> than assuming what the card says. Ask for it in the report.

Products actually scanning in (last ~5 weeks, by volume): PTT-GREEN1 (64), PTT-FRIENDFUN
(28), PTT-CPCK1 (23), PTT-GREEN-DAD (19), PTT-SISFUN (11), then a long tail.

## The two rewards, and why email gates both

The claim page offers **30% off (the hero) + a free personalized video (the bonus)**. Both
are delivered by email:

- **The discount code is not on the page and not in the QR link.** The page says "code sent
  to your inbox" — Klaviyo sends it after the email is submitted. There is no code to show
  on screen today.
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

A **presentation** fix has already been tried and failed: PR #8 rebuilt the claim page with
a two-reward layout and clearer hierarchy — capture stayed flat (44.5% → 39.0%). So the
remaining moves are **structural**, and each has a real cost:

| Direction | What it would need | What it might cost |
|---|---|---|
| Show a discount code on screen immediately, ask for email only for the video | A code that can be shown to everyone (multi-use). **We do not know if one exists — this is an owner question, not an assumption.** | Fewer emails ⇒ fewer review reminders; possible discount abuse |
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
