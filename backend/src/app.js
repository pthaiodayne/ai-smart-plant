const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const sensorRoutes = require('./routes/sensor.routes');
const deviceRoutes = require('./routes/device.routes');
const plantRoutes = require('./routes/plant.routes');
const aiRoutes = require('./routes/ai.routes');
const adviceRoutes = require('./routes/advice.routes');
const systemRoutes = require('./routes/system.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api', sensorRoutes);
app.use('/api', deviceRoutes);
app.use('/api', plantRoutes);
app.use('/api', aiRoutes);
app.use('/api', adviceRoutes);
app.use('/api', systemRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;