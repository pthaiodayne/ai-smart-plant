const db = require('../config/database');

const sensorController = {
    // POST /api/sensor-data
    createSensorData: (req, res) => {
        const { temperature, humidity, light, soil, auto_pump = 0, device_id = 'esp32_1' } = req.body;

        // Validate input
        if (!temperature || !humidity || !light) {
            return res.status(400).json({ error: 'Missing required fields: temperature, humidity, light' });
        }

        const query = `INSERT INTO sensor_data (temperature, humidity, light, soil, auto_pump, device_id) 
                       VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(query, [temperature, humidity, light, soil, auto_pump, device_id], function (err) {
            if (err) {
                console.error('Error inserting sensor data:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.status(201).json({
                id: this.lastID,
                data: { temperature, humidity, light, soil, auto_pump, device_id },
                message: 'Sensor data saved successfully'
            });
        });
    },

    // GET /api/sensor/latest
    getLatestSensorData: (req, res) => {
        const query = `SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1`;

        db.get(query, [], (err, row) => {
            if (err) {
                console.error('Error fetching sensor data:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(row || { message: 'No sensor data available' });
        });
    },

    // GET /api/sensor/history
    getSensorHistory: (req, res) => {
        const limit = req.query.limit || 10;
        const query = `SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT ?`;

        db.all(query, [limit], (err, rows) => {
            if (err) {
                console.error('Error fetching sensor history:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(rows);
        });
    }
};

module.exports = sensorController;
