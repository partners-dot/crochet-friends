# Funnel Context — what this funnel is FOR, and what it costs to change it

> ## ⚠️ Read this first: FACT vs GUESS
>
> This file mixes two very different kinds of statement, and treating them alike caused a
> real failure. Every claim here is one of:
>
> - **[FACT]** — verified against code, the database, an API, or stated by the owner.
>   Rely on it. If you find one that is wrong, correcting it is a legitimate cycle output.
> - **[GUESS]** — a hypothesis some past agent (or the assistant) wrote down. It carries
>   **no authority whatsoever.** It has not been tested and may be plainly wrong.
>
> **What went wrong:** a previous version of this file listed "issue the discount code at
> scan time, ask for the email afterwards" as *the* leading structural option for the
> biggest leak. That was a **[GUESS]**, written in the same table, same tone, same
> confidence as the verified mechanics beside it. The owner killed it on sight — the
> discount is the *price* of the email, so giving it away first removes the only reason to
> hand one over. A guess in authoritative clothing became a plan.
>
> **So:** never treat a [GUESS] as a premise. If a cycle wants to act on one, it must first
> gather evidence FOR it and say so, exactly as it would for any other hypothesis.
>
> ## 🎯 And the goal, before any of the numbers
>
> **The objective is MORE HONEST AMAZON REVIEWS.** Email capture, video starts and share
> clicks are **means**, and their percentages are **proxies**. A change that improves a
> proxy while damaging the machinery that produces reviews is a **loss**, no matter how
> good the funnel arithmetic looks.

> `ANALYTICS.md` says where the data lives. `FUNNEL_CHANGELOG.md` says what we tried and
> what happened. **This file says what the business is actually doing** — the promise the
> customer was made before they ever reached us, the mechanics behind each reward, and
> what breaks if you "optimize" a step without understanding why it exists.
>
> Read this before proposing any change to the claim page or the email gate.

## The journey starts OFF the website

**[FACT]** The promise is **printed on the product box**. The customer reads it after buying a
crocheted gift on Amazon. A representative example of the wording (owner-supplied,
2026-07-19):

> **did this potato make you smile?**
> **scan to enjoy 15% off your next order**
> [ QR code ]
> **there's a spud for anybud**

> 🚨 **THE PERCENTAGE VARIES BETWEEN BOXES.** Some print 15%, some print 30%. We cannot
> know which number any given scanner saw. This example is here so you understand the
> VOICE and the STRUCTURE of the promise — it is **not** a fact about what the customer
> was told.
>
> **Therefore the page must NEVER reference, quote, compare to, or "reveal" the printed
> percentage.** Anything of the form "your box said X — actually it's Y" is wrong for most
> visitors and has been explicitly rejected by the owner (see Rejected attempts). The
> on-page offer stands on its own.

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

> ✅ **The live promo is 30%** (owner, 2026-07-19), while print varies (15% or 30%). Some
> scanners are therefore offered more than they were promised, some exactly what they were
> promised. Do NOT "fix" the page down to a printed number, do not treat the difference as
> a bug, and — per the rule above — **do not build anything that references the printed
> number**, because you cannot know which one this visitor saw.

The QR link carries **only `?sku=<PRODUCT>`** (verified across all claim traffic: no
`code`, no `source` parameter ever arrives). Everything else — which discount, how it's
delivered — is decided by our own pages and by Klaviyo.

Products actually scanning in (last ~5 weeks, by volume): PTT-GREEN1 (64), PTT-FRIENDFUN
(28), PTT-CPCK1 (23), PTT-GREEN-DAD (19), PTT-SISFUN (11), then a long tail.

## The two rewards, and why email gates both

The claim page offers **30% off (the hero) + a free personalized video (the bonus)**. Both
are delivered by email:

- **[FACT] The discount code is not on the page and not in the QR link.** The page shows the
  *offer* ("30% OFF") and a popup, but never a code string — `showPrize()` plays a
  transition and forwards to the video app. Klaviyo sends the code after the email is
  submitted.
- **[FACT] The codes are UNIQUE and single-use, not one shared code** (verified against the
  Klaviyo API 2026-07-19). Two coupon pools exist: `AMAZON` (Amazon promo format, e.g.
  `4W2R-SVS6E8-5UV8A5` — ~809 of the first 1,200 already assigned to profiles) and
  `PrizeForms` (e.g. `TNCU99U9` — almost entirely unassigned). Klaviyo assigns a code to a
  *profile*, which is why an email is required before a code can be issued today.
  ⇒ **You cannot simply print "the code" on screen.** There isn't one.
- **[FACT] The video is delivered by email too** (since the email-first change of 2026-06-16: the
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

## The claim-page step — the largest single drop

**[FACT]** ~59% of people who scan never submit an email (41%, 80 of 195 in a typical
fortnight — ~115 people). That is the largest single drop in the funnel by headcount. How
much it is *worth* depends on what those people would have gone on to do, which is a
question about reviews, not about this rate — work that out rather than assuming.

**[FACT] We do not actually know why they leave.** That is the honest starting point, and the
owner's explicit instruction (2026-07-19) is to **find out what makes someone scan and then
not enter an email, and what would make them want to** — not to reach for a copy idea and
hope. Reasonable competing explanations, none yet tested:

1. **[GUESS] They never intended to.** The discount is for a *next* order; a one-off gift buyer may
   simply not want one. (If so this leak has a ceiling and the effort belongs elsewhere.)
2. **[GUESS] They don't want to give an email** to get something that was pitched as no-strings.
3. **[GUESS] They don't understand what they get, or don't trust it** — an unfamiliar page asking
   for an address before giving anything.
4. **[GUESS] They never even reach the field** — bounced, confused, distracted, slow load.
5. **[GUESS] They tried and failed** — typo, validation, keyboard, form friction.

These have *different* fixes, and four of the five are not copy problems. Distinguishing
them is the job before proposing anything.

**[FACT] What you can actually observe here** — the instruments, not the conclusions:
- **[FACT] PostHog session replay is ENABLED** and recording claim-page sessions. Watching what
  people actually do is the most direct evidence we have. Sample real sessions that
  bounced without submitting.
- Time-on-page and bounce timing: a 5-second exit and a 90-second exit are different
  problems.
- Device, SKU, and traffic mix (top scanners: PTT-GREEN1, PTT-FRIENDFUN, PTT-CPCK1).
- **[FACT] Where the instruments are blind:** the claim page records a page view and a
  submit, with nothing in between — no field-focus, scroll-depth, or time-to-first-
  interaction. So the data cannot currently separate "never engaged with the box" from
  "engaged and gave up", which are different behaviours with different causes. Check what
  events exist before assuming a question is answerable from this data.

**[FACT] What has already been tried here:** PR #8 rebuilt the claim page with a two-reward
layout and clearer hierarchy — capture stayed flat (44.5% → 39.0%). That is one data point
about one kind of change, recorded so it is not unknowingly repeated. It is not a proof
about every other kind.
| Ask for the email later — after the video is created or previewed | Video delivery would have to work without an email up front (reversing part of the email-first change) | Re-introduces the delivery fragility email-first was built to fix |
| Reduce what the email ask costs the user (fewer fields, clearer why, instant proof) | Modest, inside the current mechanics | Low risk, but presentation-shaped — and presentation already failed once |

### ⛔ The discount is the PRICE of the email, not an obstacle in front of it

**Owner ruling, 2026-07-20 — this overrides any reasoning below or elsewhere.**

The tempting idea — *"people bounce because we ask before we give, so give the discount
first and ask for the email after"* — **is wrong, and must not be proposed.**

The discount is the **only reason anyone hands over an email.** It is not friction standing
in front of the reward; it *is* the trade. Give the code away up front and the visitor has
everything they came for, and no reason left to type anything. The change would be argued
as *fixing* email capture while being the most reliable way to **destroy** it — and fewer
emails means fewer review-reminder emails, which means fewer reviews, which is the point of
this entire funnel. It optimises a number by dismantling what the number stands for.

**The evidence already leans this way:** session replays show **~67% never type a single
key**. People repelled by the ask would engage the box and abandon. Not touching it at all
looks like *not interested* or *did not understand fast enough* — neither of which is
solved by handing over the reward for free.

**What this ruling does and does not settle.** It rules out *one specific move* — handing
over the reward before asking for the email — and the reasoning behind it: a step where
people give something to get something is an **exchange**, and its rate is the price being
accepted, so removing what they were getting removes the reason to pay. That reasoning is
worth carrying to any step that works the same way.

It says **nothing** about what the right change here is. The step remains the largest
single drop in the funnel and is entirely open to attack — by any mechanism that does not
dismantle the exchange. Nobody has established what would work, and no list in this
document should be read as candidates: **that is the cycle's job to work out from the
evidence, not to pick from a menu written by someone who guessed earlier.**

**Anything in this table is a business change, not a design tweak.** Propose it as a
recommendation with the trade-off stated plainly, flag it as business-impacting in the
cycle report, and let the owner decide. Do not quietly ship a change that alters what the
customer is promised or how they receive it.

## Rejected attempts — do not re-propose

Same weight as a failed experiment: these were considered and turned down by the owner.
A future cycle may not re-propose them, or a smaller version of them, and must say
explicitly how any new idea differs.

| Date | Proposal | Why rejected |
|---|---|---|
| 2026-07-20 | **Give the discount code before asking for the email** (show a code at scan time, ask for the email afterwards) | The discount is the **price of the email, not an obstacle in front of it**. Handing it over first removes the only reason to type anything — it would be argued as fixing email capture while being the surest way to destroy it, and fewer emails means fewer review reminders, i.e. fewer reviews. Owner's judgement, and the replay data agrees (~67% never type a key at all, which is not the behaviour of someone repelled by an ask). |
| 2026-07-19 | **Name the printed-vs-actual discount gap on the claim hero** ("Your box said ~~15% off~~ — Surprise: it's 30%") | The printed percentage **varies between boxes**, so the claim would be wrong for many visitors. Beyond that, the owner does not want the page drawing attention to the print at all. The printed wording is background context for understanding the customer's mindset — **never material to quote back at them.** |

**Also standing:** claim-page **layout/hierarchy** redesigns for email capture (PR #8 —
tried, capture stayed flat). Presentation reshuffles of that page are spent ground.

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
