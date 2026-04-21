const db = require('../config/database');

function mapSensorRow(row) {
    if (!row) return row;

    return {
        ...row,
        soil_moisture: row.soil ?? row.light ?? 0,
        auto_pump: row.auto_pump ?? 0
    };
}

const sensorController = {
    // POST /api/sensor-data
    createSensorData: (req, res) => {
        const { temperature, humidity, light, soil, pump = 0, AUTO, device_id = 'YOLOBIT01' } = req.body;
        const autoPump = AUTO ?? pump ?? 0;

        // Validate input
        if (temperature === undefined || humidity === undefined || light === undefined) {
            return res.status(400).json({ error: 'Missing required fields: temperature, humidity, light' });
        }

        const query = `INSERT INTO sensor_data (temperature, humidity, light, soil, auto_pump, device_id) 
                       VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(query, [temperature, humidity, light, soil, autoPump, device_id], function (err) {
            if (err) {
                console.error('Error inserting sensor data:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.status(201).json({
                id: this.lastID,
                data: {
                    temperature,
                    humidity,
                    light,
                    soil,
                    soil_moisture: soil ?? light ?? 0,
                    auto_pump: autoPump,
                    device_id
                },
                message: 'Sensor data saved successfully'
            });
        });
    },

    // GET /api/sensor/latest
    getLatestSensorData: (req, res) => {
        const deviceId = req.query.device_id || 'YOLOBIT01';
        const query = `SELECT * FROM sensor_data
                       WHERE device_id = ?
                       ORDER BY timestamp DESC, id DESC LIMIT 1`;

        db.get(query, [deviceId], (err, row) => {
            if (err) {
                console.error('Error fetching sensor data:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(mapSensorRow(row) || { message: 'No sensor data available' });
        });
    },

    // GET /api/sensor/history
    getSensorHistory: (req, res) => {
        const limit = req.query.limit || 10;
        const deviceId = req.query.device_id || 'YOLOBIT01';
        const query = `SELECT * FROM sensor_data
                       WHERE device_id = ?
                       ORDER BY timestamp DESC, id DESC LIMIT ?`;

        db.all(query, [deviceId, limit], (err, rows) => {
            if (err) {
                console.error('Error fetching sensor history:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(rows.map(mapSensorRow));
        });
    }
};

module.exports = sensorController;
