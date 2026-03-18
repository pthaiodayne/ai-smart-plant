/**
 * Device routes
 *
 * APIs to implement:
 * - POST /device/control
 * - GET /device/command
 *
 * TODO:
 * - Store the latest command for each device
 * - Optionally add an acknowledged status for ESP32
 */
const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controller');

router.post('/device/control', deviceController.controlDevice);
router.get('/device/command', deviceController.getLatestCommand);

module.exports = router;