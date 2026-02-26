// API endpoint: /api/review-redirect
// Tracks review click in Klaviyo profile, then redirects to Amazon review page
// Used by Email 5 (Review Request) to track who clicked the review link

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;

export default async function handler(req, res) {
    const { email, asin } = req.query;

    const defaultAsin = 'B0DVR6VBRR';
    const targetAsin = asin || defaultAsin;
    const amazonReviewUrl = `https://www.amazon.com/review/create-review/?ie=UTF8&channel=glance-detail&asin=${targetAsin}`;

    // Update Klaviyo profile with review_clicked, then redirect.
    // IMPORTANT: Must await the fetch — Vercel kills serverless functions on res.end(),
    // so unawaited promises never complete. Using a timeout to keep redirect fast.
    if (email && KLAVIYO_API_KEY) {
        try {
            const klaviyoPromise = fetch('https://a.klaviyo.com/api/profile-import/', {
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
            });

            // Wait for Klaviyo update, but cap at 3s so redirect isn't slow
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ status: 'timeout' }), 3000));
            const result = await Promise.race([klaviyoPromise, timeoutPromise]);

            if (result.status === 'timeout') {
                console.log('[Review Redirect] Klaviyo update timed out for:', email);
            } else {
                console.log('[Review Redirect] Klaviyo update:', result.status, 'for:', email);
            }
        } catch (e) {
            console.error('[Review Redirect] Klaviyo error:', e.message);
        }
    } else {
        console.log('[Review Redirect] Skipping Klaviyo update — email:', !!email, 'apiKey:', !!KLAVIYO_API_KEY);
    }

    // Redirect to Amazon review page
    res.writeHead(302, { Location: amazonReviewUrl });
    res.end();
}
