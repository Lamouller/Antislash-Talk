"""
Service de transcription PyTorch OPTIONNEL
Fonctionne en PARALLÈLE avec les APIs existantes (Gemini, OpenAI, etc.)
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import whisper
import tempfile
import os
from pathlib import Path
from typing import Optional, List, Dict
import logging

# Configuration logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Antislash Talk - Transcription Service (PyTorch)",
    description="Service OPTIONNEL de transcription avec Whisper V3 + Diarisation",
    version="1.0.0"
)

# CORS restreint aux domaines autorisés
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://riquelme-talk.antislash.studio",
        "https://app.riquelme-talk.antislash.studio",
        "https://api.riquelme-talk.antislash.studio",
        "http://localhost:5173",
        "http://localhost:3000",
        "capacitor://localhost",
        "http://localhost",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# État du service
SERVICE_STATUS = {
    "available": False,
    "model_loaded": False,
    "diarization_available": False,
    "device": "cpu",
    "error": None
}

# Modèles chargés (lazy loading)
whisper_model = None
whisper_model_name = None  # Tracker du nom du modèle chargé
diarization_pipeline = None

class TranscriptionRequest(BaseModel):
    """Requête de transcription"""
    audio_url: Optional[str] = None
    language: str = "fr"
    model: str = "medium"  # tiny, base, small, medium, large, large-v2, large-v3
    enable_diarization: bool = False
    task: str = "transcribe"  # transcribe ou translate

class TranscriptionResponse(BaseModel):
    """Réponse de transcription"""
    transcript: str
    language: str
    segments: List[Dict]
    speakers: Optional[List[Dict]] = None
    model_used: str
    processing_time: float

@app.get("/health")
async def health_check():
    """Health check pour Docker"""
    return {
        "status": "healthy",
        "service": "transcription-pytorch",
        **SERVICE_STATUS
    }

@app.get("/status")
async def get_status():
    """État détaillé du service"""
    # Check if HuggingFace token is available for diarization
    hf_token = os.getenv("HUGGINGFACE_TOKEN")
    diarization_can_be_enabled = bool(hf_token and hf_token.strip())
    
    return {
        "service": "transcription-pytorch",
        "torch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "device": SERVICE_STATUS["device"],
        "models": {
            "whisper": SERVICE_STATUS["model_loaded"],
            "diarization": SERVICE_STATUS["diarization_available"] or diarization_can_be_enabled
        }
    }

@app.post("/download-pyannote")
async def download_pyannote():
    """Force le téléchargement des modèles Pyannote pour la diarization"""
    hf_token = os.getenv("HUGGINGFACE_TOKEN")
    
    if not hf_token or not hf_token.strip():
        raise HTTPException(
            status_code=400,
            detail="HUGGINGFACE_TOKEN not configured. Please set it in docker-compose.monorepo.yml"
        )
    
    try:
        logger.info("📥 Starting Pyannote models download...")
        success = load_diarization_model()
        
        if success:
            return {
                "status": "success",
                "message": "Pyannote models downloaded successfully",
                "diarization_available": True
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to download Pyannote models"
            )
    except Exception as e:
        logger.error(f"Error downloading Pyannote: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Download failed: {str(e)}"
        )

def load_whisper_model(model_name: str = "medium"):
    """Charge le modèle Whisper (lazy loading)"""
    global whisper_model, whisper_model_name, SERVICE_STATUS
    
    try:
        logger.info(f"Loading Whisper model: {model_name}")
        
        # Détection du device (GPU si disponible)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        SERVICE_STATUS["device"] = device
        
        # Chargement du modèle
        whisper_model = whisper.load_model(model_name, device=device)
        whisper_model_name = model_name  # Stocker le nom du modèle
        SERVICE_STATUS["model_loaded"] = True
        SERVICE_STATUS["available"] = True
        
        logger.info(f"✅ Whisper {model_name} loaded on {device}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to load Whisper: {e}")
        SERVICE_STATUS["error"] = str(e)
        SERVICE_STATUS["available"] = False
        return False

def load_diarization_model():
    """Charge le modèle de diarisation (optionnel)"""
    global diarization_pipeline, SERVICE_STATUS
    
    try:
        logger.info("Loading pyannote diarization model...")
        
        # Note: Nécessite un token HuggingFace pour pyannote
        # À configurer via variable d'environnement HUGGINGFACE_TOKEN
        hf_token = os.getenv("HUGGINGFACE_TOKEN")
        
        if not hf_token:
            logger.warning("⚠️ HUGGINGFACE_TOKEN not set - diarization disabled")
            return False
        
        from pyannote.audio import Pipeline
        diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token
        )
        
        # Utilise GPU si disponible
        if torch.cuda.is_available():
            diarization_pipeline.to(torch.device("cuda"))
        
        SERVICE_STATUS["diarization_available"] = True
        logger.info("✅ Diarization model loaded")
        return True
        
    except Exception as e:
        logger.error(f"⚠️ Diarization not available: {e}")
        SERVICE_STATUS["diarization_available"] = False
        return False

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("fr"),
    model: str = Form("medium"),
    enable_diarization: bool = Form(False)
):
    """
    Transcription d'un fichier audio avec Whisper V3
    
    Ce endpoint est OPTIONNEL et complète les APIs existantes (Gemini, OpenAI)
    """
    import time
    start_time = time.time()
    
    # Log des paramètres reçus
    logger.info(f"📥 Received: model={model}, language={language}, enable_diarization={enable_diarization}")
    
    # Charger le modèle si nécessaire (lazy loading)
    global whisper_model, whisper_model_name
    if whisper_model is None or whisper_model_name != model:
        logger.info(f"🔄 Loading Whisper model: {model}")
        if not load_whisper_model(model):
            raise HTTPException(
                status_code=503,
                detail="Failed to load model. Fallback to API providers."
            )
    
    # Sauvegarder le fichier temporairement
    temp_dir = tempfile.mkdtemp()
    audio_path = Path(temp_dir) / file.filename
    
    try:
        # Écrire le fichier audio
        with open(audio_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"Transcribing {file.filename} with Whisper {model}")
        
        # Transcription avec Whisper
        result = whisper_model.transcribe(
            str(audio_path),
            language=language,
            task="transcribe",
            verbose=False
        )
        
        # Extraction des segments
        segments = [
            {
                "id": seg["id"],
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
            }
            for seg in result["segments"]
        ]
        
        # Diarisation (optionnel)
        speakers = None
        if enable_diarization:
            # Charger le modèle de diarisation si pas encore fait
            if not SERVICE_STATUS["diarization_available"]:
                logger.info("🔄 Loading diarization model (first time)...")
                load_diarization_model()
            
            # Utiliser la diarisation si disponible
            if SERVICE_STATUS["diarization_available"]:
                try:
                    logger.info("Performing speaker diarization...")
                    diarization = diarization_pipeline(str(audio_path))
                    
                    speakers = []
                    for turn, _, speaker in diarization.itertracks(yield_label=True):
                        speakers.append({
                            "speaker": speaker,
                            "start": turn.start,
                            "end": turn.end
                        })
                    
                    logger.info(f"✅ Identified {len(set([s['speaker'] for s in speakers]))} speakers")
                    
                except Exception as e:
                    logger.error(f"⚠️ Diarization failed: {e}")
            else:
                logger.warning("⚠️ Diarization requested but model not available (check HUGGINGFACE_TOKEN)")
        
        processing_time = time.time() - start_time
        
        return TranscriptionResponse(
            transcript=result["text"],
            language=result["language"],
            segments=segments,
            speakers=speakers,
            model_used=f"whisper-{model}",
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}. Use API providers as fallback."
        )
    
    finally:
        # Nettoyage
        try:
            audio_path.unlink(missing_ok=True)
            Path(temp_dir).rmdir()
        except Exception as e:
            logger.warning(f"Cleanup warning: {e}")

@app.on_event("startup")
async def startup_event():
    """Initialisation au démarrage"""
    logger.info("🚀 Starting Transcription Service (PyTorch)")
    logger.info(f"PyTorch version: {torch.__version__}")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    
    # Pré-charger le modèle par défaut (optionnel)
    # load_whisper_model("medium")
    # load_diarization_model()
    
    logger.info("✅ Service ready (models will load on first request)")

@app.on_event("shutdown")
async def shutdown_event():
    """Nettoyage à l'arrêt"""
    logger.info("🛑 Shutting down Transcription Service")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

