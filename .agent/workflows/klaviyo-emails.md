---
description: Guidelines and instructions for AI agents on how to generate Klaviyo email templates for this project.
---

# Creating Klaviyo Emails

When asked to create or modify a Klaviyo email for `Got You A Little Something`, you must adhere to these strict design and coding guidelines to ensure visual consistency, premium aesthetic, and mobile responsiveness.

## 1. Start with the Base Template
Never write an email from scratch. Always base the HTML on `emails/email-base-template.html`. This file contains the proper table structures, max-width constraints, outer background colors, border styles (for mobile-edge compatibility), and imported fonts.

## 2. Design System & Aesthetics
The brand aesthetic is "10x Designer Premium": clean, airy, elegant, and classy.
- **Outer Background:** `#F4F1EA` (Alabaster)
- **Inner Card Background:** `#FFFFFF`
- **Main Text / Navy:** `#141444`
- **Accents / Warm Gold:** `#AE8D4B` (Used for celebratory headlines, special pre-headers)
- **Subtitles / Muted Gray:** `#8A8A9D`
- **Borders:** `#D8D3C8` (2px solid for main card to show on mobile)
- **Fonts:** 
  - Headlines and Brand Text: `Playfair Display, Georgia, serif` (Always cursive/italicized OR elegantly weighted)
  - Body, Buttons, Subtitles: `Montserrat, Arial, sans-serif`

## 3. Spacing Rules (CRITICAL FOR KLAVIYO)
Klaviyo's rendering engine overrides typical margin rules, especially on mobile. 
- **DO NOT** rely on `<p>` or `<h1>` margins to create vertical space between elements.
- **DO** place every distinct block of text or element inside its own `<tr><td style="padding: Xpx Ypx Zpx">` wrapper.
- Control all vertical rhythm strictly using **padding** on table cells (`<td>`). 
- Keep sections airy and breathable. Err on the side of larger top/bottom padding between distinct sections (e.g., `padding: 0 30px 32px;`).

## 4. Centering Rules
Klaviyo editors can break inline CSS centering rules. To guarantee text is centered across all devices:
- You must add `align="center"` to the `<td>` tag.
- You must add `align="center"` to the `<p>` or heading tag.
- You must add `text-align: center;` to the inline `style=""` of the `<p>` or heading tag.
- *(Example: `<p align="center" style="margin: 0; text-align: center;">...`)*

## 5. Typography Behavior
- **Headlines:** Use `<p>` tags instead of `<h1>` or `<h2>` for headlines. Klaviyo's mobile renderer overrides heading tags with default sizes, breaking responsiveness. A styled `<p>` tag is safer.
- **Line Heights:** Explicitly set `line-height: 1.2` for headlines and `line-height: 1.6` (or `1.8`) for body copy to preserve elegance.

## 6. Buttons
- Buttons should be a nested table to ensure they render completely clickable in Outlook.
- Background: `#141444`, Text: `#FFFFFF`, uppercase, wide tracking (`letter-spacing: 2px`), bold (`font-weight: 500`).
- Use substantial padding, e.g., `padding: 18px 45px`.

By following these rules, any agent can generate a new email module that drops effortlessly into the brand's premium design vocabulary.
