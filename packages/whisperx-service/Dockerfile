# ============================================
# WhisperX Service Dockerfile
# Ultra-rapide : faster-whisper + alignement + diarization
# ============================================

FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install WhisperX and dependencies
RUN pip install --no-cache-dir \
    whisperx \
    fastapi \
    uvicorn[standard] \
    python-multipart \
    torch \
    torchaudio \
    pyannote.audio \
    scipy \
    websockets \
    && rm -rf /root/.cache/pip

# Create models directory
RUN mkdir -p /app/models

# Copy API server and modules
COPY server.py /app/server.py
COPY streaming_endpoint.py /app/streaming_endpoint.py
COPY live_diarization.py /app/live_diarization.py

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8082/health || exit 1

# Run server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8082", "--workers", "1"]

