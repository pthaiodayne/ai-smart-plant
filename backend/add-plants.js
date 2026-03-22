// backend/add-plants.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Danh sách các loại cây
const plants = [
    "apple", "banana", "beetroot", "bell pepper", "cabbage", "capsicum",
    "carrot", "cauliflower", "chilli pepper", "corn", "cucumber", "eggplant",
    "garlic", "ginger", "grapes", "jalepeno", "kiwi", "lemon", "lettuce",
    "mango", "onion", "orange", "paprika", "pear", "peas", "pineapple",
    "pomegranate", "potato", "raddish", "soy beans", "spinach", "sweetcorn",
    "sweetpotato", "tomato", "turnip", "watermelon"
];

const getPlantThresholds = (plant) => {
    const thresholds = {
        'lettuce': { temp_min: 15, temp_max: 22, hum_min: 60, hum_max: 80, light_min: 2000, light_max: 4000 },
        'spinach': { temp_min: 10, temp_max: 20, hum_min: 65, hum_max: 85, light_min: 3000, light_max: 5000 },
        'cabbage': { temp_min: 12, temp_max: 22, hum_min: 70, hum_max: 90, light_min: 3000, light_max: 5000 },
        'cauliflower': { temp_min: 15, temp_max: 22, hum_min: 65, hum_max: 85, light_min: 4000, light_max: 6000 },
        'carrot': { temp_min: 15, temp_max: 25, hum_min: 60, hum_max: 80, light_min: 4000, light_max: 7000 },
        'potato': { temp_min: 15, temp_max: 22, hum_min: 65, hum_max: 85, light_min: 3000, light_max: 5000 },
        'sweetpotato': { temp_min: 20, temp_max: 30, hum_min: 60, hum_max: 80, light_min: 5000, light_max: 8000 },
        'raddish': { temp_min: 10, temp_max: 20, hum_min: 60, hum_max: 80, light_min: 3000, light_max: 5000 },
        'turnip': { temp_min: 10, temp_max: 20, hum_min: 60, hum_max: 80, light_min: 3000, light_max: 5000 },
        'beetroot': { temp_min: 12, temp_max: 22, hum_min: 60, hum_max: 80, light_min: 4000, light_max: 6000 },
        'tomato': { temp_min: 20, temp_max: 28, hum_min: 65, hum_max: 85, light_min: 4000, light_max: 8000 },
        'cucumber': { temp_min: 18, temp_max: 28, hum_min: 70, hum_max: 90, light_min: 5000, light_max: 8000 },
        'eggplant': { temp_min: 20, temp_max: 28, hum_min: 65, hum_max: 85, light_min: 5000, light_max: 8000 },
        'bell pepper': { temp_min: 18, temp_max: 28, hum_min: 65, hum_max: 85, light_min: 5000, light_max: 8000 },
        'capsicum': { temp_min: 18, temp_max: 28, hum_min: 65, hum_max: 85, light_min: 5000, light_max: 8000 },
        'chilli pepper': { temp_min: 20, temp_max: 30, hum_min: 60, hum_max: 80, light_min: 6000, light_max: 9000 },
        'jalepeno': { temp_min: 20, temp_max: 30, hum_min: 60, hum_max: 80, light_min: 6000, light_max: 9000 },
        'corn': { temp_min: 18, temp_max: 28, hum_min: 65, hum_max: 85, light_min: 5000, light_max: 8000 },
        'sweetcorn': { temp_min: 18, temp_max: 28, hum_min: 65, hum_max: 85, light_min: 5000, light_max: 8000 },
        'peas': { temp_min: 12, temp_max: 22, hum_min: 60, hum_max: 80, light_min: 4000, light_max: 6000 },
        'soy beans': { temp_min: 20, temp_max: 30, hum_min: 65, hum_max: 85, light_min: 5000, light_max: 8000 },
        'apple': { temp_min: 10, temp_max: 22, hum_min: 60, hum_max: 80, light_min: 5000, light_max: 8000 },
        'banana': { temp_min: 20, temp_max: 30, hum_min: 70, hum_max: 90, light_min: 6000, light_max: 10000 },
        'mango': { temp_min: 22, temp_max: 32, hum_min: 60, hum_max: 80, light_min: 7000, light_max: 10000 },
        'orange': { temp_min: 15, temp_max: 28, hum_min: 60, hum_max: 80, light_min: 5000, light_max: 8000 },
        'lemon': { temp_min: 15, temp_max: 28, hum_min: 60, hum_max: 80, light_min: 5000, light_max: 8000 },
        'pear': { temp_min: 10, temp_max: 22, hum_min: 60, hum_max: 80, light_min: 5000, light_max: 8000 },
        'grapes': { temp_min: 15, temp_max: 28, hum_min: 55, hum_max: 75, light_min: 6000, light_max: 9000 },
        'kiwi': { temp_min: 10, temp_max: 22, hum_min: 65, hum_max: 85, light_min: 4000, light_max: 6000 },
        'pineapple': { temp_min: 20, temp_max: 32, hum_min: 65, hum_max: 85, light_min: 7000, light_max: 10000 },
        'pomegranate': { temp_min: 15, temp_max: 28, hum_min: 55, hum_max: 75, light_min: 6000, light_max: 9000 },
        'watermelon': { temp_min: 22, temp_max: 32, hum_min: 65, hum_max: 85, light_min: 7000, light_max: 10000 },
        'garlic': { temp_min: 10, temp_max: 25, hum_min: 55, hum_max: 75, light_min: 4000, light_max: 7000 },
        'ginger': { temp_min: 20, temp_max: 30, hum_min: 70, hum_max: 90, light_min: 3000, light_max: 5000 },
        'onion': { temp_min: 12, temp_max: 24, hum_min: 55, hum_max: 75, light_min: 5000, light_max: 8000 },
        'paprika': { temp_min: 18, temp_max: 28, hum_min: 60, hum_max: 80, light_min: 5000, light_max: 8000 }
    };

    return thresholds[plant] || {
        temp_min: 18, temp_max: 26,
        hum_min: 60, hum_max: 80,
        light_min: 3000, light_max: 7000
    };
};

db.serialize(() => {
    const stmt = db.prepare(`INSERT OR REPLACE INTO plant_profiles 
        (plant, temperature_min, temperature_max, humidity_min, humidity_max, light_min, light_max) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`);

    let count = 0;

    plants.forEach(plant => {
        const thresholds = getPlantThresholds(plant);
        stmt.run([
            plant,
            thresholds.temp_min,
            thresholds.temp_max,
            thresholds.hum_min,
            thresholds.hum_max,
            thresholds.light_min,
            thresholds.light_max
        ], function (err) {
            if (err) {
                console.error(`Error inserting ${plant}:`, err.message);
            } else {
                count++;
                if (count === plants.length) {
                    console.log(`✅ Successfully inserted/updated ${count} plant profiles`);

                    db.get("SELECT COUNT(*) as total FROM plant_profiles", [], (err, row) => {
                        console.log(`📊 Total plant profiles in database: ${row.total}`);
                        db.close();
                    });
                }
            }
        });
    });

    stmt.finalize();
});