# Build context must be the repo root (parent of ml-service/).
# fly deploy and docker build are both run from the repo root.
FROM python:3.13-slim

WORKDIR /app

COPY ml-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ml-service/main.py ./main.py
COPY ml-service/feature_mapper.py ./feature_mapper.py

# Models are 21 MB total — baked into the image for fast cold starts
COPY models/ ./models/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
