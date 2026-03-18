const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const MOCK_SENSOR_HISTORY = [
	{ timestamp: "2026-03-18T07:00:00Z", temperature: 29.2, humidity: 58.1, soil_moisture: 42 },
	{ timestamp: "2026-03-18T07:20:00Z", temperature: 29.6, humidity: 56.4, soil_moisture: 40 },
	{ timestamp: "2026-03-18T07:40:00Z", temperature: 30.1, humidity: 55.3, soil_moisture: 38 },
	{ timestamp: "2026-03-18T08:00:00Z", temperature: 30.4, humidity: 54.6, soil_moisture: 36 },
	{ timestamp: "2026-03-18T08:20:00Z", temperature: 30.9, humidity: 53.8, soil_moisture: 34 },
	{ timestamp: "2026-03-18T08:40:00Z", temperature: 31.2, humidity: 53.0, soil_moisture: 33 },
];

const MOCK_AI_HISTORY = [
	{ plant_type: "lettuce", confidence: 0.93, timestamp: "2026-03-18T08:45:00Z" },
	{ plant_type: "lettuce", confidence: 0.89, timestamp: "2026-03-18T08:15:00Z" },
];

const MOCK_PLANT_DB = {
	lettuce: { humidity: { min: 60, max: 75 }, temperature: { min: 18, max: 26 }, soil_moisture: { min: 45, max: 65 } },
	"mustard-greens": { humidity: { min: 55, max: 70 }, temperature: { min: 20, max: 28 }, soil_moisture: { min: 40, max: 60 } },
	"water-spinach": { humidity: { min: 65, max: 85 }, temperature: { min: 22, max: 32 }, soil_moisture: { min: 60, max: 80 } },
};

async function requestJson(path, options = {}) {
	const res = await fetch(`${API_BASE_URL}${path}`, options);
	if (!res.ok) {
		throw new Error(`Request failed: ${res.status}`);
	}
	return res.json();
}

function normalizeSensor(raw = {}) {
	return {
		temperature: Number(raw.temperature ?? raw.temp ?? 0),
		humidity: Number(raw.humidity ?? 0),
		soil_moisture: Number(raw.soil_moisture ?? raw.soilMoisture ?? 0),
		timestamp: raw.timestamp || new Date().toISOString(),
		device_id: raw.device_id || raw.deviceId || "esp32_01",
	};
}

export async function getSensorLatest() {
	try {
		const data = await requestJson("/sensor/latest");
		return normalizeSensor(data?.data || data);
	} catch {
		return normalizeSensor(MOCK_SENSOR_HISTORY[MOCK_SENSOR_HISTORY.length - 1]);
	}
}

export async function getSensorHistory() {
	try {
		const data = await requestJson("/sensor/history");
		const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
		if (!items.length) {
			return MOCK_SENSOR_HISTORY;
		}
		return items.map(normalizeSensor);
	} catch {
		return MOCK_SENSOR_HISTORY;
	}
}

export async function getAiHistory() {
	try {
		const data = await requestJson("/ai/history");
		const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
		return items.length ? items : MOCK_AI_HISTORY;
	} catch {
		return MOCK_AI_HISTORY;
	}
}

export async function predictPlant(file) {
	const formData = new FormData();
	formData.append("file", file);

	try {
		return await requestJson("/ai/predict-plant", {
			method: "POST",
			body: formData,
		});
	} catch {
		return {
			plant_type: "lettuce",
			confidence: 0.91,
			timestamp: new Date().toISOString(),
		};
	}
}

export async function getPlantProfile(plant) {
	const key = normalizePlantKey(plant);
	try {
		const data = await requestJson(`/plant-profile/${encodeURIComponent(key)}`);
		return data?.data || data;
	} catch {
		return {
			plant: key,
			target: MOCK_PLANT_DB[key] || MOCK_PLANT_DB.lettuce,
		};
	}
}

export async function sendDeviceCommand(command, value = "on") {
	try {
		return await requestJson("/device/control", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ command, value }),
		});
	} catch {
		return {
			status: "queued",
			command,
			value,
			timestamp: new Date().toISOString(),
		};
	}
}

export async function getSystemStatus() {
	try {
		const data = await requestJson("/system/status");
		return data?.data || data;
	} catch {
		return {
			connectivity: "online",
			ai_service: "ready",
			pump: "idle",
			fan: "idle",
			last_update: new Date().toISOString(),
		};
	}
}

export function normalizePlantKey(plantName = "") {
	return String(plantName).trim().toLowerCase().replace(/\s+/g, "-");
}

function checkRange(value, range) {
	if (!range || typeof value !== "number") return "unknown";
	if (value < range.min) return "low";
	if (value > range.max) return "high";
	return "ok";
}

export function buildIrrigationInsight(sensor, detection, profile) {
	const target = profile?.target || MOCK_PLANT_DB[normalizePlantKey(detection?.plant_type)] || MOCK_PLANT_DB.lettuce;
	const humidityStatus = checkRange(sensor.humidity, target.humidity);
	const tempStatus = checkRange(sensor.temperature, target.temperature);
	const soilStatus = checkRange(sensor.soil_moisture, target.soil_moisture);

	const alerts = [];
	if (humidityStatus === "low") alerts.push({ severity: "high", text: "Độ ẩm không khí thấp hơn ngưỡng cho phép." });
	if (soilStatus === "low") alerts.push({ severity: "critical", text: "Độ ẩm đất đang thiếu, cần tưới sớm." });
	if (tempStatus === "high") alerts.push({ severity: "medium", text: "Nhiệt độ cao, cần bật quạt để làm mát." });
	if (!alerts.length) alerts.push({ severity: "info", text: "Môi trường đang ổn định theo ngưỡng cây trồng." });

	let wateringAction = "Theo dõi";
	let durationSec = 0;
	if (soilStatus === "low" && humidityStatus === "low") {
		wateringAction = "Tưới ngay";
		durationSec = 45;
	} else if (soilStatus === "low") {
		wateringAction = "Tưới nhẹ";
		durationSec = 25;
	}

	return {
		target,
		status: { humidityStatus, tempStatus, soilStatus },
		alerts,
		recommendation: {
			action: wateringAction,
			durationSec,
			reason: `AI nhận diện: ${detection?.plant_type || "unknown"}, độ tin cậy ${Math.round((detection?.confidence || 0) * 100)}%`,
		},
	};
}
