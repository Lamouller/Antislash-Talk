"""
🏆 WhisperX API Server
Ultra-fast transcription with diarization
Combines: faster-whisper + phoneme alignment + speaker diarization
"""

import os
import time
import tempfile
from pathlib import Path
from typing import Optional, List
import logging

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import whisperx
import torch
import json
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="WhisperX Transcription Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"
MODEL_CACHE = {}
HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")

logger.info(f"🚀 WhisperX initialized on {DEVICE} with {COMPUTE_TYPE}")
logger.info(f"🔑 HuggingFace token: {'✅ Found' if HUGGINGFACE_TOKEN else '❌ Not set'}")


def get_or_load_model(model_name: str = "base"):
    """Load or retrieve cached WhisperX model"""
    if model_name in MODEL_CACHE:
        logger.info(f"📦 Using cached model: {model_name}")
        return MODEL_CACHE[model_name]
    
    logger.info(f"📥 Loading WhisperX model: {model_name}...")
    start = time.time()
    
    model = whisperx.load_model(
        model_name,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        download_root="/app/models"
    )
    
    MODEL_CACHE[model_name] = model
    logger.info(f"✅ Model loaded in {time.time() - start:.2f}s")
    return model


def check_pyannote_models_downloaded():
    """Check if Pyannote models are actually downloaded"""
    if not HUGGINGFACE_TOKEN:
        return False
    
    try:
        from pyannote.audio import Pipeline as DiarizationPipeline
        # Try to load the model - will fail if not downloaded
        DiarizationPipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=HUGGINGFACE_TOKEN
        )
        return True
    except Exception as e:
        logger.debug(f"Pyannote models not available: {e}")
        return False


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Check if Pyannote models are actually downloaded (not just token present)
    diarization_available = check_pyannote_models_downloaded()
    
    return {
        "status": "ok",
        "backend": "whisperx",
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "gpu_available": torch.cuda.is_available(),
        "diarization_available": diarization_available,
        "version": whisperx.__version__ if hasattr(whisperx, '__version__') else "unknown"
    }


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form("fr"),
    model: Optional[str] = Form("base"),
    diarization: Optional[bool] = Form(False),
    min_speakers: Optional[int] = Form(None),
    max_speakers: Optional[int] = Form(None),
):
    """
    Transcribe audio with optional speaker diarization
    
    Parameters:
    - file: Audio file (any format supported by ffmpeg)
    - language: Language code (fr, en, etc.)
    - model: WhisperX model size (tiny, base, small, medium, large-v2, large-v3)
    - diarization: Enable speaker diarization
    - min_speakers: Minimum number of speakers (optional)
    - max_speakers: Maximum number of speakers (optional)
    """
    
    logger.info(f"🎙️ Transcription request: model={model}, language={language}, diarization={diarization}")
    
    start_time = time.time()
    temp_audio_path = None
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            temp_audio_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        logger.info(f"📤 Audio saved: {len(content) / 1024:.2f} KB")
        
        # Step 1: Load model
        whisper_model = get_or_load_model(model)
        
        # Step 2: Transcribe
        logger.info("🔊 Starting transcription...")
        transcribe_start = time.time()
        result = whisper_model.transcribe(
            temp_audio_path,
            language=language,
            batch_size=16
        )
        transcribe_time = time.time() - transcribe_start
        logger.info(f"✅ Transcription completed in {transcribe_time:.2f}s")
        
        # Step 3: Align timestamps (phoneme-level precision)
        logger.info("⏱️ Aligning timestamps...")
        align_start = time.time()
        model_a, metadata = whisperx.load_align_model(
            language_code=result.get("language", language),
            device=DEVICE
        )
        result = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            temp_audio_path,
            DEVICE,
            return_char_alignments=False
        )
        align_time = time.time() - align_start
        logger.info(f"✅ Alignment completed in {align_time:.2f}s")
        
        segments = result["segments"]
        
        # Step 4: Speaker diarization (if requested and token available)
        if diarization and HUGGINGFACE_TOKEN:
            logger.info("🎭 Starting speaker diarization...")
            diarize_start = time.time()
            
            try:
                # Use pyannote.audio directly (new WhisperX API)
                from pyannote.audio import Pipeline as DiarizationPipeline
                
                diarize_model = DiarizationPipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=HUGGINGFACE_TOKEN
                )
                diarize_model.to(torch.device(DEVICE))
                
                diarize_segments = diarize_model(
                    temp_audio_path,
                    min_speakers=min_speakers,
                    max_speakers=max_speakers
                )
                
                result = whisperx.assign_word_speakers(diarize_segments, result)
                segments = result["segments"]
                
                diarize_time = time.time() - diarize_start
                logger.info(f"✅ Diarization completed in {diarize_time:.2f}s")
            except Exception as e:
                logger.error(f"❌ Diarization failed: {e}")
                logger.warning("⚠️ Continuing without diarization")
                diarize_time = 0
        elif diarization and not HUGGINGFACE_TOKEN:
            logger.warning("⚠️ Diarization requested but HUGGINGFACE_TOKEN not set")
            diarize_time = 0
        
        # Format response
        total_time = time.time() - start_time
        
        # Extract full text
        full_text = " ".join([seg.get("text", "").strip() for seg in segments])
        
        # Format segments
        formatted_segments = []
        for i, seg in enumerate(segments):
            formatted_segments.append({
                "id": i,
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": seg.get("text", "").strip(),
                "speaker": seg.get("speaker", None) if diarization else None
            })
        
        logger.info(f"🎉 Total processing time: {total_time:.2f}s")
        logger.info(f"📊 Performance: {len(content) / 1024 / total_time:.2f} KB/s")
        
        return JSONResponse({
            "text": full_text,
            "segments": formatted_segments,
            "language": result.get("language", language),
            "processing_time": {
                "transcription": transcribe_time,
                "alignment": align_time,
                "diarization": diarize_time if diarization and HUGGINGFACE_TOKEN else 0,
                "total": total_time
            },
            "backend": "whisperx",
            "model": model,
            "device": DEVICE,
            "diarization_enabled": diarization and HUGGINGFACE_TOKEN is not None
        })
        
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup temp file
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)


@app.post("/transcribe-stream")
async def transcribe_stream(
    file: UploadFile = File(...),
    language: Optional[str] = Form("fr"),
    model: Optional[str] = Form("base"),
    diarization: Optional[bool] = Form(False),
):
    """
    🚀 Streaming transcription endpoint
    Returns Server-Sent Events (SSE) with real-time segments
    """
    from streaming_endpoint import transcribe_streaming_generator
    
    logger.info(f"🎙️ STREAMING transcription request: model={model}, language={language}")
    
    temp_audio_path = None
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            temp_audio_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        logger.info(f"📤 Audio saved for streaming: {len(content) / 1024:.2f} KB")
        
        # Load model
        whisper_model = get_or_load_model(model)
        
        # Create streaming generator
        generator = transcribe_streaming_generator(
            temp_audio_path=temp_audio_path,
            model=whisper_model,
            language=language,
            device=DEVICE,
            huggingface_token=HUGGINGFACE_TOKEN,
            diarization=diarization
        )
        
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Streaming transcription error: {e}")
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pyannote-models")
async def list_pyannote_models():
    """List Pyannote models and their download status"""
    if not HUGGINGFACE_TOKEN:
        return {
            "available": False,
            "reason": "HUGGINGFACE_TOKEN not set",
            "models": []
        }
    
    from pyannote.audio import Pipeline as DiarizationPipeline
    
    models = [
        {
            "id": "pyannote/speaker-diarization-3.1",
            "name": "Speaker Diarization 3.1",
            "size": "1.5 GB",
            "description": "Main diarization model",
            "required": True,
            "main": True
        },
        {
            "id": "pyannote/segmentation-3.0",
            "name": "Segmentation 3.0",
            "size": "900 MB",
            "description": "Auto-downloaded with main model",
            "required": True,
            "main": False
        },
        {
            "id": "pyannote/wespeaker-voxceleb-resnet34-LM",
            "name": "Speaker Embeddings",
            "size": "500 MB",
            "description": "Auto-downloaded with main model",
            "required": True,
            "main": False
        }
    ]
    
    # Check each model
    for model in models:
        try:
            DiarizationPipeline.from_pretrained(
                model["id"],
                use_auth_token=HUGGINGFACE_TOKEN
            )
            model["downloaded"] = True
        except:
            model["downloaded"] = False
    
    return {
        "available": True,
        "models": models
    }


@app.post("/download-pyannote-model")
async def download_pyannote_model(model_id: str = Form(...)):
    """Download a specific Pyannote model"""
    if not HUGGINGFACE_TOKEN:
        raise HTTPException(
            status_code=400,
            detail="HUGGINGFACE_TOKEN not set. Cannot download Pyannote models."
        )
    
    try:
        logger.info(f"📥 Downloading Pyannote model: {model_id}")
        
        from pyannote.audio import Pipeline as DiarizationPipeline
        
        # Download the model
        DiarizationPipeline.from_pretrained(
            model_id,
            use_auth_token=HUGGINGFACE_TOKEN
        )
        
        logger.info(f"✅ Model {model_id} downloaded successfully!")
        
        return {
            "status": "success",
            "model_id": model_id
        }
        
    except Exception as e:
        logger.error(f"❌ Model download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download-models")
async def download_models(model: str = Form("base")):
    """Pre-download models for faster first run (Whisper or Pyannote)"""
    try:
        logger.info(f"📥 Downloading model: {model}")
        
        # If Pyannote diarization model requested (legacy endpoint - downloads all)
        if model == "pyannote":
            if not HUGGINGFACE_TOKEN:
                raise HTTPException(
                    status_code=400,
                    detail="HUGGINGFACE_TOKEN not set. Cannot download Pyannote models."
                )
            
            logger.info("🎭 Downloading Pyannote diarization models...")
            logger.info("   └─ This may take 5-10 minutes for first download (2.88 GB)")
            
            from pyannote.audio import Pipeline as DiarizationPipeline
            
            # Download diarization model (will auto-download dependencies)
            logger.info("   └─ Downloading pyannote/speaker-diarization-3.1...")
            diarize_model = DiarizationPipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=HUGGINGFACE_TOKEN
            )
            logger.info("   └─ ✅ All models downloaded")
            
            return {
                "status": "success",
                "model": "pyannote",
                "models_downloaded": [
                    "pyannote/speaker-diarization-3.1",
                    "pyannote/segmentation-3.0 (automatic)",
                    "pyannote/wespeaker-voxceleb-resnet34-LM (automatic)"
                ]
            }
        else:
            # Download Whisper model
            get_or_load_model(model)
            return {"status": "success", "model": model}
            
    except Exception as e:
        logger.error(f"❌ Model download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════
# 🎭 LIVE DIARIZATION WEBSOCKET - Real-time speaker identification
# ═══════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/live-diarization")
async def websocket_live_diarization(websocket: WebSocket):
    """
    🎭 Live Speaker Diarization via WebSocket
    
    Protocol:
    - Connect: ws://localhost:8082/ws/live-diarization
    - Send: Binary audio chunks (PCM 16kHz, 16-bit, mono)
    - Receive: JSON messages
      {"type": "speaker", "speaker": "SPEAKER_01", "confidence": 0.92}
      {"type": "speaker_change", "from": "SPEAKER_01", "to": "SPEAKER_02"}
    
    Usage with Gemini Live:
    1. Start Gemini Live WebSocket for text transcription
    2. Start this WebSocket for speaker identification
    3. Combine results: Gemini text + Pyannote speaker
    """
    try:
        from live_diarization import handle_live_diarization
        await handle_live_diarization(websocket)
    except Exception as e:
        logger.error(f"❌ Live diarization error: {e}")
        await websocket.close(code=1011, reason=str(e))


@app.get("/live-diarization/status")
async def live_diarization_status():
    """Check if live diarization is available"""
    try:
        # Check if models can be loaded
        has_hf_token = HUGGINGFACE_TOKEN is not None
        
        # Try to check Pyannote model availability
        pyannote_available = False
        if has_hf_token:
            try:
                from pyannote.audio import Model
                pyannote_available = True
            except:
                pass
        
        return {
            "available": has_hf_token and pyannote_available,
            "huggingface_token": has_hf_token,
            "pyannote_model": pyannote_available,
            "device": DEVICE,
            "gpu_available": torch.cuda.is_available(),
            "endpoint": "ws://localhost:8082/ws/live-diarization",
            "protocol": {
                "input": "Binary PCM audio (16kHz, 16-bit, mono)",
                "output": "JSON messages with speaker identification"
            }
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)

