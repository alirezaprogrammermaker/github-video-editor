"""
Two-step Persian to English subtitle generation:
1. Whisper → Transcribe Persian with word-level timing
2. M2M100 → Translate Persian segments to English
"""
import os
import requests
import base64
import json

AUDIO_FILE = "audio.ogg"

acc_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
key = os.environ["CLOUDFLARE_API_TOKEN"]
base_url = f"https://api.cloudflare.com/client/v4/accounts/{acc_id}/ai/run"
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# Load audio
with open(AUDIO_FILE, "rb") as f:
    audio = f.read()
b64 = base64.b64encode(audio).decode()

# ============================================
# Step 1: Whisper - Transcribe Persian
# ============================================
print("=" * 60)
print("Step 1: Whisper - Transcribe Persian")
print("=" * 60)

r = requests.post(
    f"{base_url}/@cf/openai/whisper-large-v3-turbo",
    headers=headers,
    json={"audio": b64, "task": "transcribe", "language": "fa"}
)

if r.status_code != 200:
    print(f"Whisper failed: {r.status_code}")
    exit(1)

whisper_result = r.json().get("result", {})
persian_text = whisper_result.get("text", "")
segments = whisper_result.get("segments", [])
vtt_fa = whisper_result.get("vtt", "")

print(f"Persian text: {persian_text}")
print(f"Segments: {len(segments)}")
print()

# ============================================
# Step 2: M2M100 - Translate each segment
# ============================================
print("=" * 60)
print("Step 2: M2M100 - Translate to English")
print("=" * 60)

english_segments = []

for i, seg in enumerate(segments):
    seg_text = seg.get("text", "").strip()
    if not seg_text:
        continue

    print(f"  Segment {i+1}: '{seg_text}'...", end=" ", flush=True)

    r = requests.post(
        f"{base_url}/@cf/meta/m2m100-1.2b",
        headers=headers,
        json={"text": seg_text, "source_lang": "persian", "target_lang": "english"}
    )

    if r.status_code == 200:
        translated = r.json().get("result", {}).get("translated_text", seg_text)
        print(f"-> '{translated}'")
        english_segments.append({
            "start": seg.get("start", 0),
            "end": seg.get("end", 0),
            "fa": seg_text,
            "en": translated,
        })
    else:
        print(f"FAILED ({r.status_code})")
        english_segments.append({
            "start": seg.get("start", 0),
            "end": seg.get("end", 0),
            "fa": seg_text,
            "en": seg_text,  # fallback to original
        })

# ============================================
# Generate English VTT subtitle
# ============================================
print()
print("=" * 60)
print("English VTT Subtitle")
print("=" * 60)

def format_time(seconds):
    """Convert seconds to VTT time format HH:MM:SS.mmm"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

vtt_lines = ["WEBVTT", ""]
for seg in english_segments:
    start = format_time(seg["start"])
    end = format_time(seg["end"])
    vtt_lines.append(f"{start} --> {end}")
    vtt_lines.append(seg["en"])
    vtt_lines.append("")

vtt_content = "\n".join(vtt_lines)
print(vtt_content)

# Save to file
with open("subtitle_en.vtt", "w", encoding="utf-8") as f:
    f.write(vtt_content)
print(f"Saved: subtitle_en.vtt")

# ============================================
# Generate Persian VTT subtitle
# ============================================
vtt_fa_lines = ["WEBVTT", ""]
for seg in english_segments:
    start = format_time(seg["start"])
    end = format_time(seg["end"])
    vtt_fa_lines.append(f"{start} --> {end}")
    vtt_fa_lines.append(seg["fa"])
    vtt_fa_lines.append("")

vtt_fa_content = "\n".join(vtt_fa_lines)
with open("subtitle_fa.vtt", "w", encoding="utf-8") as f:
    f.write(vtt_fa_content)
print(f"Saved: subtitle_fa.vtt")

# ============================================
# Summary
# ============================================
print()
print("=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Original (Persian): {persian_text}")
print(f"Translated (English): {' '.join(seg['en'] for seg in english_segments)}")
print(f"Segments: {len(english_segments)}")
print(f"Files: subtitle_en.vtt, subtitle_fa.vtt")
