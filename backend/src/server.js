// backend/src/server.js
require('dotenv').config();
const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_PATH || './database.sqlite'}`);
  console.log(`AI Service: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
  console.log('=================================');
  console.log('Endpoints:');
  console.log(`- Health: http://localhost:${PORT}/health`);
  console.log(`- Sensor data: http://localhost:${PORT}/sensor-data`);
  console.log(`- Device command: http://localhost:${PORT}/device/command`);
  console.log(`- Advice: http://localhost:${PORT}/advice`);
  console.log('=================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});