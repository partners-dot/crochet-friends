// API endpoint: /api/review-redirect
// Tracks review click in Klaviyo profile, then redirects to Amazon review page
// Used by Email 5 (Review Request) to track who clicked the review link

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;

export default async function handler(req, res) {
    const { email, asin } = req.query;

    const defaultAsin = 'B0DVR6VBRR';
    const targetAsin = asin || defaultAsin;
    const amazonReviewUrl = `https://www.amazon.com/review/create-review/?ie=UTF8&channel=glance-detail&asin=${targetAsin}`;

    // Update Klaviyo profile with review_clicked (non-blocking, don't delay redirect)
    if (email && KLAVIYO_API_KEY) {
        try {
            fetch('https://a.klaviyo.com/api/profile-import/', {
                method: 'POST',
                headers: {
                    'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'revision': '2024-10-15'
                },
                body: JSON.stringify({
                    data: {
                        type: 'profile',
                        attributes: {
                            email: email.toLowerCase(),
                            properties: {
                                review_clicked: true,
                                review_clicked_at: new Date().toISOString()
                            }
                        }
                    }
                })
            }).then(r => {
                console.log('[Review Redirect] Klaviyo update:', r.status, 'for:', email);
            }).catch(err => {
                console.error('[Review Redirect] Klaviyo error:', err.message);
            });
        } catch (e) {
            console.error('[Review Redirect] Error:', e.message);
        }
    }

    // Redirect immediately to Amazon review page (don't wait for Klaviyo)
    res.writeHead(302, { Location: amazonReviewUrl });
    res.end();
}
