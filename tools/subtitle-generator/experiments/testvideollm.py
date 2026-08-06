"""
Two-step translation: Whisper + LLM (GPT-OSS 120B) for better quality
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
    print(f"Whisper failed: {r.status_code}")
    exit(1)

whisper_result = r.json().get("result", {})
persian_text = whisper_result.get("text", "")
segments = whisper_result.get("segments", [])
info = whisper_result.get("transcription_info", {})

print(f"Time: {whisper_time:.1f}s")
print(f"Language: {info.get('language', '')} ({info.get('language_probability', 0):.0%})")
print(f"Duration: {info.get('duration', 0):.1f}s")
print(f"Segments: {len(segments)}")
print()

# ============================================
# Step 2: LLM - Translate all segments at once
# ============================================
print("=" * 60)
print("Step 2: GPT-OSS 120B - Translate to English")
print("=" * 60)

# Build translation prompt
fa_segments = []
for i, seg in enumerate(segments):
    text = seg.get("text", "").strip()
    if text:
        fa_segments.append(f"{i}: {text}")

translation_prompt = f"""Translate the following Persian text segments to English.
Each segment has an index number. Return the translations in the same format: "index: translation".
Keep the translations natural and accurate. Do not add explanations.

Persian segments:
{chr(10).join(fa_segments)}

English translations:"""

start2 = time.time()
r = requests.post(
    f"{base_url}/@cf/openai/gpt-oss-120b",
    headers=headers,
    json={
        "messages": [
            {"role": "system", "content": "You are a professional Persian to English translator. Translate the given text segments accurately and naturally. Only return the translations in the exact format specified."},
            {"role": "user", "content": translation_prompt}
        ],
        "max_tokens": 8000
    }
)
llm_time = time.time() - start2

if r.status_code != 200:
    print(f"LLM failed: {r.status_code} - {r.text[:200]}")
    exit(1)

llm_result = r.json().get("result", {})
# GPT-OSS 120B returns in choices[0].message.content (reasoning model)
choices = llm_result.get("choices", [])
if choices:
    translated_text = choices[0].get("message", {}).get("content", "")
else:
    translated_text = llm_result.get("response", "")
print(f"Time: {llm_time:.1f}s")
print()

# Parse LLM response
translations = {}
for line in translated_text.strip().split("\n"):
    line = line.strip()
    if ":" in line:
        parts = line.split(":", 1)
        try:
            idx = int(parts[0].strip())
            translations[idx] = parts[1].strip()
        except ValueError:
            pass

# ============================================
# Build final translations with timing
# ============================================
final = []
for i, seg in enumerate(segments):
    text = seg.get("text", "").strip()
    if not text:
        continue
    en = translations.get(i, text)
    final.append({
        "start": seg.get("start", 0),
        "end": seg.get("end", 0),
        "fa": text,
        "en": en,
    })

# ============================================
# Print translations
# ============================================
def fmt(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d}.{ms:03d}"

print("=" * 60)
print("TRANSLATIONS (GPT-OSS 120B)")
print("=" * 60)

for t in final:
    print(f"[{fmt(t['start'])} - {fmt(t['end'])}]")
    print(f"  FA: {t['fa']}")
    print(f"  EN: {t['en']}")
    print()

# ============================================
# Generate VTT files
# ============================================
vtt_en = ["WEBVTT", ""]
vtt_fa = ["WEBVTT", ""]

for t in final:
    time_line = f"{fmt(t['start'])} --> {fmt(t['end'])}"
    vtt_en.append(time_line)
    vtt_en.append(t["en"])
    vtt_en.append("")
    vtt_fa.append(time_line)
    vtt_fa.append(t["fa"])
    vtt_fa.append("")

with open("subtitle_video_llm_en.vtt", "w", encoding="utf-8") as f:
    f.write("\n".join(vtt_en))
with open("subtitle_video_llm_fa.vtt", "w", encoding="utf-8") as f:
    f.write("\n".join(vtt_fa))

# ============================================
# Summary
# ============================================
print("=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Whisper time: {whisper_time:.1f}s")
print(f"LLM translation time: {llm_time:.1f}s")
print(f"Total time: {whisper_time + llm_time:.1f}s")
print(f"Segments: {len(final)}")
print(f"Files: subtitle_video_llm_en.vtt, subtitle_video_llm_fa.vtt")
