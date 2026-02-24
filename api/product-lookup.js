// API endpoint: /api/product-lookup
// Looks up a SKU in Supabase master_products and returns product info + character mapping
// Used by claim.html to dynamically get ASIN, product name, and video character

import { createClient } from '@supabase/supabase-js';

// master_products lives in the ROS Supabase project
const supabaseUrl = process.env.ROS_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.ROS_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Maps product_type from master_products → video app character name
const PRODUCT_TYPE_TO_CHARACTER = {
    'Potato': 'potato',
    'Potato with Pink Ribbon': 'bossLady',
    'Cupcake Crochet': 'cupcake',
    'Nurse Potato': 'nursePotato',
    'Nurse Pickle': null, // No video character yet
    'Cat Crochet': 'cat',
    'Dad Jokes Crochet': 'dadJokes',
    'Dog Crochet': 'dog',
    'Sloth Crochet': null,
    'Sunflower Crochet': null,
    'Yoda Crochet': 'yoda',
    'Grad Potato': 'potato',
    'Grad Pickle': null,
    'Santa Potato': 'potato',
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const sku = req.query.sku;
    if (!sku) return res.status(400).json({ error: 'SKU parameter required' });

    if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
    }

    try {
        const { data, error } = await supabase
            .from('master_products')
            .select('sku, asin, product_name, product_type, is_active')
            .eq('sku', sku)
            .single();

        if (error || !data) {
            console.log(`[Product Lookup] SKU not found: ${sku}`);
            return res.status(404).json({ error: 'Product not found', sku });
        }

        // Map product_type to video character
        const character = PRODUCT_TYPE_TO_CHARACTER[data.product_type] || null;

        // Build Amazon review URL from ASIN
        const amazonReviewUrl = data.asin
            ? `https://www.amazon.com/review/create-review/?ie=UTF8&channel=glance-detail&asin=${data.asin}`
            : null;

        // Build Amazon product URL from ASIN
        const amazonProductUrl = data.asin
            ? `https://www.amazon.com/dp/${data.asin}`
            : null;

        // Determine if this product supports video creation
        const hasVideo = character !== null;

        // Build character image path (if supported)
        const characterImage = hasVideo ? `images/${character}-buyer.jpg` : null;

        return res.status(200).json({
            sku: data.sku,
            asin: data.asin,
            productName: data.product_name,
            productType: data.product_type,
            character,
            hasVideo,
            characterImage,
            amazonReviewUrl,
            amazonProductUrl,
            isActive: data.is_active
        });

    } catch (error) {
        console.error('[Product Lookup] Error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}
