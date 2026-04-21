const db = require('../config/database');

const deviceController = {
    // POST /api/device/control
    controlDevice: (req, res) => {
        const { pump, device_id = 'YOLOBIT01' } = req.body;

        const query = `INSERT INTO device_commands (device_id, pump) 
                       VALUES (?, ?)`;

        db.run(query, [device_id, pump || 0], function (err) {
            if (err) {
                console.error('Error saving pump command:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                id: this.lastID,
                message: 'Pump command saved',
                command: { pump: pump || 0 }
            });
        });
    },

    // GET /api/device/command
    getLatestCommand: (req, res) => {
        const device_id = req.query.device_id || 'YOLOBIT01';

        const query = `SELECT pump FROM device_commands 
                       WHERE device_id = ? 
                       ORDER BY timestamp DESC LIMIT 1`;

        db.get(query, [device_id], (err, row) => {
            if (err) {
                console.error('Error fetching pump command:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ pump: row ? row.pump : 0 });
        });
    },

    // Backward-compatible handler used by routes
    controlPump: (req, res) => {
        return deviceController.controlDevice(req, res);
    },

    // POST /api/device/status
    updatePumpStatus: (req, res) => {
        const { pump = 0, online = 1, note = null, device_id = 'YOLOBIT01' } = req.body;

        const query = `INSERT INTO device_status (device_id, pump, online, note)
                       VALUES (?, ?, ?, ?)`;

        db.run(query, [device_id, pump ? 1 : 0, online ? 1 : 0, note], function (err) {
            if (err) {
                console.error('Error saving device status:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                id: this.lastID,
                message: 'Pump status updated',
                status: {
                    device_id,
                    pump: pump ? 1 : 0,
                    online: online ? 1 : 0,
                    note
                }
            });
        });
    },

    // GET /api/device/status
    getLatestStatus: (req, res) => {
        const device_id = req.query.device_id || 'YOLOBIT01';

        const query = `SELECT device_id, pump, online, note, timestamp
                       FROM device_status
                       WHERE device_id = ?
                       ORDER BY timestamp DESC, id DESC LIMIT 1`;

        db.get(query, [device_id], (err, row) => {
            if (err) {
                console.error('Error fetching device status:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(row || {
                device_id,
                pump: 0,
                online: 0,
                note: null,
                timestamp: null
            });
        });
    }
};

module.exports = deviceController;
