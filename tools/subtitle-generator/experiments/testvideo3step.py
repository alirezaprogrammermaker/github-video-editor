"""
3-step pipeline: Whisper → Fix Persian → Translate to English
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

with open("video_audio.wav", "rb") as f:
    audio = f.read()
b64 = base64.b64encode(audio).decode()

def fmt(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d}.{ms:03d}"

def llm_call(prompt, max_tokens=4000):
    r = requests.post(
        f"{base_url}/@cf/openai/gpt-oss-120b",
        headers=headers,
        json={"messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens}
    )
    if r.status_code == 200:
        choices = r.json().get("result", {}).get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
    return ""

# ============================================
# Step 1: Whisper - Transcribe Persian
# ============================================
print("=" * 60)
print("Step 1: Whisper - Transcribe Persian")
print("=" * 60)
start = time.time()
r = requests.post(f"{base_url}/@cf/openai/whisper-large-v3-turbo", headers=headers, json={"audio": b64, "task": "transcribe"})
whisper_time = time.time() - start
segments = r.json().get("result", {}).get("segments", [])
print(f"Time: {whisper_time:.1f}s | Segments: {len(segments)}")

# ============================================
# Step 2: LLM - Fix Persian text
# ============================================
print()
print("=" * 60)
print("Step 2: GPT-OSS 120B - Fix Persian Text")
print("=" * 60)

fa_segments = []
for i, seg in enumerate(segments):
    text = seg.get("text", "").strip()
    if text:
        fa_segments.append(f"{i}: {text}")

fix_prompt = f"""You are a Persian language expert. The following Persian text segments were transcribed by a speech recognition system and may contain errors (wrong words, missing diacritics, unclear phrases). 

Fix any transcription errors and return the corrected Persian text. Keep the same index format. Only return the corrections, no explanations.

Raw transcription:
{chr(10).join(fa_segments)}

Corrected Persian:"""

start2 = time.time()
fixed_text = llm_call(fix_prompt, max_tokens=6000)
fix_time = time.time() - start2
print(f"Time: {fix_time:.1f}s")

# Parse fixed text
fixed_segments = {}
for line in fixed_text.strip().split("\n"):
    line = line.strip()
    if ":" in line:
        parts = line.split(":", 1)
        try:
            idx = int(parts[0].strip())
            fixed_segments[idx] = parts[1].strip()
        except ValueError:
            pass

# ============================================
# Step 3: LLM - Translate to English
# ============================================
print()
print("=" * 60)
print("Step 3: GPT-OSS 120B - Translate to English")
print("=" * 60)

en_segments = []
for i, seg in enumerate(segments):
    text = fixed_segments.get(i, seg.get("text", "").strip())
    if text:
        en_segments.append(f"{i}: {text}")

translate_prompt = f"""Translate the following corrected Persian text segments to English.
Each segment has an index number. Return the translations in the same format: "index: translation".
Keep the translations natural and accurate. Do not add explanations.

Persian segments:
{chr(10).join(en_segments)}

English translations:"""

start3 = time.time()
translated_text = llm_call(translate_prompt, max_tokens=6000)
translate_time = time.time() - start3
print(f"Time: {translate_time:.1f}s")

# Parse translations
en_translations = {}
for line in translated_text.strip().split("\n"):
    line = line.strip()
    if ":" in line:
        parts = line.split(":", 1)
        try:
            idx = int(parts[0].strip())
            en_translations[idx] = parts[1].strip()
        except ValueError:
            pass

# ============================================
# Build final results
# ============================================
final = []
for i, seg in enumerate(segments):
    raw = seg.get("text", "").strip()
    fixed = fixed_segments.get(i, raw)
    en = en_translations.get(i, fixed)
    final.append({
        "start": seg.get("start", 0),
        "end": seg.get("end", 0),
        "raw": raw,
        "fixed": fixed,
        "en": en,
    })

# ============================================
# Print comparison
# ============================================
print()
print("=" * 60)
print("COMPARISON: Raw → Fixed → Translated")
print("=" * 60)

for f_item in final:
    print(f"[{fmt(f_item['start'])} - {fmt(f_item['end'])}]")
    if f_item["raw"] != f_item["fixed"]:
        print(f"  RAW:  {f_item['raw']}")
        print(f"  FIX:  {f_item['fixed']}")
    else:
        print(f"  FA:   {f_item['fixed']}")
    print(f"  EN:   {f_item['en']}")
    print()

# ============================================
# Generate VTT files
# ============================================
vtt_en = ["WEBVTT", ""]
vtt_fa = ["WEBVTT", ""]

for f_item in final:
    time_line = f"{fmt(f_item['start'])} --> {fmt(f_item['end'])}"
    vtt_en.append(time_line)
    vtt_en.append(f_item["en"])
    vtt_en.append("")
    vtt_fa.append(time_line)
    vtt_fa.append(f_item["fixed"])
    vtt_fa.append("")

with open("subtitle_3step_en.vtt", "w", encoding="utf-8") as f:
    f.write("\n".join(vtt_en))
with open("subtitle_3step_fa.vtt", "w", encoding="utf-8") as f:
    f.write("\n".join(vtt_fa))

# ============================================
# Summary
# ============================================
print("=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"Whisper time:     {whisper_time:.1f}s")
print(f"Fix time:         {fix_time:.1f}s")
print(f"Translate time:   {translate_time:.1f}s")
print(f"Total time:       {whisper_time + fix_time + translate_time:.1f}s")
print(f"Segments:         {len(final)}")
print(f"Fixed segments:   {sum(1 for f in final if f['raw'] != f['fixed'])}")
print(f"Files:            subtitle_3step_en.vtt, subtitle_3step_fa.vtt")
