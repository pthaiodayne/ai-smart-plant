// backend/src/config/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        function ensureColumn(tableName, columnName, columnSql) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`, (err) => {
                if (err && !String(err.message || '').includes('duplicate column name')) {
                    console.error(`Error adding column ${tableName}.${columnName}:`, err);
                }
            });
        }

        // Sensor data table
        db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            temperature REAL,
            humidity REAL,
            light INTEGER,
            soil REAL,
            auto_pump INTEGER DEFAULT 0,
            device_id TEXT DEFAULT 'YOLOBIT01',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        ensureColumn('sensor_data', 'soil', 'REAL');
        ensureColumn('sensor_data', 'auto_pump', 'INTEGER DEFAULT 0');

        // Plant profiles table
        db.run(`CREATE TABLE IF NOT EXISTS plant_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plant TEXT UNIQUE,
            temperature_min REAL,
            temperature_max REAL,
            humidity_min REAL,
            humidity_max REAL,
            soil_min REAL,
            soil_max REAL,
            light_min INTEGER,
            light_max INTEGER
        )`);

        ensureColumn('plant_profiles', 'soil_min', 'REAL');
        ensureColumn('plant_profiles', 'soil_max', 'REAL');

        // AI detections table
        db.run(`CREATE TABLE IF NOT EXISTS ai_detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plant TEXT,
            confidence REAL,
            image_path TEXT,
            source TEXT DEFAULT 'dashboard',
            device_id TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        ensureColumn('ai_detections', 'source', "TEXT DEFAULT 'dashboard'");
        ensureColumn('ai_detections', 'device_id', 'TEXT');

        // Device commands table
        db.run(`CREATE TABLE IF NOT EXISTS device_commands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT DEFAULT 'YOLOBIT01',
            pump INTEGER DEFAULT 0,
            led INTEGER DEFAULT 0,
            fan INTEGER DEFAULT 0,
            acknowledged INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        ensureColumn('device_commands', 'pump', 'INTEGER DEFAULT 0');

        // Device status table
        db.run(`CREATE TABLE IF NOT EXISTS device_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT DEFAULT 'YOLOBIT01',
            pump INTEGER DEFAULT 0,
            online INTEGER DEFAULT 1,
            note TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Insert default plant profiles
        db.run(`INSERT OR IGNORE INTO plant_profiles (plant, temperature_min, temperature_max, humidity_min, humidity_max, soil_min, soil_max, light_min, light_max) VALUES 
            ('lettuce', 15, 22, 60, 80, 55, 75, 2000, 4000),
            ('mustard-greens', 18, 25, 65, 85, 60, 80, 3000, 5000),
            ('water-spinach', 20, 30, 70, 90, 70, 90, 4000, 6000)
        `, function (err) {
            if (err) {
                console.error('Error inserting default profiles:', err);
            } else {
                console.log('Default plant profiles inserted');
            }
        });

        db.run(`UPDATE plant_profiles
                SET soil_min = COALESCE(soil_min, 55),
                    soil_max = COALESCE(soil_max, 75)
                WHERE plant = 'lettuce'`);
        db.run(`UPDATE plant_profiles
                SET soil_min = COALESCE(soil_min, 60),
                    soil_max = COALESCE(soil_max, 80)
                WHERE plant = 'mustard-greens'`);
        db.run(`UPDATE plant_profiles
                SET soil_min = COALESCE(soil_min, 70),
                    soil_max = COALESCE(soil_max, 90)
                WHERE plant = 'water-spinach'`);

        // Kiểm tra dữ liệu đã insert
        db.get("SELECT COUNT(*) as count FROM plant_profiles", [], (err, row) => {
            if (err) {
                console.error('Error checking plant profiles:', err);
            } else {
                console.log(`Plant profiles in database: ${row.count}`);
            }
        });
    });
}

module.exports = db;
