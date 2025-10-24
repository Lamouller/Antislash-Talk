"""
🚀 Streaming endpoint for WhisperX
Server-Sent Events (SSE) for real-time transcription

Format SSE attendu par le client:
event: progress
data: {"status": "...", "progress": 50}

event: segment
data: {"text": "...", "start": 0, "end": 2.5, "speaker": "..."}

event: complete
data: {"total_segments": 10}
"""

import json
import asyncio
import logging

# Configure logging
logger = logging.getLogger(__name__)


async def transcribe_streaming_generator(
    temp_audio_path: str,
    model,
    language: str,
    device: str,
    huggingface_token: str = None,
    diarization: bool = False
):
    """
    Generator that yields transcription segments as Server-Sent Events (SSE)
    Compatible avec le format attendu par le client JavaScript
    """
    import whisperx
    import torch
    from pyannote.audio import Pipeline as DiarizationPipeline
    import time
    import os
    
    logger.info("=" * 60)
    logger.info("🚀 STREAMING TRANSCRIPTION STARTED")
    logger.info(f"📁 Audio file: {temp_audio_path}")
    logger.info(f"🌍 Language: {language}")
    logger.info(f"🖥️  Device: {device}")
    logger.info(f"🎭 Diarization: {diarization}")
    logger.info(f"🔑 HF Token: {'✅ Set' if huggingface_token else '❌ Not set'}")
    logger.info("=" * 60)
    
    try:
        # ========== ÉTAPE 1: TRANSCRIPTION ==========
        logger.info("📊 [STEP 1/3] Starting audio transcription...")
        yield f"event: progress\ndata: {json.dumps({'status': 'Starting transcription...', 'progress': 10})}\n\n"
        await asyncio.sleep(0.05)
        
        transcribe_start = time.time()
        result = model.transcribe(
            temp_audio_path,
            language=language,
            batch_size=16
        )
        transcribe_time = time.time() - transcribe_start
        
        logger.info(f"✅ [STEP 1/3] Transcription completed in {transcribe_time:.2f}s")
        logger.info(f"   └─ Raw segments: {len(result.get('segments', []))}")
        yield f"event: progress\ndata: {json.dumps({'status': f'Transcription complete ({transcribe_time:.1f}s)', 'progress': 40})}\n\n"
        await asyncio.sleep(0.05)
        
        # ========== ÉTAPE 2: ALIGNEMENT (SKIP POUR LIVE STREAMING) ==========
        # Pour du live streaming, on skip l'alignement car il prend 70s+ pour 10s d'audio
        # Les timestamps de base de Whisper sont suffisamment précis pour du live
        logger.info("⏭️  [STEP 2/3] SKIPPING alignment for live streaming (too slow: ~70s)")
        logger.info("   └─ Using raw Whisper timestamps (good enough for realtime)")
        
        segments = result["segments"]
        total_segments = len(segments)
        logger.info(f"   └─ Raw segments: {total_segments}")
        
        yield f"event: progress\ndata: {json.dumps({'status': 'Skipped alignment (live mode)', 'progress': 60})}\n\n"
        await asyncio.sleep(0.05)
        
        # ========== ÉTAPE 3: DIARIZATION (optionnelle) ==========
        if diarization and huggingface_token:
            logger.info("🎭 [STEP 3/3] Starting speaker diarization...")
            yield f"event: progress\ndata: {json.dumps({'status': 'Identifying speakers...', 'progress': 70})}\n\n"
            await asyncio.sleep(0.05)
            
            try:
                diarize_start = time.time()
                diarize_model = DiarizationPipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=huggingface_token
                )
                diarize_model.to(torch.device(device))
                
                diarize_segments = diarize_model(temp_audio_path)
                result = whisperx.assign_word_speakers(diarize_segments, result)
                segments = result["segments"]
                
                diarize_time = time.time() - diarize_start
                logger.info(f"✅ [STEP 3/3] Diarization completed in {diarize_time:.2f}s")
                
                # Compter les locuteurs uniques
                speakers = set(seg.get("speaker") for seg in segments if seg.get("speaker"))
                logger.info(f"   └─ Unique speakers detected: {len(speakers)}")
                logger.info(f"   └─ Speakers: {', '.join(sorted(speakers)) if speakers else 'None'}")
                
            except Exception as e:
                logger.error(f"❌ Diarization failed: {e}")
                logger.warning("⚠️  Continuing without diarization...")
        else:
            logger.info("⏭️  [STEP 3/3] Diarization skipped (disabled or no HF token)")
        
        # ========== STREAMING DES SEGMENTS ==========
        logger.info(f"📡 STREAMING {total_segments} SEGMENTS TO CLIENT...")
        yield f"event: progress\ndata: {json.dumps({'status': 'Streaming segments...', 'progress': 80})}\n\n"
        await asyncio.sleep(0.05)
        
        for i, seg in enumerate(segments):
            segment_data = {
                "id": i,
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": seg.get("text", "").strip(),
                "speaker": seg.get("speaker", None)
            }
            
            logger.info(f"   └─ [{i+1}/{total_segments}] Speaker: {segment_data['speaker'] or 'Unknown'} | Text: {segment_data['text'][:50]}...")
            
            # Format SSE conforme au client JavaScript
            yield f"event: segment\ndata: {json.dumps(segment_data)}\n\n"
            
            # Petit délai pour effet de streaming visuel
            await asyncio.sleep(0.02)
            
            # Progress update
            progress = 80 + int((i + 1) / total_segments * 15)
            yield f"event: progress\ndata: {json.dumps({'status': f'Segment {i+1}/{total_segments}', 'progress': progress})}\n\n"
        
        # ========== COMPLÉTION ==========
        logger.info("🎉 STREAMING TRANSCRIPTION COMPLETED!")
        logger.info(f"   └─ Total segments: {total_segments}")
        logger.info(f"   └─ Total time: {time.time() - transcribe_start:.2f}s")
        logger.info("=" * 60)
        
        yield f"event: complete\ndata: {json.dumps({'status': 'Transcription complete!', 'progress': 100, 'total_segments': total_segments})}\n\n"
        
        # Cleanup temporary audio file
        if os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)
            logger.info(f"🗑️  Temporary audio file deleted: {temp_audio_path}")
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"❌ STREAMING TRANSCRIPTION FAILED!")
        logger.error(f"   └─ Error: {str(e)}")
        logger.error("=" * 60)
        
        # Cleanup on error
        if os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)
        
        yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

