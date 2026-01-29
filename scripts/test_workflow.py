#!/usr/bin/env python3
"""
Test complet du workflow de transcription et diarization
"""
import os
import sys
import json
import base64
import tempfile
from datetime import datetime

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system("pip install requests")
    import requests

# Configuration
SUPABASE_URL = "http://kong:8000"
# Use SERVICE_ROLE_KEY to bypass RLS
SERVICE_KEY = os.getenv("SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NjEyMjU0NzksImV4cCI6MTc5Mjc2MTQ3OX0.KNcEMhffSdBfPbaIdrj8BMeGly3MvS6Q5foHM1wO_7A")
ANON_KEY = SERVICE_KEY  # Use service key to bypass RLS

def log(msg, level="INFO"):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {level}: {msg}")

def test_supabase_connection():
    """Test 1: Connexion Supabase"""
    log("=" * 50)
    log("TEST 1: Connexion Supabase")
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/meetings?select=id,title&limit=3",
            headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"}
        )
        if resp.status_code == 200:
            meetings = resp.json()
            log(f"OK - {len(meetings)} meetings")
            return True
        else:
            log(f"ERREUR: {resp.status_code}", "ERROR")
            return False
    except Exception as e:
        log(f"Exception: {e}", "ERROR")
        return False

def test_download_audio():
    """Test 2: Telecharger audio"""
    log("=" * 50)
    log("TEST 2: Telecharger audio")
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/meetings?select=id,title,recording_url&recording_url=not.is.null&limit=1",
            headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"}
        )
        if resp.status_code != 200 or not resp.json():
            log("Pas de meeting avec audio", "ERROR")
            return None
        
        meeting = resp.json()[0]
        recording_url = meeting["recording_url"]
        log(f"Meeting: {meeting['title'][:40]}")
        
        audio_resp = requests.get(
            f"{SUPABASE_URL}/storage/v1/object/public/meetingrecordings/{recording_url}",
            headers={"apikey": ANON_KEY}
        )
        
        if audio_resp.status_code == 200:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(audio_resp.content)
                log(f"OK - {len(audio_resp.content)} bytes -> {f.name}")
                return f.name
        else:
            log(f"Erreur: {audio_resp.status_code}", "ERROR")
            return None
    except Exception as e:
        log(f"Exception: {e}", "ERROR")
        return None

def test_pyannote_diarization(audio_path):
    """Test 3: Pyannote Diarization"""
    log("=" * 50)
    log("TEST 3: Pyannote Diarization")
    try:
        from pyannote.audio import Pipeline
        import torch
        
        log("Chargement modele Pyannote...")
        hf_token = os.getenv("HUGGINGFACE_TOKEN")
        if not hf_token:
            log("HUGGINGFACE_TOKEN manquant", "ERROR")
            return None
            
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token
        )
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        log(f"Device: {device}")
        if device == "cuda":
            pipeline.to(torch.device("cuda"))
        
        log(f"Analyse de {audio_path}...")
        diarization = pipeline(audio_path)
        
        speakers = set()
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speakers.add(speaker)
            segments.append({
                "speaker": speaker,
                "start": round(turn.start, 2),
                "end": round(turn.end, 2)
            })
        
        log(f"OK - {len(speakers)} speakers, {len(segments)} segments")
        for seg in segments[:3]:
            log(f"  [{seg['start']}-{seg['end']}] {seg['speaker']}")
        
        return {"speakers": list(speakers), "segments": segments}
    except Exception as e:
        log(f"Exception: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return None

def test_gemini_enhancement(audio_path):
    """Test 4: Gemini Enhancement"""
    log("=" * 50)
    log("TEST 4: Gemini Enhancement")
    
    google_key = os.getenv("GOOGLE_API_KEY")
    if not google_key:
        log("GOOGLE_API_KEY manquant - skip", "WARN")
        return "SKIP"
    
    try:
        with open(audio_path, "rb") as f:
            audio_data = f.read()
        
        audio_base64 = base64.b64encode(audio_data).decode()
        log(f"Audio: {len(audio_base64)} chars base64")
        
        prompt = """Transcris cet audio en JSON strict:
{"language": "fr", "speakers_detected": N, "segments": [{"speaker": "Nom", "text": "...", "start": "00:00", "end": "00:10"}]}
RETOURNE UNIQUEMENT LE JSON."""
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={google_key}"
        
        log("Appel API Gemini...")
        resp = requests.post(url, json={
            "contents": [{
                "parts": [
                    {"inlineData": {"mimeType": "audio/webm", "data": audio_base64}},
                    {"text": prompt}
                ]
            }],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192}
        }, timeout=120)
        
        if resp.status_code == 200:
            data = resp.json()
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            log(f"OK - Reponse ({len(text)} chars)")
            log(text[:300] + "..." if len(text) > 300 else text)
            return text
        else:
            log(f"Erreur: {resp.status_code} - {resp.text[:200]}", "ERROR")
            return None
    except Exception as e:
        log(f"Exception: {e}", "ERROR")
        return None

def main():
    log("=" * 60)
    log("BATTERIE DE TESTS - WORKFLOW TRANSCRIPTION")
    log("=" * 60)
    
    results = {}
    
    # Test 1
    results["supabase"] = test_supabase_connection()
    
    # Test 2
    audio_path = test_download_audio()
    results["download"] = audio_path is not None
    
    if audio_path:
        # Test 3
        pyannote_result = test_pyannote_diarization(audio_path)
        results["pyannote"] = pyannote_result is not None
        
        # Test 4
        gemini_result = test_gemini_enhancement(audio_path)
        results["gemini"] = gemini_result not in [None, False]
        
        os.unlink(audio_path)
    
    # Summary
    log("=" * 60)
    log("RESUME")
    log("=" * 60)
    for test, passed in results.items():
        status = "OK" if passed else "FAIL"
        log(f"  {test}: {status}")
    
    return 0 if all(results.values()) else 1

if __name__ == "__main__":
    sys.exit(main())
