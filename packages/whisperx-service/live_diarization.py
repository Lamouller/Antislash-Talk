"""
🎭 Live Speaker Diarization with Pyannote
Real-time speaker identification via WebSocket

Architecture:
1. Client sends audio chunks (PCM 16kHz) via WebSocket
2. Server uses Pyannote VAD to detect speech segments
3. Server extracts speaker embeddings for each segment
4. Server compares embeddings to identify/cluster speakers
5. Server sends speaker change events back to client

Usage:
- Connect to ws://localhost:8082/ws/live-diarization
- Send audio chunks as binary (PCM 16kHz, 16-bit, mono)
- Receive JSON messages: {"speaker": "SPEAKER_01", "confidence": 0.92}
"""

import os
import io
import json
import time
import asyncio
import logging
import tempfile
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field

import torch
import torchaudio
from fastapi import WebSocket, WebSocketDisconnect
from scipy.spatial.distance import cosine

# Fix PyTorch serialization for Pyannote models (PyTorch 2.6+ security)
# PyTorch 2.6 changed weights_only default to True, blocking many model loads
# We trust Pyannote models from HuggingFace, so disable this restriction
_original_torch_load = torch.load

def _patched_torch_load(*args, **kwargs):
    """Patched torch.load that defaults to weights_only=False for Pyannote compatibility"""
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_torch_load(*args, **kwargs)

torch.load = _patched_torch_load

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")

# Models (lazy loaded)
_vad_model = None
_vad_utils = None  # Silero VAD utilities
_embedding_model = None


@dataclass
class SpeakerProfile:
    """Profile for a detected speaker"""
    id: str
    embeddings: List[np.ndarray] = field(default_factory=list)
    avg_embedding: Optional[np.ndarray] = None
    
    def add_embedding(self, embedding: np.ndarray):
        """Add new embedding and update average"""
        self.embeddings.append(embedding)
        if len(self.embeddings) > 10:  # Keep last 10 embeddings
            self.embeddings = self.embeddings[-10:]
        self.avg_embedding = np.mean(self.embeddings, axis=0)


class LiveDiarizationSession:
    """Manages a live diarization session"""
    
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.speakers: Dict[str, SpeakerProfile] = {}
        self.current_speaker: Optional[str] = None
        self.speaker_count = 0
        self.audio_buffer = np.array([], dtype=np.float32)
        self.min_speech_duration = 0.3  # Minimum seconds to consider speech
        self.embedding_threshold = 0.4  # Cosine distance threshold for same speaker
        
    def get_or_create_speaker(self, embedding: np.ndarray) -> Tuple[str, float, bool]:
        """
        Find matching speaker or create new one
        Returns: (speaker_id, confidence, is_new)
        """
        if len(self.speakers) == 0:
            # First speaker
            speaker_id = "SPEAKER_01"
            self.speaker_count = 1
            self.speakers[speaker_id] = SpeakerProfile(id=speaker_id)
            self.speakers[speaker_id].add_embedding(embedding)
            return speaker_id, 1.0, True
        
        # Compare with existing speakers
        best_match = None
        best_distance = float('inf')
        
        for speaker_id, profile in self.speakers.items():
            if profile.avg_embedding is not None:
                distance = cosine(embedding, profile.avg_embedding)
                if distance < best_distance:
                    best_distance = distance
                    best_match = speaker_id
        
        # Check if it's the same speaker or a new one
        if best_distance < self.embedding_threshold:
            # Same speaker - update profile
            confidence = 1.0 - best_distance
            self.speakers[best_match].add_embedding(embedding)
            return best_match, confidence, False
        else:
            # New speaker
            self.speaker_count += 1
            speaker_id = f"SPEAKER_{self.speaker_count:02d}"
            self.speakers[speaker_id] = SpeakerProfile(id=speaker_id)
            self.speakers[speaker_id].add_embedding(embedding)
            confidence = 1.0 - best_distance if best_distance < 1.0 else 0.5
            return speaker_id, confidence, True


def get_vad_model():
    """Load Voice Activity Detection model (lazy loading)"""
    global _vad_model, _vad_utils
    if _vad_model is None:
        logger.info("🎤 Loading Silero VAD model...")
        _vad_model, _vad_utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False
        )
        _vad_model = _vad_model.to(DEVICE)
        logger.info("✅ VAD model loaded")
    return _vad_model, _vad_utils


def get_embedding_model():
    """Load speaker embedding model from Pyannote (lazy loading)"""
    global _embedding_model
    if _embedding_model is None:
        if not HUGGINGFACE_TOKEN:
            raise ValueError("HUGGINGFACE_TOKEN required for speaker embeddings")
        
        try:
            logger.info("🧠 Loading Pyannote speaker embedding model...")
            from pyannote.audio import Model
            
            # Load model with explicit weights_only=False for compatibility
            _embedding_model = Model.from_pretrained(
                "pyannote/wespeaker-voxceleb-resnet34-LM",
                use_auth_token=HUGGINGFACE_TOKEN
            )
            _embedding_model = _embedding_model.to(DEVICE)
            _embedding_model.eval()
            logger.info("✅ Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load embedding model: {e}")
            raise
    return _embedding_model


def extract_embedding(audio: np.ndarray, sample_rate: int = 16000) -> Optional[np.ndarray]:
    """Extract speaker embedding from audio segment"""
    try:
        model = get_embedding_model()
        
        # Convert to tensor
        if isinstance(audio, np.ndarray):
            waveform = torch.from_numpy(audio).float().unsqueeze(0)
        else:
            waveform = audio
        
        # Ensure correct shape: (batch, channels, samples)
        if waveform.dim() == 2:
            waveform = waveform.unsqueeze(0)
        
        waveform = waveform.to(DEVICE)
        
        # Extract embedding
        with torch.no_grad():
            embedding = model(waveform)
            
        return embedding.cpu().numpy().flatten()
    except Exception as e:
        logger.error(f"❌ Embedding extraction failed: {e}")
        return None


def detect_speech(audio: np.ndarray, sample_rate: int = 16000) -> List[Tuple[float, float]]:
    """
    Detect speech segments in audio using Silero VAD
    Returns: List of (start_time, end_time) tuples
    """
    try:
        vad_model, vad_utils = get_vad_model()
        
        # Convert to tensor
        if isinstance(audio, np.ndarray):
            waveform = torch.from_numpy(audio).float()
        else:
            waveform = audio
        
        # Get speech timestamps using the utils
        get_speech_timestamps = vad_utils[0]  # First element is the function
        speech_timestamps = get_speech_timestamps(
            waveform,
            vad_model,
            sampling_rate=sample_rate,
            threshold=0.5,
            min_speech_duration_ms=300,
            min_silence_duration_ms=100
        )
        
        # Convert to time ranges
        segments = []
        for ts in speech_timestamps:
            start = ts['start'] / sample_rate
            end = ts['end'] / sample_rate
            segments.append((start, end))
        
        return segments
    except Exception as e:
        logger.error(f"❌ VAD failed: {e}")
        return []


async def handle_live_diarization(websocket: WebSocket):
    """
    Handle WebSocket connection for live diarization
    
    Protocol:
    - Client sends: Binary audio chunks (PCM 16kHz, 16-bit, mono)
    - Server sends: JSON messages with speaker info
      {"type": "speaker", "speaker": "SPEAKER_01", "confidence": 0.92}
      {"type": "speaker_change", "from": "SPEAKER_01", "to": "SPEAKER_02"}
    """
    await websocket.accept()
    logger.info("🔌 Live diarization WebSocket connected")
    
    session = LiveDiarizationSession()
    chunk_buffer = np.array([], dtype=np.float32)
    CHUNK_DURATION = 2.0  # Process every 2 seconds
    SAMPLE_RATE = 16000
    
    try:
        # Send ready message
        await websocket.send_json({
            "type": "ready",
            "message": "Live diarization ready",
            "sample_rate": SAMPLE_RATE
        })
        
        while True:
            # Receive audio chunk
            data = await websocket.receive()
            
            if "bytes" in data:
                # Convert PCM bytes to float32
                audio_data = data["bytes"]
                audio_int16 = np.frombuffer(audio_data, dtype=np.int16)
                audio_float = audio_int16.astype(np.float32) / 32768.0
                
                # Add to buffer
                chunk_buffer = np.concatenate([chunk_buffer, audio_float])
                
                # Process when we have enough audio
                samples_needed = int(CHUNK_DURATION * SAMPLE_RATE)
                
                if len(chunk_buffer) >= samples_needed:
                    # Extract the chunk to process
                    audio_chunk = chunk_buffer[:samples_needed]
                    chunk_buffer = chunk_buffer[samples_needed // 2:]  # 50% overlap
                    
                    # Detect speech in chunk
                    speech_segments = detect_speech(audio_chunk, SAMPLE_RATE)
                    
                    if speech_segments:
                        # Process each speech segment
                        for start, end in speech_segments:
                            start_sample = int(start * SAMPLE_RATE)
                            end_sample = int(end * SAMPLE_RATE)
                            
                            if end_sample > start_sample + int(0.3 * SAMPLE_RATE):  # Min 300ms
                                speech_audio = audio_chunk[start_sample:end_sample]
                                
                                # Extract embedding
                                embedding = extract_embedding(speech_audio, SAMPLE_RATE)
                                
                                if embedding is not None:
                                    # Identify speaker
                                    speaker_id, confidence, is_new = session.get_or_create_speaker(embedding)
                                    
                                    # Send speaker info
                                    if speaker_id != session.current_speaker:
                                        if session.current_speaker:
                                            await websocket.send_json({
                                                "type": "speaker_change",
                                                "from": session.current_speaker,
                                                "to": speaker_id,
                                                "confidence": round(confidence, 2),
                                                "is_new": is_new
                                            })
                                        else:
                                            await websocket.send_json({
                                                "type": "speaker",
                                                "speaker": speaker_id,
                                                "confidence": round(confidence, 2),
                                                "is_new": is_new
                                            })
                                        
                                        session.current_speaker = speaker_id
                                        logger.info(f"🎤 Speaker: {speaker_id} (confidence: {confidence:.2f}, new: {is_new})")
                    
            elif "text" in data:
                # Handle text messages (config, stop, etc.)
                try:
                    msg = json.loads(data["text"])
                    if msg.get("type") == "stop":
                        logger.info("🛑 Stop signal received")
                        break
                    elif msg.get("type") == "reset":
                        session = LiveDiarizationSession()
                        await websocket.send_json({
                            "type": "reset",
                            "message": "Session reset"
                        })
                except json.JSONDecodeError:
                    pass
                    
    except WebSocketDisconnect:
        logger.info("🔌 Client disconnected")
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
    finally:
        # Send final summary
        try:
            await websocket.send_json({
                "type": "summary",
                "total_speakers": len(session.speakers),
                "speakers": list(session.speakers.keys())
            })
        except:
            pass
        logger.info(f"📊 Session ended: {len(session.speakers)} speakers detected")


# Export the handler for FastAPI
__all__ = ['handle_live_diarization']
