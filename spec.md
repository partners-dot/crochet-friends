# Project Specification: QR-Based Personalized Video Landing Page

## 1. Overview

This project is a **simple landing page web app** accessed via **QR codes attached to crocheted doll products** (e.g., crocheted potato). Customers who purchased a product scan the QR code and are taken to a landing page where they can:

1. Write a personalized message for the gift recipient
2. Select which crocheted product they bought
3. Generate a short personalized video where the selected crocheted character "speaks" or presents the message
4. Preview and download the generated video

The goal is to create a delightful, low-friction experience that adds emotional value to a physical gift.

---

## 2. Target Users

* Customers who purchased crocheted doll products as gifts
* Likely mobile users (QR scan → phone browser)
* Non-technical, casual users

---

## 3. Core User Flow

1. User scans QR code on the product packaging
2. User lands on a mobile-friendly landing page
3. User enters a short message (e.g., "Happy Birthday, Tim!")
4. User selects the product they purchased (e.g., "Crocheted Potato")
5. User submits the form
6. System generates a short personalized video featuring the selected crocheted character delivering the message
7. User previews the video
8. User downloads the video to their device

---

## 4. Functional Requirements

### 4.1 Landing Page

* Single-page application (SPA) or simple multi-step form
* Mobile-first responsive design
* Friendly, playful tone

**Page Elements:**

* Brand/logo at the top
* Short explanation text ("Create a personalized message from your crocheted friend!")
* Message input field (text area)
* Product selection input (dropdown or card selection)
* Generate Video button

---

### 4.2 Message Input

* Free-text input field
* Character limit (recommended: 150–300 characters)
* Placeholder example: "Happy Birthday, Tim! I hope this little potato makes you smile 🥔❤️"
* Basic validation (required, max length)

---

### 4.3 Product Selection

* User selects which product they bought
* Options may include:

  * Crocheted Potato
  * Crocheted Avocado
  * Crocheted Strawberry
  * Other (future expansion)

Implementation options:

* Dropdown menu
* Clickable product cards with images

---

### 4.4 Video Generation

**Input:**

* User message text
* Selected product

**Process (High-Level):**

* Map product selection to a predefined character/avatar
* Convert message text into spoken audio (text-to-speech)
* Generate a short video where the crocheted character presents the message

**Video Characteristics:**

* Duration: 5–15 seconds
* Square or vertical format (mobile-friendly)
* Friendly voice and tone
* Simple animation or static image with animated mouth/text

---

### 4.5 Video Preview & Download

* Video preview displayed on the page after generation
* Download button
* Optional: Share button (future feature)

---

## 5. Non-Functional Requirements

### 5.1 Performance

* Landing page should load in under 3 seconds on mobile
* Video generation should provide loading feedback (spinner/progress message)

### 5.2 Usability

* No login required
* Minimal steps
* Clear instructions

### 5.3 Accessibility

* Readable font sizes
* High-contrast text
* Buttons large enough for mobile use

---

## 6. Technical Assumptions (Flexible)

* Frontend: HTML/CSS/JavaScript or lightweight framework
* Backend: Handles video generation and storage
* Temporary storage of generated videos (e.g., auto-delete after X days)
* No personal account system required

---

## 7. Error Handling

* Graceful error message if video generation fails
* Validation errors shown inline (e.g., empty message)
* Retry option for failed generations

---

## 8. Future Enhancements (Out of Scope for MVP)

* Multiple languages
* Voice selection
* Recipient name input as a separate field
* Custom backgrounds
* Save/share links
* Analytics (QR scan tracking, usage stats)

---

## 9. Success Criteria

* User can successfully generate and download a personalized video in under 1 minute
* Experience feels fun, magical, and gift-worthy
* Works smoothly on mobile devices

---

## 10. Summary

This project delivers a **simple, joyful QR-based landing page** that bridges a physical crocheted gift with a personalized digital experience. The MVP focuses on ease of use, emotional impact, and fast video generation without unnecessary complexity.
