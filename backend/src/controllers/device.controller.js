const db = require('../config/database');

const deviceController = {
    // POST /api/device/control
    controlDevice: (req, res) => {
        const { led, fan, device_id = 'esp32_1' } = req.body;

        const query = `INSERT INTO device_commands (device_id, led, fan) 
                       VALUES (?, ?, ?)`;

        db.run(query, [device_id, led || 0, fan || 0], function (err) {
            if (err) {
                console.error('Error saving device command:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                id: this.lastID,
                message: 'Device command saved',
                command: { led: led || 0, fan: fan || 0 }
            });
        });
    },

    // GET /api/device/command
    getLatestCommand: (req, res) => {
        const device_id = req.query.device_id || 'esp32_1';

        const query = `SELECT led, fan FROM device_commands 
                       WHERE device_id = ? 
                       ORDER BY timestamp DESC LIMIT 1`;

        db.get(query, [device_id], (err, row) => {
            if (err) {
                console.error('Error fetching device command:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(row || { led: 0, fan: 0 });
        });
    }
};

module.exports = deviceController;