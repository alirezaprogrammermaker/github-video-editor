"""
Two-step translation: Whisper + M2M100 for video audio
"""
import os
import requests
import base64
import json
import time

acc_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
key = os.environ["CLOUDFLARE_API_TOKEN"]
base_url = f"https://api.cloudflare.com/client/v4/accounts/{acc_id}/ai/run"
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# Load audio
with open("video_audio.wav", "rb") as f:
    audio = f.read()
b64 = base64.b64encode(audio).decode()

print(f"Audio size: {len(audio)/1024/1024:.1f} MB")
print()

# ============================================
# Step 1: Whisper - Transcribe Persian
# ============================================
print("=" * 60)
print("Step 1: Whisper - Transcribe Persian")
print("=" * 60)

start = time.time()
r = requests.post(
    f"{base_url}/@cf/openai/whisper-large-v3-turbo",
    headers=headers,
    json={"audio": b64, "task": "transcribe"}
)
whisper_time = time.time() - start

if r.status_code != 200:
    print(f"Whisper failed: {r.status_code} - {r.text[:200]}")
    exit(1)

whisper_result = r.json().get("result", {})
persian_text = whisper_result.get("text", "")
segments = whisper_result.get("segments", [])
info = whisper_result.get("transcription_info", {})

print(f"Time: {whisper_time:.1f}s")
print(f"Language: {info.get('language', '')} ({info.get('language_probability', 0):.0%})")
print(f"Duration: {info.get('duration', 0):.1f}s")
print(f"Segments: {len(segments)}")
print(f"Text: {persian_text}")
print()

# ============================================
# Step 2: M2M100 - Translate each segment
# ============================================
print("=" * 60)
print("Step 2: M2M100 - Translate to English")
print("=" * 60)

start2 = time.time()
translations = []

for i, seg in enumerate(segments):
    seg_text = seg.get("text", "").strip()
    if not seg_text:
        continue

    r = requests.post(
        f"{base_url}/@cf/meta/m2m100-1.2b",
        headers=headers,
        json={"text": seg_text, "source_lang": "persian", "target_lang": "english"}
    )

    if r.status_code == 200:
        en = r.json().get("result", {}).get("translated_text", seg_text)
    else:
        en = seg_text

    translations.append({
        "start": seg.get("start", 0),
        "end": seg.get("end", 0),
        "fa": seg_text,
        "en": en,
    })

translate_time = time.time() - start2
print(f"Translation time: {translate_time:.1f}s")
print(f"Segments translated: {len(translations)}")
print()

# ============================================
# Print translations
# ============================================
print("=" * 60)
print("TRANSLATIONS")
print("=" * 60)

def fmt(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d}.{ms:03d}"

for i, t in enumerate(translations):
    print(f"[{fmt(t['start'])} - {fmt(t['end'])}]")
    print(f"  FA: {t['fa']}")
    print(f"  EN: {t['en']}")
    print()

# ============================================
# Generate VTT files
# ============================================
vtt_en = ["WEBVTT", ""]
vtt_fa = ["WEBVTT", ""]

for t in translations:
    time_line = f"{fmt(t['start'])} --> {fmt(t['end'])}"
    vtt_en.append(time_line)
    vtt_en.append(t["en"])
    vtt_en.append("")
    vtt_fa.append(time_line)
    vtt_fa.append(t["fa"])
    vtt_fa.append("")

vtt_en_content = "\n".join(vtt_en)
vtt_fa_content = "\n".join(vtt_fa)

with open("subtitle_video_en.vtt", "w", encoding="utf-8") as f:
    f.write(vtt_en_content)
with open("subtitle_video_fa.vtt", "w", encoding="utf-8") as f:
    f.write(vtt_fa_content)

print("=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Whisper time: {whisper_time:.1f}s")
print(f"Translation time: {translate_time:.1f}s")
print(f"Total time: {whisper_time + translate_time:.1f}s")
print(f"Files: subtitle_video_en.vtt, subtitle_video_fa.vtt")
