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
const ENABLE_DEBUG_LOG = process.env.ENABLE_DEBUG_LOG !== 'false';

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const sanitized = {};
  for (const [key, value] of Object.entries(payload)) {
    if (Buffer.isBuffer(value)) {
      sanitized[key] = `[Buffer ${value.length} bytes]`;
      continue;
    }

    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = `${value.slice(0, 200)}...`;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use((req, res, next) => {
  if (!ENABLE_DEBUG_LOG) {
    next();
    return;
  }

  const startTime = Date.now();
  console.log(`>> ${req.method} ${req.originalUrl}`);

  if (Object.keys(req.query || {}).length) {
    console.log('   query:', sanitizePayload(req.query));
  }

  if (Object.keys(req.body || {}).length) {
    console.log('   body :', sanitizePayload(req.body));
  }

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    console.log(`<< ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
});

// Routes
app.use(sensorRoutes);
app.use(deviceRoutes);
app.use(plantRoutes);
app.use(aiRoutes);
app.use(adviceRoutes);
app.use(systemRoutes);

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