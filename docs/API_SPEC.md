# API Specification Notes

This document is only used to record the approved APIs. It is not the final implementation document.

## Sensor APIs

### `POST /sensor-data`

- Purpose: ESP32 sends environmental data to the server.
- Request body:

```json
{
  "temperature": 28.5,
  "humidity": 72,
  "light": 340,
  "device_id": "esp32_01"
}
```

- Example response:

```json
{
  "status": "success",
  "message": "Sensor data received",
  "timestamp": "2026-03-07T10:20:00"
}
```

### `GET /sensor/latest`

- Purpose: get the latest sensor record.

### `GET /sensor/history`

- Purpose: get sensor history for charts/dashboard.
- Note: query params may be added later, for example `limit`, `from`, `to`.

## AI APIs

### `POST /ai/predict-plant`

- Purpose: receive an image from the camera/dashboard and return the plant type.
- Note: the upload format still needs to be agreed, such as `multipart/form-data` or base64.

### `GET /ai/history`

- Purpose: plant detection history.

## Plant Profile APIs

### `GET /plant-profile/{plant}`

- Purpose: get the profile of the detected plant type.

## Advice APIs

### `GET /advice`

- Purpose: combine the current plant + latest sensor data to generate care advice.
- Note: a `plant` parameter may be needed if the system should not use the latest AI result.

## Device APIs

### `POST /device/control`

- Purpose: dashboard sends device on/off commands.

### `GET /device/command`

- Purpose: ESP32 pulls the latest control command.

## System APIs

### `GET /system/status`

- Purpose: provide an aggregated system status for the overview dashboard.

## Module Mapping

- Backend Engineer:
  - Sensor APIs
  - Plant profile APIs
  - Advice APIs
  - Device APIs
  - System APIs
- AI and Dashboard Engineer:
  - AI APIs
  - Dashboard integration
- IoT Engineer:
  - `POST /sensor-data`
  - `GET /device/command`
