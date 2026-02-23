// API endpoint: /api/klaviyo-subscribe
// Subscribes a profile to a Klaviyo list with custom properties
// Used by the claim.html landing page after email capture

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID; // Existing "Amazon" list
const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, firstName, lastName, userType, sku, discountCode } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }

        if (!KLAVIYO_API_KEY) {
            console.error('[Klaviyo Subscribe] KLAVIO_ACCESS_KEY_ID not set');
            return res.status(500).json({ error: 'Klaviyo not configured' });
        }

        // Build profile attributes with custom properties
        // "klavioProduct" matches the existing Shopify form property name
        const profileAttributes = {
            email: email.toLowerCase(),
            properties: {
                klavioProduct: sku || null,
                Source: 'Scratch Card Landing Page',
                user_type: userType || null,
                discount_code: discountCode || null,
            },
            subscriptions: {
                email: {
                    marketing: {
                        consent: 'SUBSCRIBED'
                    }
                }
            }
        };

        // Add first/last name if provided
        if (firstName) profileAttributes.first_name = firstName;
        if (lastName) profileAttributes.last_name = lastName;

        // Build the request payload
        const payload = {
            data: {
                type: 'profile-subscription-bulk-create-job',
                attributes: {
                    profiles: {
                        data: [
                            {
                                type: 'profile',
                                attributes: profileAttributes
                            }
                        ]
                    }
                }
            }
        };

        // Add list relationship if list ID is configured
        if (KLAVIYO_LIST_ID) {
            payload.data.relationships = {
                list: {
                    data: {
                        type: 'list',
                        id: KLAVIYO_LIST_ID
                    }
                }
            };
        }

        console.log('[Klaviyo Subscribe] Subscribing:', email, 'sku:', sku, 'userType:', userType);

        // Call Klaviyo Subscribe API
        const response = await fetch(`${KLAVIYO_API_BASE}/profile-subscription-bulk-create-jobs/`, {
            method: 'POST',
            headers: {
                'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'revision': KLAVIYO_REVISION
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Klaviyo Subscribe] API error:', response.status, errorText);
            return res.status(response.status).json({
                error: 'Klaviyo API error',
                details: errorText
            });
        }

        console.log('[Klaviyo Subscribe] Success for:', email);

        return res.status(200).json({
            success: true,
            message: 'Profile subscribed successfully'
        });

    } catch (error) {
        console.error('[Klaviyo Subscribe] Error:', error);
        return res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
}
