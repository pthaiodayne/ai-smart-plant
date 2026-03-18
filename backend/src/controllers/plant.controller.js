const db = require('../config/database');

const plantController = {
    // GET /api/plant-profile/:plant
    getPlantProfile: (req, res) => {
        const { plant } = req.params;

        const query = `SELECT * FROM plant_profiles WHERE plant = ?`;

        db.get(query, [plant], (err, row) => {
            if (err) {
                console.error('Error fetching plant profile:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Plant profile not found' });
            }

            res.json(row);
        });
    },

    // GET /api/plants
    getAllPlants: (req, res) => {
        const query = `SELECT plant FROM plant_profiles`;

        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Error fetching plants:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(rows.map(row => row.plant));
        });
    }
};

module.exports = plantController;