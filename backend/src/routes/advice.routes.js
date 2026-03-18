/**
 * Advice routes
 *
 * APIs to implement:
 * - GET /advice
 *
 * TODO:
 * - Combine latest sensor data + latest AI result + plant profile
 * - Call the rule engine to generate advice
 */
const express = require('express');
const router = express.Router();
const adviceController = require('../controllers/advice.controller');

router.get('/advice', adviceController.getAdvice);

module.exports = router;