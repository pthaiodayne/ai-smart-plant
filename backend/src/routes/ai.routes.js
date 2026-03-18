/**
 * AI integration routes
 *
 * APIs to implement:
 * - POST /ai/predict-plant
 * - GET /ai/history
 *
 * TODO:
 * - Decide the image upload format
 * - Call the AI service if it is deployed separately
 */

// backend/src/routes/ai.routes.js
const express = require('express');
const router = express.Router();

/**
 * AI integration routes
 *
 * APIs to implement:
 * - POST /ai/predict-plant
 * - GET /ai/history
 */

// POST /api/ai/predict-plant
router.post('/ai/predict-plant', (req, res) => {
    // TODO: Implement AI prediction
    res.json({ message: 'AI prediction endpoint - to be implemented' });
});

// GET /api/ai/history
router.get('/ai/history', (req, res) => {
    // TODO: Implement AI history
    res.json({ message: 'AI history endpoint - to be implemented' });
});

module.exports = router;