/**
 * Device routes
 *
 * APIs:
 * - POST /device/control
 * - GET /device/command
 * - POST /device/status
 * - GET /device/status
 *
 * Purpose:
 * - Dashboard writes pump commands
 * - IoT device polls latest pump command
 * - IoT device reports actual pump status
 */
const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controller');

router.post('/device/control', deviceController.controlPump);
router.get('/device/command', deviceController.getLatestCommand);
router.post('/device/status', deviceController.updatePumpStatus);
router.get('/device/status', deviceController.getLatestStatus);

module.exports = router;