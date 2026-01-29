#!/usr/bin/env python3
"""
Test du workflow d'enhancement Gemini
Télécharge un audio depuis Supabase et appelle directement l'API Gemini
"""
import os
import sys
import json
import base64
import requests
from datetime import datetime

# Configuration
SUPABASE_URL = "http://kong:8000"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NjEyMjU0NzksImV4cCI6MTc5Mjc2MTQ3OX0.KNcEMhffSdBfPbaIdrj8BMeGly3MvS6Q5foHM1wO_7A"

def log(msg, level="INFO"):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {level}: {msg}")

def get_google_api_key(user_id):
    """Get Google API key from api_keys table"""
    log(f"Fetching Google API key for user {user_id}")
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/api_keys?user_id=eq.{user_id}&provider=eq.google&select=encrypted_key",
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    )
    if resp.status_code == 200 and resp.json():
        key = resp.json()[0].get("encrypted_key")
        log(f"Found API key: {key[:20]}...")
        return key
    log(f"No API key found: {resp.status_code} - {resp.text}", "ERROR")
    return None

def get_meeting_with_audio():
    """Get a meeting with audio recording"""
    log("Fetching meeting with audio...")
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/meetings?recording_url=not.is.null&select=id,title,user_id,recording_url,transcript&limit=1",
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    )
    if resp.status_code == 200 and resp.json():
        meeting = resp.json()[0]
        log(f"Found meeting: {meeting['title'][:40]}")
        return meeting
    log(f"No meeting found: {resp.status_code}", "ERROR")
    return None

def download_audio(recording_url):
    """Download audio from Supabase storage"""
    log(f"Downloading audio: {recording_url}")
    resp = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/public/meetingrecordings/{recording_url}",
        headers={"apikey": SERVICE_KEY}
    )
    if resp.status_code == 200:
        log(f"Downloaded {len(resp.content)} bytes")
        return resp.content
    log(f"Download failed: {resp.status_code}", "ERROR")
    return None

def test_gemini_enhancement(audio_data, api_key, existing_transcript=None):
    """Call Gemini API for enhancement"""
    log("=" * 50)
    log("TEST: Gemini Enhancement API")
    log("=" * 50)
    
    if not api_key:
        log("NO API KEY - cannot test", "ERROR")
        return None
    
    # Encode audio
    audio_base64 = base64.b64encode(audio_data).decode()
    log(f"Audio encoded: {len(audio_base64)} chars")
    
    # Build existing text from transcript
    existing_text = ""
    if existing_transcript:
        for seg in existing_transcript[:10]:  # First 10 segments
            speaker = seg.get("speaker", "Unknown")
            text = seg.get("text", "")
            existing_text += f"[{speaker}]: {text}\n"
    
    prompt = f"""Tu es un expert en transcription et diarization audio.

## TRANSCRIPTION LIVE DE RÉFÉRENCE
{existing_text or '(aucune)'}

## INSTRUCTIONS
1. Écoute l'audio et identifie les voix distinctes
2. Transcris avec attribution des speakers
3. Retourne UNIQUEMENT du JSON valide

## FORMAT (JSON STRICT)
```json
{{
  "language": "fr",
  "speakers_detected": 1,
  "segments": [
    {{"speaker": "Speaker_01", "text": "...", "start": "00:00", "end": "00:10"}}
  ]
}}
```"""
    
    # Try user's preferred models first
    models_to_try = [
        "gemini-3-flash-preview",  # trystan@antislash.studio preference
        "gemini-2.5-flash",
        "gemini-2.0-flash-exp",    # trystan.lamouller+devtalk preference
        "gemini-1.5-flash"
    ]
    
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        log(f"Trying model: {model}...")
        
        try:
            resp = requests.post(url, json={
                "contents": [{
                    "parts": [
                        {"inlineData": {"mimeType": "audio/ogg", "data": audio_base64}},
                        {"text": prompt}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 8192
                }
            }, timeout=120)
            
            log(f"Response status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                log(f"SUCCESS with {model}! Response: {len(text)} chars")
                log("-" * 40)
                print(text[:500] if len(text) > 500 else text)
                log("-" * 40)
                
                # Try to parse JSON
                try:
                    if "```json" in text:
                        json_str = text.split("```json")[1].split("```")[0].strip()
                    elif "```" in text:
                        json_str = text.split("```")[1].split("```")[0].strip()
                    else:
                        json_str = text.strip()
                    
                    result = json.loads(json_str)
                    log(f"Parsed: {result.get('speakers_detected')} speakers, {len(result.get('segments', []))} segments")
                    return result
                except json.JSONDecodeError as e:
                    log(f"JSON parse error: {e}", "WARN")
                    return {"raw_text": text}
            elif resp.status_code == 404:
                log(f"Model {model} not found, trying next...", "WARN")
                continue
            else:
                error = resp.json()
                log(f"API Error: {error.get('error', {}).get('message', 'unknown')}", "ERROR")
                continue
                
        except Exception as e:
            log(f"Exception with {model}: {e}", "ERROR")
            continue
    
    log("All models failed", "ERROR")
    return None

def main():
    log("=" * 60)
    log("TEST WORKFLOW ENHANCEMENT GEMINI")
    log("=" * 60)
    
    # Step 1: Get meeting with audio
    meeting = get_meeting_with_audio()
    if not meeting:
        return 1
    
    # Step 2: Get Google API key for this user
    api_key = get_google_api_key(meeting["user_id"])
    if not api_key:
        log("Cannot proceed without API key", "ERROR")
        return 1
    
    # Step 3: Download audio
    audio_data = download_audio(meeting["recording_url"])
    if not audio_data:
        return 1
    
    # Step 4: Test Gemini enhancement
    result = test_gemini_enhancement(
        audio_data, 
        api_key, 
        meeting.get("transcript")
    )
    
    # Summary
    log("=" * 60)
    log("SUMMARY")
    log("=" * 60)
    if result:
        if "segments" in result:
            log(f"✅ Enhancement SUCCESS!")
            log(f"   Speakers: {result.get('speakers_detected', 'N/A')}")
            log(f"   Segments: {len(result.get('segments', []))}")
            for seg in result.get("segments", [])[:3]:
                log(f"   - [{seg.get('speaker')}]: {seg.get('text', '')[:50]}...")
        else:
            log(f"⚠️ Got response but not standard format")
        return 0
    else:
        log("❌ Enhancement FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
