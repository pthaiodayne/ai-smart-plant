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
        // Sensor data table
        db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            temperature REAL,
            humidity REAL,
            light INTEGER,
            device_id TEXT DEFAULT 'esp32_1',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Plant profiles table
        db.run(`CREATE TABLE IF NOT EXISTS plant_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plant TEXT UNIQUE,
            temperature_min REAL,
            temperature_max REAL,
            humidity_min REAL,
            humidity_max REAL,
            light_min INTEGER,
            light_max INTEGER
        )`);

        // AI detections table
        db.run(`CREATE TABLE IF NOT EXISTS ai_detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plant TEXT,
            confidence REAL,
            image_path TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Device commands table
        db.run(`CREATE TABLE IF NOT EXISTS device_commands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT DEFAULT 'esp32_1',
            led INTEGER DEFAULT 0,
            fan INTEGER DEFAULT 0,
            acknowledged INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Insert default plant profiles
        db.run(`INSERT OR IGNORE INTO plant_profiles (plant, temperature_min, temperature_max, humidity_min, humidity_max, light_min, light_max) VALUES 
            ('lettuce', 15, 22, 60, 80, 2000, 4000),
            ('mustard-greens', 18, 25, 65, 85, 3000, 5000),
            ('water-spinach', 20, 30, 70, 90, 4000, 6000)
        `, function (err) {
            if (err) {
                console.error('Error inserting default profiles:', err);
            } else {
                console.log('Default plant profiles inserted');
            }
        });

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