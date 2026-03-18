/*
 * ESP32 firmware stub.
 *
 * TODO:
 * - Connect Wi-Fi
 * - Read sensors:
 *   - temperature
 *   - humidity
 *   - light
 * - Send JSON to POST /sensor-data
 * - Poll GET /device/command
 * - Control relay for fan/light/pump
 *
 * Suggested loop:
 * 1. read sensors
 * 2. send data
 * 3. fetch command
 * 4. apply command
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "secrets.h"
#include "config.h"
#include "sensors.h"

unsigned long lastSend = 0;

void connectWiFi()
{
    Serial.println("Connecting WiFi...");

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nWiFi connected");
}

void sendSensorData(float temp, float hum, int light)
{
    if (WiFi.status() != WL_CONNECTED)
        return;

    HTTPClient http;

    String url = String(API_BASE_URL) + "/api/sensor-data";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;

    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["light"] = light;

    String json;
    serializeJson(doc, json);

    int httpCode = http.POST(json);

    Serial.println("Send data:");
    Serial.println(json);
    Serial.println("HTTP: " + String(httpCode));

    http.end();
}

void getDeviceCommand()
{
    if (WiFi.status() != WL_CONNECTED)
        return;

    HTTPClient http;

    String url = String(API_BASE_URL) + "/device-command";

    http.begin(url);

    int httpCode = http.GET();

    if (httpCode == 200)
    {
        String payload = http.getString();

        StaticJsonDocument<200> doc;
        deserializeJson(doc, payload);

        int led = doc["led"];
        int fan = doc["fan"];

        digitalWrite(LED_PIN, led);
        digitalWrite(RELAY_PIN, fan);

        Serial.println("Device command received");
    }

    http.end();
}

void setup()
{
    Serial.begin(115200);

    pinMode(LED_PIN, OUTPUT);
    pinMode(RELAY_PIN, OUTPUT);

    dht.begin();

    connectWiFi();
}

void loop()
{
    if (millis() - lastSend > SEND_INTERVAL)
    {
        float temperature = readTemperature();
        float humidity = readHumidity();
        int light = readLight();

        // Validate sensor readings
        if (isnan(temperature))
        {
            Serial.println("Failed to read temperature!");
            lastSend = millis();
            return;
        }

        if (isnan(humidity))
        {
            Serial.println("Failed to read humidity!");
            lastSend = millis();
            return;
        }

        Serial.println("----- SENSOR DATA -----");
        Serial.println("Temp: " + String(temperature));
        Serial.println("Humidity: " + String(humidity));
        Serial.println("Light: " + String(light));

        sendSensorData(temperature, humidity, light);

        getDeviceCommand();

        lastSend = millis();
    }
}
