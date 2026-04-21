const db = require('../config/database');

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const DEFAULT_DEVICE_TOKEN = process.env.IOT_CAMERA_TOKEN || 'plant-device-demo';

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

function getDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row || null);
        });
    });
}

function normalizeDetectionRow(row) {
    if (!row) return null;

    return {
        id: row.id,
        plant_type: row.plant,
        confidence: Number(row.confidence || 0),
        image_path: row.image_path,
        source: row.source || 'dashboard',
        device_id: row.device_id || null,
        timestamp: row.timestamp
    };
}

function getUploadContext(req, fallbackSource = 'dashboard') {
    const requestedSource = String(req.body?.source || fallbackSource).trim() || fallbackSource;
    const requestedDeviceId = req.body?.device_id == null ? null : String(req.body.device_id).trim();

    return {
        source: requestedSource,
        deviceId: requestedDeviceId || null
    };
}

async function forwardImageToAi(req) {
    if (!req.file || !req.file.buffer) {
        const error = new Error('Image file is required (field name: file)');
        error.statusCode = 400;
        throw error;
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
        const error = new Error('AI service prediction failed');
        error.statusCode = 502;
        error.payload = {
            error: 'AI service prediction failed',
            status: aiResponse.status,
            detail
        };
        throw error;
    }

    return aiResponse.json();
}

async function savePrediction(prediction, context) {
    const plant = String(prediction.plant_type || prediction.plant || 'unknown');
    const confidence = Number(prediction.confidence || 0);

    const insertResult = await runDb(
        `INSERT INTO ai_detections (plant, confidence, image_path, source, device_id) VALUES (?, ?, ?, ?, ?)`,
        [plant, confidence, null, context.source, context.deviceId]
    );

    return {
        id: insertResult.lastID,
        plant_type: plant,
        confidence,
        timestamp: prediction.timestamp || new Date().toISOString(),
        source: context.source,
        device_id: context.deviceId
    };
}

async function handlePredictionRequest(req, res, fallbackSource) {
    try {
        const prediction = await forwardImageToAi(req);
        const context = getUploadContext(req, fallbackSource);
        const payload = await savePrediction(prediction, context);
        return res.json(payload);
    } catch (error) {
        console.error('Error predicting plant:', error);

        if (error?.statusCode && error?.payload) {
            return res.status(error.statusCode).json(error.payload);
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }

        if (error && error.cause && error.cause.code === 'ECONNREFUSED') {
            return res.status(502).json({
                error: 'AI service unavailable',
                detail: `Cannot connect to ${AI_SERVICE_URL}`
            });
        }

        return res.status(500).json({ error: 'Failed to predict plant' });
    }
}

const aiController = {
    predictPlant: async (req, res) => {
        return handlePredictionRequest(req, res, 'dashboard');
    },

    predictPlantFromDevice: async (req, res) => {
        const token = req.headers['x-device-token'];
        if (!token || token !== DEFAULT_DEVICE_TOKEN) {
            return res.status(401).json({ error: 'Invalid device token' });
        }

        if (!req.body?.device_id) {
            return res.status(400).json({ error: 'device_id is required for device uploads' });
        }

        return handlePredictionRequest(req, res, 'iot-camera');
    },

    getHistory: async (req, res) => {
        try {
            const rawLimit = Number(req.query.limit || 20);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 20;

            const rows = await allDb(
                `SELECT id, plant, confidence, image_path, source, device_id, timestamp
                 FROM ai_detections
                 ORDER BY timestamp DESC
                 LIMIT ?`,
                [limit]
            );

            const items = rows.map(normalizeDetectionRow);

            return res.json({ count: items.length, items });
        } catch (error) {
            console.error('Error fetching AI history:', error);
            return res.status(500).json({ error: 'Failed to fetch AI history' });
        }
    },

    getLatest: async (req, res) => {
        try {
            const preferredSource = String(req.query.source || 'iot-camera').trim();
            const fallbackEnabled = String(req.query.fallback || 'true').trim().toLowerCase() !== 'false';

            const baseQuery = `SELECT id, plant, confidence, image_path, source, device_id, timestamp
                               FROM ai_detections`;
            let row = null;

            if (preferredSource) {
                row = await getDb(
                    `${baseQuery}
                     WHERE source = ?
                     ORDER BY timestamp DESC
                     LIMIT 1`,
                    [preferredSource]
                );
            }

            if (!row && fallbackEnabled) {
                row = await getDb(
                    `${baseQuery}
                     ORDER BY timestamp DESC
                     LIMIT 1`
                );
            }

            if (!row) {
                return res.status(404).json({ error: 'No AI detections found' });
            }

            return res.json({ item: normalizeDetectionRow(row) });
        } catch (error) {
            console.error('Error fetching latest AI detection:', error);
            return res.status(500).json({ error: 'Failed to fetch latest AI detection' });
        }
    }
};

module.exports = aiController;