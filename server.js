/* Express Server for Railway
 * 
 * Serves static files + API routes.
 * Replaces Vercel serverless functions with Express routes.
 * 
 * Key advantage: No timeout limit — video generation can run
 * as long as needed in background promises.
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));

// CORS middleware (applies to all API routes)
app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// ── API Routes ──
// Import all handlers (Vercel-compatible signature: (req, res) => {})
import checkStatusHandler from './api/check-status.js';
import generateVideoHandler from './api/generate-video.js';
import getVideoHandler from './api/get-video.js';
import klaviyoEventHandler from './api/klaviyo-event.js';
import klaviyoSubscribeHandler from './api/klaviyo-subscribe.js';
import productLookupHandler from './api/product-lookup.js';
import resolveVideoHandler from './api/resolve-video.js';
import reviewRedirectHandler from './api/review-redirect.js';
import saveVideoHandler from './api/save-video.js';
import sendVideoEmailHandler from './api/send-video-email.js';
import trackHandler from './api/track.js';
import userHandler from './api/user.js';

// Use app.all() so each handler can do its own method checking
// This matches Vercel behavior where one handler handles all methods
app.all('/api/check-status', checkStatusHandler);
app.all('/api/generate-video', generateVideoHandler);
app.all('/api/get-video', getVideoHandler);
app.all('/api/klaviyo-event', klaviyoEventHandler);
app.all('/api/klaviyo-subscribe', klaviyoSubscribeHandler);
app.all('/api/product-lookup', productLookupHandler);
app.all('/api/resolve-video', resolveVideoHandler);
app.all('/api/review-redirect', reviewRedirectHandler);
app.all('/api/save-video', saveVideoHandler);
app.all('/api/send-video-email', sendVideoEmailHandler);
app.all('/api/track', trackHandler);
app.all('/api/user', userHandler);

// ── Static Files ──
// Serve HTML, images, videos, etc. from root directory
app.use(express.static(__dirname, {
    extensions: ['html'],  // Allow /video-preview → video-preview.html
    index: 'index.html'
}));

// Fallback: serve index.html for any unmatched route (SPA-like behavior)
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// ── Start Server ──
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Crochet Friends server running on port ${PORT}`);
    console.log(`   Static files: ${__dirname}`);
    console.log(`   API routes: 12 endpoints`);
});
