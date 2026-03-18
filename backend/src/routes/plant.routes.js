/**
 * Plant profile routes
 *
 * APIs to implement:
 * - GET /plant-profile/:plant
 *
 * TODO:
 * - Fetch a profile by plant name
 * - Normalize plant keys: lettuce, mustard-greens, water-spinach...
 */
const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plant.controller');

router.get('/plants', plantController.getAllPlants);
router.get('/plant-profile/:plant', plantController.getPlantProfile);

module.exports = router;