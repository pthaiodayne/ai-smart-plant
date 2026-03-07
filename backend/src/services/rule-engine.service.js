/**
 * Rule engine stub.
 *
 * Expected inputs:
 * - plant profile
 * - latest sensor data
 *
 * Expected outputs:
 * - advice list
 * - auto-control suggestions for fan/light/pump
 *
 * TODO:
 * - Compare temperature/humidity/light against min-max thresholds
 * - Generate messages for the dashboard
 * - If needed, generate commands for the backend to store for ESP32
 */

function generateAdvice() {
  // TODO: implement rule engine logic.
  return [];
}

module.exports = {
  generateAdvice
};
