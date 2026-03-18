/**
 * Sensor routes
 *
 * APIs to implement:
 * - POST /sensor-data
 * - GET /sensor/latest
 * - GET /sensor/history
 *
 * TODO:
 * - Map routes to controllers
 * - Validate request body/query
 * - Standardize the response schema
 */
const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensor.controller');

router.post('/sensor-data', sensorController.createSensorData);
router.get('/sensor/latest', sensorController.getLatestSensorData);
router.get('/sensor/history', sensorController.getSensorHistory);

module.exports = router;