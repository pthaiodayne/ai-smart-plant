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

function mapSensorRow(row) {
    if (!row) return row;

    return {
        ...row,
        soil_moisture: row.soil ?? row.light ?? 0,
        auto_pump: row.auto_pump ?? 0
    };
}

/**
 * System routes
 *
 * APIs to implement:
 * - GET /system/status
 */

// GET /api/system/status
router.get('/system/status', (req, res) => {
    const deviceId = req.query.device_id || 'YOLOBIT01';
    // Get latest sensor data
    db.get(`SELECT * FROM sensor_data WHERE device_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1`, [deviceId], (err, sensorData) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        // Get latest AI detection
        db.get(`SELECT * FROM ai_detections ORDER BY timestamp DESC LIMIT 1`, [], (err, aiData) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            // Get latest device command
            db.get(`SELECT * FROM device_commands WHERE device_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1`, [deviceId], (err, deviceCommandData) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                db.get(`SELECT * FROM device_status WHERE device_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1`, [deviceId], (statusErr, deviceStatusData) => {
                    if (statusErr) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    res.json({
                        status: 'online',
                        timestamp: new Date(),
                        sensor: mapSensorRow(sensorData) || null,
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
