import argparse
from datetime import datetime
from pathlib import Path
import sys
import time

import cv2
import requests


def parse_args():
    parser = argparse.ArgumentParser(
        description="Mock an IoT camera device using a laptop webcam and send captures to the backend."
    )
    parser.add_argument("--backend-url", default="http://localhost:3000", help="Backend base URL")
    parser.add_argument("--endpoint", default="/ai/predict-plant/device", help="Device upload endpoint path")
    parser.add_argument("--device-id", default="mock_cam_laptop_01", help="Logical device id")
    parser.add_argument("--device-token", default="plant-device-demo", help="Value for x-device-token header")
    parser.add_argument("--interval", type=int, default=30, help="Capture interval in seconds")
    parser.add_argument("--camera-index", type=int, default=0, help="Webcam index for OpenCV")
    parser.add_argument("--width", type=int, default=1280, help="Preferred capture width")
    parser.add_argument("--height", type=int, default=720, help="Preferred capture height")
    parser.add_argument("--jpeg-quality", type=int, default=85, help="JPEG quality 1-100")
    parser.add_argument("--source", default="iot-camera-laptop-mock", help="Source label sent to backend")
    return parser.parse_args()


def build_session():
    session = requests.Session()
    session.headers.update({"User-Agent": "plant-system-mock-camera/1.0"})
    return session


def ensure_capture_dir():
    capture_dir = Path(__file__).resolve().parent / "captures"
    capture_dir.mkdir(parents=True, exist_ok=True)
    return capture_dir


def open_camera(camera_index, width, height):
    camera = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    if not camera.isOpened():
        camera = cv2.VideoCapture(camera_index)

    if not camera.isOpened():
        raise RuntimeError(f"Cannot open webcam at index {camera_index}")

    camera.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    return camera


def encode_frame(frame, jpeg_quality):
    success, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
    if not success:
        raise RuntimeError("Failed to encode frame to JPEG")
    return buffer.tobytes()


def save_capture(capture_dir, device_id, image_bytes):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_device_id = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in device_id)
    filename = f"{timestamp}_{safe_device_id}.jpg"
    image_path = capture_dir / filename
    image_path.write_bytes(image_bytes)
    return image_path


def send_capture(session, url, token, device_id, source, image_bytes):
    files = {
        "file": ("capture.jpg", image_bytes, "image/jpeg"),
    }
    data = {
        "device_id": device_id,
        "source": source,
    }
    headers = {
        "x-device-token": token,
    }

    response = session.post(url, files=files, data=data, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


def main():
    args = parse_args()
    upload_url = f"{args.backend_url.rstrip('/')}{args.endpoint}"

    print("Starting mock IoT camera")
    print(f"- Backend: {upload_url}")
    print(f"- Device ID: {args.device_id}")
    print(f"- Interval: {args.interval}s")
    capture_dir = ensure_capture_dir()
    print(f"- Local captures: {capture_dir}")
    print("Press Ctrl+C to stop.")

    session = build_session()

    try:
        camera = open_camera(args.camera_index, args.width, args.height)
    except Exception as exc:
        print(f"[fatal] {exc}", file=sys.stderr)
        return 1

    try:
        while True:
            started_at = time.time()
            ok, frame = camera.read()
            if not ok:
                print("[warn] Failed to read frame from webcam", file=sys.stderr)
            else:
                try:
                    image_bytes = encode_frame(frame, args.jpeg_quality)
                    image_path = save_capture(capture_dir, args.device_id, image_bytes)
                    result = send_capture(
                        session=session,
                        url=upload_url,
                        token=args.device_token,
                        device_id=args.device_id,
                        source=args.source,
                        image_bytes=image_bytes,
                    )
                    print(
                        f"[ok] {result.get('timestamp')} plant={result.get('plant_type')} "
                        f"confidence={result.get('confidence')} source={result.get('source')} "
                        f"device_id={result.get('device_id')} capture={image_path}"
                    )
                except requests.HTTPError as exc:
                    body = exc.response.text if exc.response is not None else str(exc)
                    print(f"[http-error] {body}", file=sys.stderr)
                except Exception as exc:
                    print(f"[error] {exc}", file=sys.stderr)

            elapsed = time.time() - started_at
            sleep_for = max(args.interval - elapsed, 0)
            time.sleep(sleep_for)
    except KeyboardInterrupt:
        print("\nStopping mock IoT camera.")
        return 0
    finally:
        camera.release()
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
