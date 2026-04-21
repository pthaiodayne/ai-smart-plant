/**
 * System routes
 *
 * APIs to implement:
 * - GET /system/status
 *
 * TODO:
 * - Aggregate latest sensor data, latest plant, device status, and last_update
 */

// backend/src/routes/system.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * System routes
 *
 * APIs to implement:
 * - GET /system/status
 */

// GET /api/system/status
router.get('/system/status', (req, res) => {
    // Get latest sensor data
    db.get(`SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1`, [], (err, sensorData) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        // Get latest AI detection
        db.get(`SELECT * FROM ai_detections ORDER BY timestamp DESC LIMIT 1`, [], (err, aiData) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            // Get latest device command
            db.get(`SELECT * FROM device_commands ORDER BY timestamp DESC, id DESC LIMIT 1`, [], (err, deviceCommandData) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                db.get(`SELECT * FROM device_status ORDER BY timestamp DESC, id DESC LIMIT 1`, [], (statusErr, deviceStatusData) => {
                    if (statusErr) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    res.json({
                        status: 'online',
                        timestamp: new Date(),
                        sensor: sensorData || null,
                        ai_detection: aiData || null,
                        device_command: deviceCommandData || null,
                        device_status: deviceStatusData || null
                    });
                });
            });
        });
    });
});

module.exports = router;