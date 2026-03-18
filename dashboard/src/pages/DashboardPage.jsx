import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  buildIrrigationInsight,
  getAiHistory,
  getPlantProfile,
  getSensorHistory,
  getSensorLatest,
  getSystemStatus,
  predictPlant,
  sendDeviceCommand,
} from "../services/api";

function formatDateTime(timestamp) {
  if (!timestamp) return "N/A";
  try {
    const date = new Date(timestamp);
    const datePart = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return `${datePart} ${timePart}`;
  } catch {
    return "N/A";
  }
}

function TrendBars({ history }) {
  const items = history.slice(-10);
  const maxTemp = Math.max(...items.map((item) => item.temperature), 1);
  return (
    <div className="trend-bars">
      {items.map((item) => (
        <div key={item.timestamp} className="trend-item" title={`${item.temperature} C`}>
          <div className="trend-label">{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="trend-col">
            <span className="trend-temp">{item.temperature.toFixed(1)} C</span>
            <div className="trend-fill" style={{ height: `${(item.temperature / maxTemp) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sensorLatest, setSensorLatest] = useState(null);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [aiHistory, setAiHistory] = useState([]);
  const [detection, setDetection] = useState(null);
  const [plantProfile, setPlantProfile] = useState(null);
  const [cameraFile, setCameraFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [toast, setToast] = useState("");
  const [autoDetecting, setAutoDetecting] = useState(false);

  const latestDetection = detection || aiHistory[0] || null;

  async function refreshData() {
    const [latest, history, status, aiItems] = await Promise.all([
      getSensorLatest(),
      getSensorHistory(),
      getSystemStatus(),
      getAiHistory(),
    ]);

    const activeDetection = detection || aiItems[0];
    let profile = null;
    if (activeDetection?.plant_type) {
      profile = await getPlantProfile(activeDetection.plant_type);
    }

    setSensorLatest(latest);
    setSensorHistory(history);
    setSystemStatus(status);
    setAiHistory(aiItems);
    setPlantProfile(profile);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshData();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const intervalId = setInterval(() => {
      refreshData().catch(() => undefined);
    }, 20000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  useEffect(() => {
    if (!cameraFile) return;

    let active = true;
    async function runDetectionInBackground() {
      setAutoDetecting(true);
      try {
        const result = await predictPlant(cameraFile);
        if (!active) return;
        setDetection(result);
        const profile = await getPlantProfile(result.plant_type);
        if (!active) return;
        setPlantProfile(profile);
        setAiHistory((prev) => [result, ...prev].slice(0, 10));
        setToast("AI nhận diện cây trồng từ camera và cập nhật đề xuất.");
      } catch {
        if (!active) return;
        setToast("Không thể nhận diện ảnh camera lúc này.");
      } finally {
        if (active) setAutoDetecting(false);
      }
    }

    runDetectionInBackground();
    return () => {
      active = false;
    };
  }, [cameraFile]);

  const insight = useMemo(() => {
    if (!sensorLatest || !latestDetection) return null;
    return buildIrrigationInsight(sensorLatest, latestDetection, plantProfile);
  }, [sensorLatest, latestDetection, plantProfile]);

  async function handleQuickWatering() {
    if (!insight?.recommendation?.durationSec) {
      setToast("Hệ thống đang ở mức an toàn, chưa cần tưới.");
      return;
    }
    setBusy(true);
    try {
      await sendDeviceCommand("pump", `on:${insight.recommendation.durationSec}s`);
      setToast(`Đã gửi lệnh tưới ${insight.recommendation.durationSec} giây.`);
    } catch {
      setToast("Gửi lệnh đến thiết bị thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeviceControl(command, value) {
    setBusy(true);
    try {
      await sendDeviceCommand(command, value);
      setToast(`Đã gửi lệnh ${command}: ${value}`);
    } catch {
      setToast("Không gửi được lệnh thiết bị.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="page-loading">Dashboard loading ...</div>;
  }

  return (
    <main className="dashboard">
      <header className="hero">
        <div>
          <p className="hero-tag">Remote Farm Control</p>
          <h1>Quản Lý Nông Trại Thông Minh</h1>
          <p className="hero-sub">Giám sát nhiệt độ, độ ẩm và đưa ra đề xuất tưới theo dữ liệu cảm biến và nhận diện AI.</p>
        </div>
        <div className="status-chip">
          <span>Hệ thống</span>
          <strong>{systemStatus?.connectivity || "online"}</strong>
          <small>Cập nhật: {formatDateTime(systemStatus?.last_update || sensorLatest?.timestamp)}</small>
        </div>
      </header>

      {toast ? <div className="toast">{toast}</div> : null}

      <section className="metrics-grid">
        <article className="metric-card temp">
          <h3>Nhiệt độ</h3>
          <p>{sensorLatest?.temperature?.toFixed(1)} C</p>
          <small>Thiết bị: {sensorLatest?.device_id}</small>
        </article>
        <article className="metric-card humidity">
          <h3>Độ ẩm không khí</h3>
          <p>{sensorLatest?.humidity?.toFixed(1)} %</p>
          <small>Cập nhật: {formatDateTime(sensorLatest?.timestamp)}</small>
        </article>
        <article className="metric-card soil">
          <h3>Độ ẩm đất</h3>
          <p>{sensorLatest?.soil_moisture?.toFixed(1)} %</p>
          <small>Ngưỡng theo cây từ dữ liệu cung cấp</small>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel trend">
          <div className="panel-head">
            <h2>Xu hướng nhiệt độ gần đây</h2>
            <span>{sensorHistory.length} điểm đo</span>
          </div>
          <TrendBars history={sensorHistory} />
        </article>

        <article className="panel compare-panel">
          <div className="panel-head">
            <h2>So sánh dữ liệu với ngưỡng dữ liệu tiêu chuẩn</h2>
          </div>
          {insight ? (
            <div className="compare-table" role="table" aria-label="db-comparison">
              <div className="row">
                <span>Nhiệt độ</span>
                <span>
                  {sensorLatest.temperature.toFixed(1)} C / [{insight.target.temperature.min}-{insight.target.temperature.max}] C
                </span>
                <strong className={`state ${insight.status.tempStatus}`}>{insight.status.tempStatus}</strong>
              </div>
              <div className="row">
                <span>Độ ẩm không khí</span>
                <span>
                  {sensorLatest.humidity.toFixed(1)} % / [{insight.target.humidity.min}-{insight.target.humidity.max}] %
                </span>
                <strong className={`state ${insight.status.humidityStatus}`}>{insight.status.humidityStatus}</strong>
              </div>
              <div className="row">
                <span>Độ ẩm đất</span>
                <span>
                  {sensorLatest.soil_moisture.toFixed(1)} % / [{insight.target.soil_moisture.min}-{insight.target.soil_moisture.max}] %
                </span>
                <strong className={`state ${insight.status.soilStatus}`}>{insight.status.soilStatus}</strong>
              </div>
            </div>
          ) : (
            <p>Cần có kết quả AI và dữ liệu sensor để so sánh.</p>
          )}
        </article>

        <article className="panel alert-panel">
          <div className="panel-head">
            <h2>Cảnh báo và gợi ý tưới nước</h2>
            <span>Dựa trên dữ liệu tiêu chuẩn</span>
          </div>
          {insight?.alerts?.map((item, index) => (
            <div key={`${item.text}-${index}`} className={`alert ${item.severity}`}>
              {item.text}
            </div>
          ))}

          {insight ? (
            <div className="recommendation">
              <h4>{insight.recommendation.action}</h4>
              <p>{insight.recommendation.reason}</p>
              <button type="button" disabled={busy} onClick={handleQuickWatering}>
                Bật bơm theo gợi ý ({insight.recommendation.durationSec}s)
              </button>
            </div>
          ) : null}
        </article>

        <article className="panel ai-panel">
          <div className="panel-head">
            <h2>Nhận diện AI</h2>
            <span>{latestDetection ? `Độ tin cậy ${Math.round(latestDetection.confidence * 100)}%` : "Chưa có kết quả"}</span>
          </div>

          <div className="upload-box">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setCameraFile(file);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(file));
              }}
            />
          </div>
          <p className="helper-text">
            AI tự động cập nhật theo cây trồng từ ảnh camera được cập nhật. Kết quả dùng để nhận biết cây đang trồng và sinh đề xuất tưới.
          </p>
          {autoDetecting ? <p className="helper-text">Đang nhận diện ảnh ngầm...</p> : null}
          {previewUrl ? <img className="preview" src={previewUrl} alt="Xem trước ảnh camera" /> : null}
          {latestDetection ? (
            <div className="detect-result">
              <h4>Cây nhận diện: {latestDetection.plant_type}</h4>
              <p>Thời gian: {formatDateTime(latestDetection.timestamp)}</p>
            </div>
          ) : null}
        </article>

        <article className="panel device-panel">
          <div className="panel-head">
            <h2>Điều khiển thiết bị từ xa</h2>
            <span>Pump, Fan, Grow Light</span>
          </div>
          <div className="device-grid">
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("pump", "on")}>Bật bơm</button>
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("pump", "off")}>Tắt bơm</button>
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("fan", "on")}>Bật quạt</button>
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("fan", "off")}>Tắt quạt</button>
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("light", "on")}>Bật đèn</button>
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("light", "off")}>Tắt đèn</button>
          </div>
        </article>

        <article className="panel history-panel">
          <div className="panel-head">
            <h2>Lịch sử AI detection</h2>
            <span>{aiHistory.length} bản ghi</span>
          </div>
          <ul className="history-list">
            {aiHistory.slice(0, 6).map((item) => (
              <li key={`${item.timestamp}-${item.plant_type}`}>
                <span>{item.plant_type}</span>
                <span>{Math.round(item.confidence * 100)}%</span>
                <small>{formatDateTime(item.timestamp)}</small>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
