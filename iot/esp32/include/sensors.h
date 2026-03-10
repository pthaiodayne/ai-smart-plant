#pragma once

#include <DHT.h>
#include "config.h"

DHT dht(DHTPIN, DHTTYPE);

float readTemperature()
{
    return dht.readTemperature();
}

float readHumidity()
{
    return dht.readHumidity();
}

int readLight()
{
    return analogRead(LIGHT_SENSOR_PIN);
}