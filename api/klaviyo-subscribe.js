// API endpoint: /api/klaviyo-subscribe
// Two-step process:
// 1. Create/update profile with custom properties (Profiles API)
// 2. Subscribe profile to list (Subscription API)
// Used by the claim.html landing page after email capture

import { createClient } from '@supabase/supabase-js';

const KLAVIYO_API_KEY = process.env.KLAVIO_ACCESS_KEY_ID;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID; // Existing "Amazon" list
const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

// ROS Supabase for SKU→ASIN lookup from master_products
const rosSupabaseUrl = process.env.ROS_SUPABASE_URL || process.env.SUPABASE_URL;
const rosSupabaseKey = process.env.ROS_SUPABASE_SERVICE_ROLE_KEY || process.env.ROS_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const rosSupabase = rosSupabaseUrl && rosSupabaseKey ? createClient(rosSupabaseUrl, rosSupabaseKey) : null;

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

        const headers = {
            'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'revision': KLAVIYO_REVISION
        };

        // ── STEP 0: Look up ASIN from SKU (for Amazon review links in emails) ──
        let asin = null;
        if (sku && rosSupabase) {
            try {
                const { data: product } = await rosSupabase
                    .from('master_products')
                    .select('asin')
                    .eq('sku', sku)
                    .single();
                if (product?.asin) {
                    asin = product.asin;
                    console.log('[Klaviyo Subscribe] ASIN lookup:', sku, '→', asin);
                }
            } catch (e) {
                console.log('[Klaviyo Subscribe] ASIN lookup failed (non-blocking):', e.message);
            }
        }

        // ── STEP 1: Create or update profile with custom properties ──
        const profilePayload = {
            data: {
                type: 'profile',
                attributes: {
                    email: email.toLowerCase(),
                    properties: {
                        klavioProduct: sku || null,
                        klavioAsin: asin,
                        signup_source: 'Scratch Card Landing Page',
                        user_type: userType || null,
                        discount_code: discountCode || null,
                    }
                }
            }
        };

        if (firstName) profilePayload.data.attributes.first_name = firstName;
        if (lastName) profilePayload.data.attributes.last_name = lastName;

        console.log('[Klaviyo Subscribe] Step 1 - Creating profile:', email);

        const profileRes = await fetch(`${KLAVIYO_API_BASE}/profile-import/`, {
            method: 'POST',
            headers,
            body: JSON.stringify(profilePayload)
        });

        if (!profileRes.ok) {
            const errorText = await profileRes.text();
            console.error('[Klaviyo Subscribe] Profile create error:', profileRes.status, errorText);
            // Continue to subscription even if profile update fails
        } else {
            console.log('[Klaviyo Subscribe] Step 1 - Profile created/updated for:', email);
        }

        // ── STEP 2: Subscribe to list ──
        if (KLAVIYO_LIST_ID) {
            const subscribePayload = {
                data: {
                    type: 'profile-subscription-bulk-create-job',
                    attributes: {
                        profiles: {
                            data: [
                                {
                                    type: 'profile',
                                    attributes: {
                                        email: email.toLowerCase(),
                                        subscriptions: {
                                            email: {
                                                marketing: {
                                                    consent: 'SUBSCRIBED'
                                                }
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    relationships: {
                        list: {
                            data: {
                                type: 'list',
                                id: KLAVIYO_LIST_ID
                            }
                        }
                    }
                }
            };

            console.log('[Klaviyo Subscribe] Step 2 - Subscribing to list:', KLAVIYO_LIST_ID);

            const subRes = await fetch(`${KLAVIYO_API_BASE}/profile-subscription-bulk-create-jobs/`, {
                method: 'POST',
                headers,
                body: JSON.stringify(subscribePayload)
            });

            if (!subRes.ok) {
                const errorText = await subRes.text();
                console.error('[Klaviyo Subscribe] Subscribe error:', subRes.status, errorText);
                return res.status(subRes.status).json({
                    error: 'Klaviyo subscribe error',
                    details: errorText
                });
            }

            console.log('[Klaviyo Subscribe] Step 2 - Subscribed:', email);
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
