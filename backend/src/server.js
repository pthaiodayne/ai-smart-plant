// backend/src/server.js
require('dotenv').config();
const app = require('./app');
const db = require('./config/database');

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = 10;

let server;
let activePort = DEFAULT_PORT;

function logServerInfo(port) {
  console.log('=================================');
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_PATH || './database.sqlite'}`);
  console.log(`AI Service: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
  console.log('=================================');
  console.log('Endpoints:');
  console.log(`- Health: http://localhost:${port}/health`);
  console.log(`- Sensor data: http://localhost:${port}/sensor-data`);
  console.log(`- Device command: http://localhost:${port}/device/command`);
  console.log(`- Advice: http://localhost:${port}/advice`);
  console.log('=================================');
}

function startServer(port, retriesLeft) {
  activePort = port;
  server = app.listen(port, () => {
    logServerInfo(port);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on port ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error('Server failed to start:', err.message);
    process.exit(1);
  });
}

startServer(DEFAULT_PORT, MAX_PORT_RETRIES);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  const closeDb = () => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
      process.exit(0);
    });
  };

  if (server) {
    server.close(() => {
      console.log(`HTTP server on port ${activePort} closed`);
      closeDb();
    });
  } else {
    closeDb();
  }
});