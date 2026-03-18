const db = require('../config/database');

class RuleEngine {
  async generateAdvice() {
    return new Promise((resolve, reject) => {
      // Get latest sensor data
      db.get(`SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1`, [], (err, sensorData) => {
        if (err) return reject(err);
        if (!sensorData) return resolve([]);

        // Get latest AI detection
        db.get(`SELECT * FROM ai_detections ORDER BY timestamp DESC LIMIT 1`, [], (err, aiData) => {
          if (err) return reject(err);

          const plant = aiData?.plant || 'lettuce'; // Default to lettuce if no AI detection

          // Get plant profile
          db.get(`SELECT * FROM plant_profiles WHERE plant = ?`, [plant], (err, profile) => {
            if (err) return reject(err);

            if (!profile) return resolve([]);

            const advice = this.generateAdviceFromProfile(sensorData, profile);
            resolve(advice);
          });
        });
      });
    });
  }

  generateAdviceFromProfile(sensorData, profile) {
    const advice = [];
    const suggestions = [];

    // Check temperature
    if (sensorData.temperature < profile.temperature_min) {
      advice.push(`🌡️ Nhiệt độ thấp (${sensorData.temperature}°C). Cần tăng nhiệt độ lên ${profile.temperature_min}-${profile.temperature_max}°C`);
      suggestions.push({ fan: 0 }); // Tắt quạt nếu lạnh
    } else if (sensorData.temperature > profile.temperature_max) {
      advice.push(`🌡️ Nhiệt độ cao (${sensorData.temperature}°C). Cần giảm nhiệt độ xuống ${profile.temperature_min}-${profile.temperature_max}°C`);
      suggestions.push({ fan: 1 }); // Bật quạt nếu nóng
    } else {
      advice.push(`🌡️ Nhiệt độ ổn định (${sensorData.temperature}°C)`);
    }

    // Check humidity
    if (sensorData.humidity < profile.humidity_min) {
      advice.push(`💧 Độ ẩm thấp (${sensorData.humidity}%). Cần tăng độ ẩm lên ${profile.humidity_min}-${profile.humidity_max}%`);
    } else if (sensorData.humidity > profile.humidity_max) {
      advice.push(`💧 Độ ẩm cao (${sensorData.humidity}%). Cần giảm độ ẩm xuống ${profile.humidity_min}-${profile.humidity_max}%`);
    } else {
      advice.push(`💧 Độ ẩm ổn định (${sensorData.humidity}%)`);
    }

    // Check light
    if (sensorData.light < profile.light_min) {
      advice.push(`☀️ Ánh sáng yếu (${sensorData.light}). Cần tăng cường ánh sáng lên ${profile.light_min}-${profile.light_max}`);
      suggestions.push({ led: 1 }); // Bật đèn nếu thiếu sáng
    } else if (sensorData.light > profile.light_max) {
      advice.push(`☀️ Ánh sáng mạnh (${sensorData.light}). Cần giảm bớt ánh sáng xuống ${profile.light_min}-${profile.light_max}`);
      suggestions.push({ led: 0 }); // Tắt đèn nếu quá sáng
    } else {
      advice.push(`☀️ Ánh sáng phù hợp (${sensorData.light})`);
    }

    return { advice, suggestions };
  }
}

module.exports = new RuleEngine();