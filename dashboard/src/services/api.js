const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function normalizeUtcTimestamp(value) {
	if (!value) return new Date().toISOString();
	if (value instanceof Date) return value.toISOString();

	const str = String(value).trim();
	if (!str) return new Date().toISOString();

	// SQLite thường trả kiểu "YYYY-MM-DD HH:mm:ss" (không timezone), ta coi đây là UTC.
	if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
		return str.replace(" ", "T") + "Z";
	}

	// Nếu đã có timezone hoặc định dạng ISO thì giữ nguyên theo Date parser.
	const parsed = new Date(str);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString();
	}

	return new Date().toISOString();
}

async function requestJson(path, options = {}) {
	const res = await fetch(`${API_BASE_URL}${path}`, options);
	if (!res.ok) {
		let detail = "";
		try {
			const body = await res.json();
			detail = body?.error || body?.message || JSON.stringify(body);
		} catch {
			detail = await res.text();
		}
		throw new Error(detail ? `Request failed: ${res.status} - ${detail}` : `Request failed: ${res.status}`);
	}
	return res.json();
}

function normalizeSensor(raw = {}) {
	return {
		temperature: Number(raw.temperature ?? raw.temp ?? 0),
		humidity: Number(raw.humidity ?? 0),
		// Backend hiện lưu trường `light`; tạm ánh xạ để giữ luồng hiển thị hiện tại của dashboard.
		soil_moisture: Number(raw.soil_moisture ?? raw.soilMoisture ?? raw.light ?? 0),
		timestamp: normalizeUtcTimestamp(raw.timestamp),
		device_id: raw.device_id || raw.deviceId || "esp32_01",
	};
}

function normalizePlantProfile(raw = {}) {
	const tempMin = Number(raw.temperature_min);
	const tempMax = Number(raw.temperature_max);
	const humidityMin = Number(raw.humidity_min);
	const humidityMax = Number(raw.humidity_max);
	const lightMin = Number(raw.light_min);
	const lightMax = Number(raw.light_max);

	return {
		plant: raw.plant,
		target: {
			temperature: { min: Number.isFinite(tempMin) ? tempMin : 0, max: Number.isFinite(tempMax) ? tempMax : 0 },
			humidity: { min: Number.isFinite(humidityMin) ? humidityMin : 0, max: Number.isFinite(humidityMax) ? humidityMax : 0 },
			// Dashboard hiện dùng soil_moisture để so sánh; backend đang có light range.
			soil_moisture: { min: Number.isFinite(lightMin) ? lightMin : 0, max: Number.isFinite(lightMax) ? lightMax : 0 },
		},
	};
}

export async function getSensorLatest() {
	const data = await requestJson("/sensor/latest");
	return normalizeSensor(data?.data || data);
}

export async function getSensorHistory() {
	const data = await requestJson("/sensor/history?limit=20");
	const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
	return items.map(normalizeSensor);
}

export async function getAiHistory() {
	const data = await requestJson("/ai/history?limit=20");
	const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
	return items.map((item) => ({
		...item,
		timestamp: normalizeUtcTimestamp(item.timestamp),
	}));
}

export async function getAiLatest(options = {}) {
	const params = new URLSearchParams();
	if (options.source) params.set("source", options.source);
	if (options.fallback != null) params.set("fallback", String(options.fallback));

	const query = params.toString();
	const data = await requestJson(`/ai/latest${query ? `?${query}` : ""}`);
	const item = data?.item || data?.data || data;

	return {
		...item,
		timestamp: normalizeUtcTimestamp(item?.timestamp),
	};
}

export async function predictPlant(file) {
	const formData = new FormData();
	formData.append("file", file);

	return requestJson("/ai/predict-plant", {
		method: "POST",
		body: formData,
	});
}

export async function getPlantProfile(plant) {
	const key = normalizePlantKey(plant);
	const data = await requestJson(`/plant-profile/${encodeURIComponent(key)}`);
	return normalizePlantProfile(data?.data || data);
}

export async function sendDeviceCommand(command, value = "on") {
	const isOn = String(value).toLowerCase().startsWith("on") ? 1 : 0;
	const payload = { device_id: "esp32_1", pump: isOn };

	return requestJson("/device/control", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
}

export async function getSystemStatus() {
	const data = await requestJson("/system/status");
	const payload = data?.data || data;
	return {
		...payload,
		last_update: normalizeUtcTimestamp(payload?.last_update || payload?.timestamp),
	};
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
	const target = profile?.target;
	if (!target) {
		return {
			target: {
				temperature: { min: 0, max: 0 },
				humidity: { min: 0, max: 0 },
				soil_moisture: { min: 0, max: 0 },
			},
			status: { humidityStatus: "unknown", tempStatus: "unknown", soilStatus: "unknown" },
			alerts: [{ severity: "info", text: "Chưa có profile cây từ backend để đưa ra so sánh ngưỡng." }],
			recommendation: {
				action: "Theo dõi",
				durationSec: 0,
				reason: `AI nhận diện: ${detection?.plant_type || "unknown"}`,
			},
		};
	}
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
