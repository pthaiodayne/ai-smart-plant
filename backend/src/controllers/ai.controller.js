const db = require('../config/database');

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

function runDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function allDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows || []);
        });
    });
}

const aiController = {
    predictPlant: async (req, res) => {
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ error: 'Image file is required (field name: file)' });
            }

            const formData = new FormData();
            const mimeType = req.file.mimetype || 'application/octet-stream';
            formData.append('file', new Blob([req.file.buffer], { type: mimeType }), req.file.originalname || 'upload.jpg');

            const aiResponse = await fetch(`${AI_SERVICE_URL}/ai/predict-plant`, {
                method: 'POST',
                body: formData
            });

            if (!aiResponse.ok) {
                const detail = await aiResponse.text();
                return res.status(502).json({
                    error: 'AI service prediction failed',
                    status: aiResponse.status,
                    detail
                });
            }

            const prediction = await aiResponse.json();
            const plant = String(prediction.plant_type || prediction.plant || 'unknown');
            const confidence = Number(prediction.confidence || 0);

            const insertResult = await runDb(
                `INSERT INTO ai_detections (plant, confidence, image_path) VALUES (?, ?, ?)`,
                [plant, confidence, null]
            );

            return res.json({
                id: insertResult.lastID,
                plant_type: plant,
                confidence,
                timestamp: prediction.timestamp || new Date().toISOString()
            });
        } catch (error) {
            console.error('Error predicting plant:', error);

            if (error && error.cause && error.cause.code === 'ECONNREFUSED') {
                return res.status(502).json({
                    error: 'AI service unavailable',
                    detail: `Cannot connect to ${AI_SERVICE_URL}`
                });
            }

            return res.status(500).json({ error: 'Failed to predict plant' });
        }
    },

    getHistory: async (req, res) => {
        try {
            const rawLimit = Number(req.query.limit || 20);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 20;

            const rows = await allDb(
                `SELECT id, plant, confidence, image_path, timestamp
                 FROM ai_detections
                 ORDER BY timestamp DESC
                 LIMIT ?`,
                [limit]
            );

            const items = rows.map((row) => ({
                id: row.id,
                plant_type: row.plant,
                confidence: Number(row.confidence || 0),
                image_path: row.image_path,
                timestamp: row.timestamp
            }));

            return res.json({ count: items.length, items });
        } catch (error) {
            console.error('Error fetching AI history:', error);
            return res.status(500).json({ error: 'Failed to fetch AI history' });
        }
    }
};

module.exports = aiController;