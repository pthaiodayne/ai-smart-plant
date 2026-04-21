import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAiLatest,
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
    if (Number.isNaN(date.getTime())) return "N/A";

    const tz = "Asia/Bangkok";
    const datePart = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: tz,
    }).format(date);
    const timePart = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(date);
    return `${datePart} ${timePart} GMT+7`;
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
          <div className="trend-label">{formatDateTime(item.timestamp).split(" ")[1] || "N/A"}</div>
          <div className="trend-col">
            <span className="trend-temp">{item.temperature.toFixed(1)} C</span>
            <div className="trend-fill" style={{ height: `${(item.temperature / maxTemp) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatMetric(value, digits = 1) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "0.0";
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
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [lastCaptureAt, setLastCaptureAt] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoCaptureIntervalRef = useRef(null);
  const detectInFlightRef = useRef(false);
  const previewUrlRef = useRef("");

  const latestDetection = detection || aiHistory[0] || null;
  const pumpState = systemStatus?.device_status || systemStatus?.device_command || null;
  const isPumpOn = Number(pumpState?.pump ?? pumpState?.led ?? 0) === 1;

  async function refreshData() {
    const [latest, history, status, aiItems, latestDeviceDetection] = await Promise.all([
      getSensorLatest(),
      getSensorHistory(),
      getSystemStatus(),
      getAiHistory(),
      getAiLatest({ source: "iot-camera", fallback: true }).catch(() => null),
    ]);

    const activeDetection = detection || latestDeviceDetection || aiItems[0];
    let profile = null;
    if (activeDetection?.plant_type) {
      try {
        profile = await getPlantProfile(activeDetection.plant_type);
      } catch {
        profile = null;
      }
    }

    setSensorLatest(latest);
    setSensorHistory(history);
    setSystemStatus(status);
    setAiHistory(aiItems);
    if (!detection && latestDeviceDetection) {
      setDetection(latestDeviceDetection);
    }
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
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      stopCameraStream();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autoCaptureIntervalRef.current) {
        clearInterval(autoCaptureIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraEnabled || !cameraReady || !autoCaptureEnabled) {
      if (autoCaptureIntervalRef.current) {
        clearInterval(autoCaptureIntervalRef.current);
        autoCaptureIntervalRef.current = null;
      }
      return;
    }

    autoCaptureIntervalRef.current = setInterval(() => {
      captureAndDetectFromCamera("auto").catch(() => undefined);
    }, 30000);

    return () => {
      if (autoCaptureIntervalRef.current) {
        clearInterval(autoCaptureIntervalRef.current);
        autoCaptureIntervalRef.current = null;
      }
    };
  }, [cameraEnabled, cameraReady, autoCaptureEnabled]);

  const insight = useMemo(() => {
    if (!sensorLatest || !latestDetection) return null;
    return buildIrrigationInsight(sensorLatest, latestDetection, plantProfile);
  }, [sensorLatest, latestDetection, plantProfile]);

  function stopCameraStream() {
    if (autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current);
      autoCaptureIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraEnabled(false);
    setCameraReady(false);
    setAutoCaptureEnabled(false);
  }

  async function startCameraStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setDetectError("Trình duyệt hiện tại không hỗ trợ truy cập camera.");
      return;
    }

    setDetectError("");

    try {
      stopCameraStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraEnabled(true);
      setCameraReady(true);
      setToast("Camera đã sẵn sàng. Có thể bật nhận diện tự động mỗi 30 giây.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setCameraEnabled(false);
      setCameraReady(false);
      setAutoCaptureEnabled(false);
      setDetectError(message ? `Không mở được camera: ${message}` : "Không thể truy cập camera.");
    }
  }

  async function runPlantDetection(file, sourceLabel) {
    setDetectError("");
    setDetecting(true);
    detectInFlightRef.current = true;

    try {
      const result = await predictPlant(file);
      setDetection(result);
      setAiHistory((prev) => [result, ...prev].slice(0, 10));
      setToast(
        sourceLabel === "camera"
          ? "Đã nhận diện cây trồng từ camera."
          : "Đã nhận diện cây trồng từ ảnh upload."
      );

      try {
        const profile = await getPlantProfile(result.plant_type);
        setPlantProfile(profile);
      } catch {
        setPlantProfile(null);
        setToast(`Đã nhận diện: ${result.plant_type}, nhưng chưa có plant profile trong database.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message) {
        setDetectError(`Nhận diện thất bại: ${message}`);
      } else {
        setDetectError("Không thể nhận diện ảnh lúc này. Hãy thử lại sau.");
      }
    } finally {
      detectInFlightRef.current = false;
      setDetecting(false);
    }
  }

  async function captureFrameToFile() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !cameraReady) {
      throw new Error("Camera chưa sẵn sàng để chụp ảnh.");
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Không tạo được vùng vẽ ảnh từ camera.");
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (!value) {
            reject(new Error("Không lấy được ảnh từ camera."));
            return;
          }
          resolve(value);
        },
        "image/jpeg",
        0.92
      );
    });

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(blob);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    const capturedFile = new File([blob], `camera-capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    setCameraFile(capturedFile);

    return capturedFile;
  }

  async function captureAndDetectFromCamera(mode = "manual") {
    if (detectInFlightRef.current) return;

    try {
      const file = await captureFrameToFile();
      setLastCaptureAt(new Date().toISOString());
      await runPlantDetection(file, "camera");
      if (mode === "auto") {
        setToast("Đã tự động chụp từ camera và gửi AI nhận diện.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setDetectError(message || "Không thể chụp ảnh từ camera.");
    }
  }

  function handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setCameraFile(file);
    setDetectError("");
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }

  async function handleDetectFromUpload() {
    if (!cameraFile) {
      setDetectError("Vui lòng chọn ảnh trước khi nhận diện.");
      return;
    }

    await runPlantDetection(cameraFile, "upload");
  }

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
      const isOn = String(value).toLowerCase().startsWith("on") ? 1 : 0;
      setSystemStatus((prev) => ({
        ...(prev || {}),
        device_command: {
          ...(prev?.device_command || {}),
          pump: command === "pump" ? isOn : Number(prev?.device_command?.pump || 0),
          timestamp: new Date().toISOString(),
        },
      }));
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
          <p>{formatMetric(sensorLatest?.temperature)} C</p>
          <small>Thiết bị: {sensorLatest?.device_id}</small>
        </article>
        <article className="metric-card humidity">
          <h3>Độ ẩm không khí</h3>
          <p>{formatMetric(sensorLatest?.humidity)} %</p>
          <small>Cập nhật: {formatDateTime(sensorLatest?.timestamp)}</small>
        </article>
        <article className="metric-card soil">
          <h3>Ánh sáng</h3>
          <p>{formatMetric(sensorLatest?.light)} %</p>
          <small>Cường độ ánh sáng hiện tại</small>
        </article>
        <article className="metric-card soil">
          <h3>Độ ẩm đất</h3>
          <p>{formatMetric(sensorLatest?.soil_moisture)} %</p>
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

          <div className="camera-box">
            <div className="camera-actions">
              <button type="button" disabled={cameraEnabled} onClick={startCameraStream}>
                Mở camera
              </button>
              <button type="button" disabled={!cameraEnabled} onClick={stopCameraStream}>
                Tắt camera
              </button>
              <button
                type="button"
                disabled={!cameraReady || detecting}
                onClick={() => captureAndDetectFromCamera("manual")}
              >
                {detecting ? "Đang nhận diện..." : "Chụp ngay"}
              </button>
            </div>

            <label className="camera-toggle">
              <input
                type="checkbox"
                checked={autoCaptureEnabled}
                disabled={!cameraReady}
                onChange={(event) => setAutoCaptureEnabled(event.target.checked)}
              />
              <span>Tự động capture mỗi 30 giây và gửi cho AI</span>
            </label>

            <div className="camera-stream">
              <video
                ref={videoRef}
                className="camera-preview"
                autoPlay
                playsInline
                muted
              />
              {!cameraEnabled ? <div className="camera-placeholder">Camera chưa bật</div> : null}
            </div>
            <canvas ref={canvasRef} hidden />
          </div>

          <div className="upload-box">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
            />
            <button type="button" disabled={detecting || !cameraFile} onClick={handleDetectFromUpload}>
              {detecting ? "Đang nhận diện..." : "Nhận diện cây trồng"}
            </button>
          </div>
          <p className="helper-text">
            Có thể mở camera để chụp trực tiếp, bật chế độ tự động 30 giây/lần, hoặc chọn ảnh thủ công từ thiết bị.
          </p>
          {cameraEnabled ? (
            <p className="helper-text">
              Trạng thái camera: {autoCaptureEnabled ? "đang tự động nhận diện mỗi 30 giây" : "đang mở"}
              {lastCaptureAt ? ` | Lần chụp gần nhất: ${formatDateTime(lastCaptureAt)}` : ""}
            </p>
          ) : null}
          {detectError ? <p className="helper-text detect-error">{detectError}</p> : null}
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
            <h2>Điều khiển máy bơm từ xa</h2>
            <span>Thiết bị tưới</span>
          </div>
          <div className={`pump-status-card ${isPumpOn ? "on" : "off"}`}>
            <span className="pump-status-label">Trạng thái máy bơm</span>
            <strong>{isPumpOn ? "Đang bật" : "Đang tắt"}</strong>
            <small>Cập nhật: {formatDateTime(pumpState?.timestamp || systemStatus?.last_update)}</small>
          </div>
          <div className="device-grid pump-grid">
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("pump", "on")}>Bật bơm</button>
            <button type="button" disabled={busy} onClick={() => handleDeviceControl("pump", "off")}>Tắt bơm</button>
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
