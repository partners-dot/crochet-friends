// API endpoint: /api/klaviyo-event
// Sends a custom event (metric) to Klaviyo
// Used to track "Video Created" so flows can branch on it

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;
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
        const { email, eventName, properties } = req.body;

        if (!email || !eventName) {
            return res.status(400).json({ error: 'email and eventName are required' });
        }

        if (!KLAVIYO_API_KEY) {
            console.error('[Klaviyo Event] KLAVIO_ACCESS_KEY_ID not set');
            return res.status(500).json({ error: 'Klaviyo not configured' });
        }

        // Build the event payload per Klaviyo's Create Event API
        const payload = {
            data: {
                type: 'event',
                attributes: {
                    metric: {
                        data: {
                            type: 'metric',
                            attributes: {
                                name: eventName
                            }
                        }
                    },
                    profile: {
                        data: {
                            type: 'profile',
                            attributes: {
                                email: email.toLowerCase()
                            }
                        }
                    },
                    properties: properties || {},
                    time: new Date().toISOString()
                }
            }
        };

        console.log('[Klaviyo Event] Sending:', eventName, 'for:', email);

        const response = await fetch(`${KLAVIYO_API_BASE}/events/`, {
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
            console.error('[Klaviyo Event] API error:', response.status, errorText);
            return res.status(response.status).json({
                error: 'Klaviyo API error',
                details: errorText
            });
        }

        console.log('[Klaviyo Event] Success:', eventName, 'for:', email);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('[Klaviyo Event] Error:', error);
        return res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
}
