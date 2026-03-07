# ESP32 Skeleton

Firmware goals:

- Read temperature/humidity/light sensors.
- Send data to the backend using `POST /sensor-data`.
- Fetch the latest command using `GET /device/command`.
- Control fan/light/pump.

## Tasks

- Finalize the exact sensor modules.
- Choose the Wi-Fi connection flow.
- Choose an HTTP client library.
- Map GPIO pins for relays.
