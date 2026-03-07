# AI Service Skeleton

Goal:

- Receive images from a camera or upload flow.
- Predict the plant type.
- Return `plant_type`, `confidence`, and `timestamp`.

## Tasks

- Choose a framework: Flask/FastAPI.
- Prepare a dataset for 3 plant types:
  - lettuce
  - mustard greens
  - water spinach
- Train and run the model.
- Store prediction history.

## API Notes

- `POST /ai/predict-plant`
- `GET /ai/history`
