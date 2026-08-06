"""
Test Persian audio translation to English subtitles
"""
import os
import requests
import base64
import json

AUDIO_FILE = "audio.ogg"

acc_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
key = os.environ["CLOUDFLARE_API_TOKEN"]

with open(AUDIO_FILE, "rb") as f:
    audio = f.read()
b64 = base64.b64encode(audio).decode()

url = f"https://api.cloudflare.com/client/v4/accounts/{acc_id}/ai/run/@cf/openai/whisper-large-v3-turbo"
h = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# Test 1: Transcribe (Persian)
print("=" * 60)
print("Task: transcribe (Persian original)")
print("=" * 60)
r = requests.post(url, headers=h, json={"audio": b64, "task": "transcribe", "language": "fa"})
if r.status_code == 200:
    result = r.json().get("result", {})
    print(f"Text: {result.get('text', '')}")
    info = result.get("transcription_info", {})
    print(f"Language: {info.get('language', '')} ({info.get('language_probability', 0):.0%})")
    print(f"Duration: {info.get('duration', 0):.1f}s")
else:
    print(f"Error: {r.status_code} - {r.text[:200]}")

print()

# Test 2: Translate to English
print("=" * 60)
print("Task: translate (Persian -> English)")
print("=" * 60)
r = requests.post(url, headers=h, json={"audio": b64, "task": "translate", "language": "fa"})
if r.status_code == 200:
    result = r.json().get("result", {})
    print(f"Text: {result.get('text', '')}")
    print()
    print("VTT Subtitle:")
    print("-" * 40)
    vtt = result.get("vtt", "")
    print(vtt)
    print("-" * 40)
    print()
    print("Segments with timing:")
    print("-" * 40)
    segments = result.get("segments", [])
    print(f"Total segments: {len(segments)}")
    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "")
        print(f"  [{start:.1f}s - {end:.1f}s] {text}")
else:
    print(f"Error: {r.status_code} - {r.text[:200]}")
