const db = require('../config/database');

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

function normalizePumpValue(value) {
    if (value === undefined || value === null || value === '') return null;

    if (typeof value === 'boolean') return value ? 1 : 0;

    if (typeof value === 'number') {
        if (Number.isNaN(value)) return null;
        return value > 0 ? 1 : 0;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'on'].includes(normalized)) return 1;
    if (['0', 'false', 'off'].includes(normalized)) return 0;
    return null;
}

function normalizeOnlineValue(value) {
    if (value === undefined || value === null || value === '') return 1;
    const normalized = normalizePumpValue(value);
    return normalized == null ? 1 : normalized;
}

function mapDeviceCommand(row) {
    if (!row) {
        return {
            device_id: 'esp32_1',
            pump: 0,
            acknowledged: 0,
            timestamp: null
        };
    }

    const pump = normalizePumpValue(row.pump);
    const legacyLed = normalizePumpValue(row.led);

    return {
        device_id: row.device_id || 'esp32_1',
        pump: pump == null ? (legacyLed == null ? 0 : legacyLed) : pump,
        acknowledged: Number(row.acknowledged || 0),
        timestamp: row.timestamp || null
    };
}

function mapDeviceStatus(row) {
    if (!row) {
        return {
            device_id: 'esp32_1',
            pump: 0,
            online: 0,
            note: null,
            timestamp: null
        };
    }

    return {
        device_id: row.device_id || 'esp32_1',
        pump: normalizePumpValue(row.pump) ?? 0,
        online: normalizeOnlineValue(row.online),
        note: row.note || null,
        timestamp: row.timestamp || null
    };
}

const deviceController = {
    // POST /device/control
    controlPump: async (req, res) => {
        try {
            const deviceId = String(req.body?.device_id || 'esp32_1').trim() || 'esp32_1';
            const pump = normalizePumpValue(req.body?.pump ?? req.body?.led);

            if (pump == null) {
                return res.status(400).json({ error: 'pump is required and must be on/off, true/false, or 1/0' });
            }

            const insertResult = await runDb(
                `INSERT INTO device_commands (device_id, pump, led, fan, acknowledged)
                 VALUES (?, ?, ?, 0, 0)`,
                [deviceId, pump, pump]
            );

            return res.json({
                id: insertResult.lastID,
                message: 'Pump command saved',
                command: {
                    device_id: deviceId,
                    pump,
                    acknowledged: 0
                }
            });
        } catch (err) {
            console.error('Error saving pump command:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    },

    // GET /device/command
    getLatestCommand: async (req, res) => {
        try {
            const deviceId = String(req.query.device_id || 'esp32_1').trim() || 'esp32_1';
            const row = await getDb(
                `SELECT device_id, pump, led, acknowledged, timestamp
                 FROM device_commands
                 WHERE device_id = ?
                 ORDER BY timestamp DESC, id DESC
                 LIMIT 1`,
                [deviceId]
            );

            return res.json(mapDeviceCommand(row));
        } catch (err) {
            console.error('Error fetching pump command:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    },

    // POST /device/status
    updatePumpStatus: async (req, res) => {
        try {
            const deviceId = String(req.body?.device_id || 'esp32_1').trim() || 'esp32_1';
            const pump = normalizePumpValue(req.body?.pump);
            const online = normalizeOnlineValue(req.body?.online);
            const note = req.body?.note == null ? null : String(req.body.note).trim() || null;

            if (pump == null) {
                return res.status(400).json({ error: 'pump is required and must be on/off, true/false, or 1/0' });
            }

            const insertResult = await runDb(
                `INSERT INTO device_status (device_id, pump, online, note)
                 VALUES (?, ?, ?, ?)`,
                [deviceId, pump, online, note]
            );

            const latestCommand = await getDb(
                `SELECT id
                 FROM device_commands
                 WHERE device_id = ?
                 ORDER BY timestamp DESC, id DESC
                 LIMIT 1`,
                [deviceId]
            );

            if (latestCommand?.id) {
                await runDb(`UPDATE device_commands SET acknowledged = 1 WHERE id = ?`, [latestCommand.id]);
            }

            return res.json({
                id: insertResult.lastID,
                message: 'Pump status updated',
                status: {
                    device_id: deviceId,
                    pump,
                    online,
                    note
                }
            });
        } catch (err) {
            console.error('Error updating pump status:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    },

    // GET /device/status
    getLatestStatus: async (req, res) => {
        try {
            const deviceId = String(req.query.device_id || 'esp32_1').trim() || 'esp32_1';
            const row = await getDb(
                `SELECT device_id, pump, online, note, timestamp
                 FROM device_status
                 WHERE device_id = ?
                 ORDER BY timestamp DESC, id DESC
                 LIMIT 1`,
                [deviceId]
            );

            return res.json(mapDeviceStatus(row));
        } catch (err) {
            console.error('Error fetching pump status:', err);
            return res.status(500).json({ error: 'Database error' });
        }
    }
};

module.exports = deviceController;