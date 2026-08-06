"""
Production Pipeline: Persian Video → English Subtitles
Whisper → Fix Persian → Translate to English
Optimized settings and prompts

Writes <prefix>_en.vtt and <prefix>_fa.vtt in the WebVTT dialect consumed by
remotion-video-creator/src/utils/parseVtt.ts. See README.md for the format.
"""
import sys
import base64
import time

from cf_auth import CloudflareAI

WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo"
LLM_MODEL = "@cf/openai/gpt-oss-120b"


def fmt(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d}.{ms:03d}"


def parse_indexed(text):
    """Parse "<index>: <content>" lines emitted by the LLM into {index: content}."""
    out = {}
    for line in text.strip().split("\n"):
        line = line.strip()
        if ":" in line:
            idx_part, content = line.split(":", 1)
            try:
                out[int(idx_part.strip())] = content.strip()
            except ValueError:
                pass
    return out


# ============================================
# Optimized Prompts
# ============================================
FIX_SYSTEM = """You are an expert Persian language editor specializing in speech-to-text correction.

Your task:
1. Fix ALL transcription errors (spelling, grammar, word choice)
2. Restore proper diacritics where needed
3. Correct names, places, and technical terms
4. Keep the original meaning intact
5. Do NOT add or remove any content
6. Return ONLY the corrected text in the same index format

Input will be raw transcription with errors.
Output must be corrected Persian text."""

TRANSLATE_SYSTEM = """You are a professional Persian-to-English translator specializing in political, military, and diplomatic discourse.

Rules:
1. Translate accurately — do not paraphrase or summarize
2. Preserve the original tone (formal, informal, emotional)
3. Keep proper nouns as-is (names, places, organizations)
4. Maintain the index format: "index: translation"
5. Do NOT add explanations or notes
6. If a phrase is ambiguous, choose the most likely meaning"""


# ============================================
# Main Pipeline
# ============================================
def run_pipeline(audio_file, output_prefix="subtitle"):
    ai = CloudflareAI()

    print("=" * 70)
    print("PERSIAN VIDEO → ENGLISH SUBTITLES PIPELINE")
    print("=" * 70)
    print(f"Input: {audio_file}")
    print(f"Account: {ai.account.name}")
    print()

    # Load audio
    with open(audio_file, "rb") as f:
        audio = f.read()
    b64 = base64.b64encode(audio).decode()
    print(f"Audio: {len(audio)/1024/1024:.1f} MB")

    # ============================================
    # Step 1: Whisper
    # ============================================
    print()
    print("-" * 70)
    print("STEP 1: Whisper Large V3 Turbo — Transcribe Persian")
    print("-" * 70)

    start = time.time()
    r = ai.run(WHISPER_MODEL, {
        "audio": b64,
        "task": "transcribe",
        "language": "fa",
        "vad_filter": True,
        "beam_size": 5,
        "initial_prompt": "این یک مکالمه فارسی است"
    })
    whisper_time = time.time() - start

    if r.status_code != 200:
        print(f"FAILED: {r.status_code}")
        return

    result = r.json().get("result", {})
    segments = result.get("segments", [])
    info = result.get("transcription_info", {})
    print(f"Time: {whisper_time:.1f}s | Segments: {len(segments)}")
    print(f"Language: {info.get('language', '')} ({info.get('language_probability', 0):.0%})")
    print(f"Duration: {info.get('duration', 0):.1f}s")

    # ============================================
    # Step 2: Fix Persian
    # ============================================
    print()
    print("-" * 70)
    print("STEP 2: GPT-OSS 120B — Fix Persian Text")
    print("-" * 70)

    fa_list = []
    for i, seg in enumerate(segments):
        text = seg.get("text", "").strip()
        if text:
            fa_list.append(f"{i}: {text}")

    start2 = time.time()
    r = ai.run(LLM_MODEL, {
        "messages": [
            {"role": "system", "content": FIX_SYSTEM},
            {"role": "user", "content": f"Fix this Persian transcription:\n\n{chr(10).join(fa_list)}"}
        ],
        "max_tokens": 8000,
        "temperature": 0.1
    })
    fix_time = time.time() - start2

    fixed_text = ""
    if r.status_code == 200:
        choices = r.json().get("result", {}).get("choices", [])
        if choices:
            fixed_text = choices[0].get("message", {}).get("content", "")

    fixed_segments = parse_indexed(fixed_text)

    fixed_count = sum(1 for i, seg in enumerate(segments) if fixed_segments.get(i, seg.get("text", "").strip()) != seg.get("text", "").strip())
    print(f"Time: {fix_time:.1f}s | Fixed: {fixed_count}/{len(segments)} segments")

    # ============================================
    # Step 3: Translate to English
    # ============================================
    print()
    print("-" * 70)
    print("STEP 3: GPT-OSS 120B — Translate to English")
    print("-" * 70)

    en_list = []
    for i, seg in enumerate(segments):
        text = fixed_segments.get(i, seg.get("text", "").strip())
        if text:
            en_list.append(f"{i}: {text}")

    start3 = time.time()
    r = ai.run(LLM_MODEL, {
        "messages": [
            {"role": "system", "content": TRANSLATE_SYSTEM},
            {"role": "user", "content": f"Translate these Persian segments:\n\n{chr(10).join(en_list)}"}
        ],
        "max_tokens": 8000,
        "temperature": 0.3
    })
    translate_time = time.time() - start3

    translated_text = ""
    if r.status_code == 200:
        choices = r.json().get("result", {}).get("choices", [])
        if choices:
            translated_text = choices[0].get("message", {}).get("content", "")

    en_translations = parse_indexed(translated_text)

    print(f"Time: {translate_time:.1f}s | Translated: {len(en_translations)} segments")

    # ============================================
    # Generate Output
    # ============================================
    vtt_en = ["WEBVTT", ""]
    vtt_fa = ["WEBVTT", ""]

    for i, seg in enumerate(segments):
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        raw = seg.get("text", "").strip()
        fixed = fixed_segments.get(i, raw)
        en = en_translations.get(i, fixed)

        time_line = f"{fmt(start)} --> {fmt(end)}"
        vtt_en.append(time_line)
        vtt_en.append(en)
        vtt_en.append("")
        vtt_fa.append(time_line)
        vtt_fa.append(fixed)
        vtt_fa.append("")

    with open(f"{output_prefix}_en.vtt", "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_en))
    with open(f"{output_prefix}_fa.vtt", "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_fa))

    # ============================================
    # Summary
    # ============================================
    total = whisper_time + fix_time + translate_time
    print()
    print("=" * 70)
    print("COMPLETE")
    print("=" * 70)
    print(f"Whisper:    {whisper_time:.1f}s")
    print(f"Fix:        {fix_time:.1f}s")
    print(f"Translate:  {translate_time:.1f}s")
    print(f"Total:      {total:.1f}s")
    print(f"Output:     {output_prefix}_en.vtt, {output_prefix}_fa.vtt")


if __name__ == "__main__":
    audio_file = sys.argv[1] if len(sys.argv) > 1 else "video_audio.wav"
    output_prefix = sys.argv[2] if len(sys.argv) > 2 else "subtitle_optimized"
    run_pipeline(audio_file, output_prefix)
