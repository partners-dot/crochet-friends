---
description: How to analyze and optimize emails in the QR Claim Klaviyo flow based on performance metrics
---

# Optimizing the QR Claim Klaviyo Flow

This workflow pulls live performance data from the Klaviyo API, diagnoses underperforming emails, and guides you through making data-driven copy/design changes.

## Prerequisites

- Klaviyo API key (`KLAVIO_ACCESS_KEY_ID`) exists in `C:\Projects\ROS Multal Operating System\.env`
- Flow must be **live** with actual sends to have data (currently in draft)
- Flow mapping reference: see the `flow_mapping.md` artifact for Klaviyo IDs → local HTML file mapping

## Step 1: Pull Performance Metrics

// turbo
Run the metrics script to get open rates, click rates, and automatic diagnosis for each email:

```
node scripts/klaviyo-metrics.js
```

The script will output a table with per-email metrics and automatic diagnosis:
- 🔴 **Subject line issue** → Open rate < 25%
- ⚠️ **Subject could improve** → Open rate 25-35%
- 🔴 **CTA/content failing** → Click rate < 1%
- ⚠️ **Low clicks** → Click rate 1-3%
- 🔴 **High unsubs** → Unsubscribe rate > 3%
- ✅ **OK** → Metrics within healthy range
- ⏳ **Too few sends** → Fewer than 10 recipients (not enough data)

It also shows the **A/B test comparison** for Email 6 subject lines.

## Step 2: Diagnose the Problem

Based on the metrics output, identify which emails need attention:

### If Open Rate is low → Subject line problem
The subject line isn't compelling enough to get people to open. Consider:
- Adding an emoji if there isn't one
- Using curiosity or benefit-driven language
- Making it more personal/warm, less transactional
- A/B testing a new subject (duplicate the email slot in Klaviyo with a different subject)

### If Click Rate is low but Open Rate is good → Content/CTA problem
People open but don't click. The email body needs work. Consider:
- Is the CTA clear and compelling?
- Is there too much text before the button?
- Does the email give a reason to act NOW?
- Is the button visible and well-styled?

### If Unsubscribe Rate is high → Too aggressive
The email feels pushy or irrelevant. Consider:
- Softening the language
- Adding value instead of just asking
- Increasing the delay before this email
- Adding a branch condition to skip users who already took the action

## Step 3: Identify Which HTML File to Edit

Use this mapping to find the local file for the underperforming email:

| Local File | Purpose | Klaviyo Slots |
|---|---|---|
| `emails/email-1-coupon.html` | Welcome + 30% OFF coupon | 1 slot (Msg: TDe8L9) |
| `emails/email-2-video-reminder.html` | Video reminder (didn't create) | 1 slot (Msg: REqajB) |
| `emails/email-3-last-chance.html` | Last chance to create video | 1 slot (Msg: VzeceB) |
| `emails/email-4-share-video.html` | Share your video / reminders | 3 slots (Msg: VsKFbW, W8gHUW, TMA46b) |
| `emails/email-5-review-request.html` | 1st review request | 6 slots (Msg: XXxRGg, U8k5xH, R7i6RC, RGqTjc, XKJKj4, U3FtpF) |
| `emails/email-6-review-reminder.html` | 2nd/last review reminder | 6 slots (Msg: TZz9nf, Vv9Kvd, WKxQKn, UM2Wui, U2x9hX, XQsbhi) |

For the full flow structure with all 50 actions, branches, and delays, see `flow_mapping.md`.

## Step 4: Edit the Email HTML

When editing email HTML, follow the design system at `.agent/workflows/klaviyo-emails.md`. Key rules:

1. **Start from the base template** (`emails/email-base-template.html`)
2. **Use table-based layout** — no divs, no CSS grid
3. **Control spacing with `<td>` padding** — not margins on `<p>` or `<h>` tags
4. **Triple-center everything**: `align="center"` on `<td>`, `align="center"` on `<p>`, and `text-align: center` in inline style
5. **Use `<p>` tags for headlines** — not `<h1>/<h2>` (Klaviyo overrides heading sizes on mobile)
6. **Colors**: Outer bg `#F4F1EA`, Card bg `#FFFFFF`, Navy `#141444`, Gold `#AE8D4B`, Gray `#8A8A9D`
7. **Fonts**: Playfair Display (headlines), Montserrat (body)
8. **Buttons**: Navy bg, white text, uppercase, `letter-spacing: 2px`, padding `18px 45px`

## Step 5: Review Changes & Push to GitHub

Before pushing, show the user what changed and get explicit approval.

// turbo
Show the diff of all modified email files:

```
cd c:\Projects\crochet-friends
git diff emails/
```

**STOP HERE and ask the user to review the changes.** Do NOT push until the user explicitly approves.

Once approved:

```
cd c:\Projects\crochet-friends
git add emails/ scripts/
git commit -m "Optimize [email name] based on Klaviyo metrics"
git push origin main
```

This auto-deploys to Vercel at `video.gotyoualittlesomething.com`.

## Step 6: Paste into Klaviyo (Manual)

**IMPORTANT:** When updating an email, paste the HTML into ALL Klaviyo slots that use that template.

1. Open the QR Claim flow in Klaviyo
2. Find each email slot that uses the modified template (see mapping above)
3. Click the email → Edit → switch to HTML mode → paste the full HTML
4. Preview on desktop AND mobile
5. Save

## Step 7: Log Changes

After making changes, note:
- Which email was changed
- What the metrics were before
- What was changed and why
- Date of change

This helps track optimization over time and decide if changes improved performance.

## Benchmarks for Reference

| Metric | Poor | Average | Good | Excellent |
|---|---|---|---|---|
| Open Rate | < 20% | 20-35% | 35-50% | > 50% |
| Click Rate | < 1% | 1-3% | 3-7% | > 7% |
| Unsub Rate | > 2% | 1-2% | 0.5-1% | < 0.5% |
| Bounce Rate | > 3% | 1-3% | 0.5-1% | < 0.5% |

## Optimization Playbook by Email Type

### Coupon/Discount Emails (Email 1)
- Lead with the offer in subject AND preview
- Make the code impossible to miss (large, centered, styled)
- Add urgency if possible (expiration date)
- Show 1-2 product images to drive clicks

### Video Reminder Emails (Emails 2, 3)
- Emphasize the emotional payoff ("imagine their reaction")
- Show how quick/easy it is ("takes 30 seconds")
- Include a preview or thumbnail if possible
- Email 3 should have a different angle than Email 2 — don't just repeat

### Share Reminder Emails (Emails 4, 6, 9)
- Focus on the recipient, not the task ("they haven't seen it yet")
- Make sharing feel effortless (one tap)
- Each successive reminder needs a FRESH angle

### Review Request Emails (Emails 5, 7, 8, 10, 11, 12)
- Amazon TOS: never ask for positive reviews, use "honest feedback" language
- CTA says "Share Your Experience" or "Leave a Review" (neutral)
- No incentives tied to reviews
- Best angles: emotional recall, effort minimization, small team connection

### 2nd Review Reminder (Emails 13-18)
- Must feel different from the 1st review request
- "This is our last reminder" reduces pressure
- Best angles: emotional recall ("remember that smile"), reframing ("just one question")
