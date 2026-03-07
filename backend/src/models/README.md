# Models

Create models/schemas based on the database technology chosen by the team.

Suggested tables/collections:

- `sensor_data`
- `plant_profiles`
- `ai_detections`
- `device_commands`
- `device_status`

Minimum fields to include:

## `sensor_data`

- temperature
- humidity
- light
- device_id
- timestamp

## `plant_profiles`

- plant
- temperature_min
- temperature_max
- humidity_min
- humidity_max
- light_min
- light_max

## `ai_detections`

- plant
- confidence
- image_path or image_id
- timestamp
