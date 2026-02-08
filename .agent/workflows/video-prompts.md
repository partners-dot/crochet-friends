# Video Prompt Generator Reference

Use this file as a reference when generating video prompts for new crochet products.

## Prompt Structure

All video prompts follow this format:
```
A cute [product description] saying: "[message]" The product is talking through the whole video. The product should be animated with mouth movements matching the speech through the whole video. Add some cute hand movements of the product; only one hand should move, the other hand should keep holding the sign. Cinematic lighting, photorealistic texture of yarn.
```

## Buyer Videos (3 total)

The buyer creates a video to send TO the gift recipient.

### Position 1: "The Greeting" (Send on the day they receive the gift)
**Tone:** Celebratory, birthday/occasion focused
**Style:** Direct address with "Happy birthday NAME!"

**Examples:**
- Potato: "Happy birthday NAME! Other treats disappear, but I'm here to stay sweet for life. Hope you had a great birthday!"
- NursePotato: "Happy birthday NAME! Other treats disappear, but I'm here to stay sweet for life. Hope you had a great birthday!"
- Cupcake: "Happy Birthday NAME! Other treats disappear, but I'm here to stay sweet for life. Hope you had a great birthday."

### Position 2: "The Teaser" (Send before the package arrives)
**Tone:** Playful anticipation, building excitement
**Style:** "Hey NAME! I sent you..." or announcing something is coming

**Examples:**
- Potato: "Hey NAME! I sent you a new roommate. He is quiet, very cute, and takes up zero space. You will love him."
- NursePotato: "Hey NAME! I sent you a new desk companion. He is quiet, very cute, and takes up zero space. You will love him."
- Cupcake: "Hey NAME. Clear a VIP spot on your shelf! I'm cute, zero calories, and I'm on my way!"

### Position 3: "Just Because" (Send a week or a month later)
**Tone:** Funny/quirky, casual
**Style:** Creative reason for sending, self-deprecating humor

**Examples:**
- Potato: "Hi NAME! I know you kill every plant you touch, so I sent you a vegetable made of yarn. He is immortal. Good luck!"
- NursePotato: "Hey NAME! Here is a hug for hour 13 of a 12-hour shift. He doesn't need overtime pay, just love."
- Cupcake: "Hey NAME! Since you kill every plant you touch... good news! I don't need water. You can't kill me!"

---

## Receiver Videos (3 total)

The receiver creates a video to THANK the gift giver.

### Position 1: "For the laughs" (Funny)
**Tone:** Humorous, playful, self-aware
**Style:** The product speaks about itself in third person, funny observations

**Examples:**
- Potato: "Hey NAME! Thanks for sending me. I'm the only carb she's allowed to keep forever. You're a total spud-tacular friend."
- NursePotato: "Thank you NAME! She talks to me at 3 AM during night shift. I am the only patient who does not press the call bell."
- Cupcake: "Thank you NAME! I tried to take a bite... tastes like yarn, but looks adorable! I love it!"

### Position 2: "From the heart" (Sweet)
**Tone:** Warm, appreciative, heartfelt
**Style:** Genuine gratitude, cozy imagery

**Examples:**
- Potato: "Thank you NAME! I'm the perfect little companion. She is squeezing me right now! We both appreciate you so much."
- NursePotato: "Thank you NAME! I wait in her locker to give her a hug during breaks. I am her favorite little recharging station."
- Cupcake: "Thank you NAME! This little guy has already made himself at home on my desk. Best surprise ever!"

### Position 3: "With attitude" (Sassy)
**Tone:** Bold, cheeky, confident
**Style:** Product speaks with confidence, slight attitude, fun

**Examples:**
- Potato: "Hey NAME. I am the new co-pilot. I sit in the cup holder and judge the traffic. We look very cool together."
- NursePotato: "Thank you NAME! I am guarding her coffee in the break room. Nobody steals it while I am on duty. I am fierce."
- Cupcake: "Thank you for the gift NAME! Nice try ruining my diet... but this one has zero calories. I win!"

---

## How to Generate Prompts for New Products

When asked to create prompts for a new product (e.g., "dog crochet"), follow these steps:

1. **Identify the product type** and what makes it unique (breed, profession, theme)
2. **Create 3 buyer prompts** following the greeting/teaser/just because structure
3. **Create 3 receiver prompts** following the funny/sweet/sassy structure
4. **Use product-specific humor** - puns, related jokes, situational comedy
5. **Keep messages under 120 characters** - this is the maximum for proper video timing
6. **Always use NAME as placeholder** for personalization

### Output Format

For each product, output:
```
## [Product Name]

### Buyer Prompts:
1. (Greeting): "[message]"
2. (Teaser): "[message]"
3. (Just Because): "[message]"

### Receiver Prompts:
1. (Funny): "[message]"
2. (Sweet): "[message]"
3. (Sassy): "[message]"
```
