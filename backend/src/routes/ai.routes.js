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
const multer = require('multer');
const aiController = require('../controllers/ai.controller');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * AI integration routes
 *
 * APIs to implement:
 * - POST /ai/predict-plant
 * - GET /ai/history
 */

router.post('/ai/predict-plant', upload.single('file'), aiController.predictPlant);
router.post('/ai/predict-plant/device', upload.single('file'), aiController.predictPlantFromDevice);

router.get('/ai/latest', aiController.getLatest);
router.get('/ai/history', aiController.getHistory);

module.exports = router;