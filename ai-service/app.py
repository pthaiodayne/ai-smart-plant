"""
AI service stub.

TODO:
- Choose a Python web framework.
- Load the model when the service starts.
- Expose the prediction API.
- Save prediction history.

Response target:
{
    "plant_type": "lettuce",
    "confidence": 0.92,
    "timestamp": "2026-03-07T10:25:00"
}
"""

import io
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
MODEL_PATH = MODEL_DIR / "fruit_veg_mobilenetv3small_finetuned.keras"
CLASS_NAMES_PATH = MODEL_DIR / "class_names.json"
HISTORY_PATH = BASE_DIR / "prediction_history.json"
IMG_SIZE = (128, 128)


def _load_history() -> list[dict[str, Any]]:
    if not HISTORY_PATH.exists():
        return []
    try:
        with HISTORY_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
    except Exception:
        return []
    return []


def _save_history(items: list[dict[str, Any]]) -> None:
    with HISTORY_PATH.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def _load_model_and_classes() -> tuple[tf.keras.Model, list[str]]:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    if not CLASS_NAMES_PATH.exists():
        raise FileNotFoundError(f"Class names not found: {CLASS_NAMES_PATH}")

    model = tf.keras.models.load_model(MODEL_PATH)
    with CLASS_NAMES_PATH.open("r", encoding="utf-8") as f:
        class_names = json.load(f)
    if not isinstance(class_names, list) or not class_names:
        raise ValueError("class_names.json must be a non-empty list")
    return model, class_names


def _predict_plant(
    image_bytes: bytes,
    model: tf.keras.Model,
    class_names: list[str],
) -> dict[str, Any]:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc

    image = image.resize(IMG_SIZE)
    image_np = np.asarray(image, dtype=np.float32)
    image_batch = np.expand_dims(image_np, axis=0)

    probs = model.predict(image_batch, verbose=0)[0]
    pred_idx = int(np.argmax(probs))
    confidence = float(probs[pred_idx])
    timestamp = datetime.now(timezone.utc).isoformat()

    return {
        "plant_type": class_names[pred_idx],
        "confidence": round(confidence, 4),
        "timestamp": timestamp,
    }


def create_app() -> FastAPI:
    app = FastAPI(title="Plant AI Service", version="1.0.0")

    try:
        model, class_names = _load_model_and_classes()
    except Exception as exc:
        # Keep startup explicit so local testing fails fast when assets are missing.
        raise RuntimeError(f"Failed to initialize AI service: {exc}") from exc

    history = _load_history()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/ai/predict-plant")
    async def predict_plant(file: UploadFile = File(...)) -> dict[str, Any]:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        result = _predict_plant(image_bytes, model, class_names)
        history.append(result)
        _save_history(history)
        return result

    @app.get("/ai/history")
    def get_history() -> dict[str, Any]:
        return {"count": len(history), "items": history}

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
