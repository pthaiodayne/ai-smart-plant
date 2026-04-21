const db = require('../config/database');

const deviceController = {
    // POST /api/device/control
    controlDevice: (req, res) => {
        const { pump, device_id = 'esp32_1' } = req.body;

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
        const device_id = req.query.device_id || 'esp32_1';

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
    }

};

module.exports = deviceController;
