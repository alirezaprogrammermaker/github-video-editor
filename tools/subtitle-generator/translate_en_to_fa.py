"""
English Video → Persian Subtitles
Whisper → Fix English → Translate to Persian

Mirror of subtitle_pipeline.py for the opposite language direction.
Writes <prefix>_en.vtt and <prefix>_fa.vtt in the same WebVTT dialect.
"""
import sys
import base64
import time

from cf_auth import CloudflareAI
from subtitle_pipeline import fmt, parse_indexed, WHISPER_MODEL, LLM_MODEL


def llm_call(ai, prompt, max_tokens=4000):
    r = ai.run(LLM_MODEL, {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    })
    if r.status_code == 200:
        choices = r.json().get("result", {}).get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
    return ""


def run_pipeline(audio_file, output_prefix="subtitle_en_to_fa"):
    ai = CloudflareAI()

    with open(audio_file, "rb") as f:
        audio = f.read()
    b64 = base64.b64encode(audio).decode()

    # ============================================
    # Step 1: Whisper - Transcribe English
    # ============================================
    print("=" * 60)
    print("Step 1: Whisper - Transcribe English")
    print("=" * 60)

    start = time.time()
    r = ai.run(WHISPER_MODEL, {
        "audio": b64,
        "task": "transcribe",
        "language": "en",
        "vad_filter": True,
    })
    whisper_time = time.time() - start

    if r.status_code != 200:
        print(f"FAILED: {r.status_code}")
        sys.exit(1)

    result = r.json().get("result", {})
    segments = result.get("segments", [])
    info = result.get("transcription_info", {})
    print(f"Time: {whisper_time:.1f}s | Segments: {len(segments)}")
    print(f"Language: {info.get('language', '')} ({info.get('language_probability', 0):.0%})")

    # ============================================
    # Step 2: LLM - Fix English text
    # ============================================
    print()
    print("=" * 60)
    print("Step 2: GPT-OSS 120B - Fix English Text")
    print("=" * 60)

    en_list = []
    for i, seg in enumerate(segments):
        text = seg.get("text", "").strip()
        if text:
            en_list.append(f"{i}: {text}")

    fix_prompt = f"""You are an English language expert. The following English text was transcribed by a speech recognition system and may contain errors.

Fix any transcription errors and return the corrected English text. Keep the same index format. Only return the corrections, no explanations.

Raw transcription:
{chr(10).join(en_list)}

Corrected English:"""

    start2 = time.time()
    fixed_text = llm_call(ai, fix_prompt, max_tokens=6000)
    fix_time = time.time() - start2
    print(f"Time: {fix_time:.1f}s")

    fixed_segments = parse_indexed(fixed_text)

    # ============================================
    # Step 3: LLM - Translate to Persian
    # ============================================
    print()
    print("=" * 60)
    print("Step 3: GPT-OSS 120B - Translate to Persian")
    print("=" * 60)

    fa_list = []
    for i, seg in enumerate(segments):
        text = fixed_segments.get(i, seg.get("text", "").strip())
        if text:
            fa_list.append(f"{i}: {text}")

    translate_prompt = f"""You are a professional English-to-Persian translator.
Translate the following English text segments to Persian (Farsi).
Rules:
1. Translate accurately and naturally
2. Keep proper nouns as-is
3. Maintain the index format: "index: translation"
4. Do NOT add explanations

English segments:
{chr(10).join(fa_list)}

Persian translations:"""

    start3 = time.time()
    translated_text = llm_call(ai, translate_prompt, max_tokens=6000)
    translate_time = time.time() - start3
    print(f"Time: {translate_time:.1f}s")

    fa_translations = parse_indexed(translated_text)

    # ============================================
    # Build results
    # ============================================
    final = []
    for i, seg in enumerate(segments):
        raw = seg.get("text", "").strip()
        fixed = fixed_segments.get(i, raw)
        fa = fa_translations.get(i, fixed)
        final.append({
            "start": seg.get("start", 0),
            "end": seg.get("end", 0),
            "en_raw": raw,
            "en_fixed": fixed,
            "fa": fa,
        })

    # ============================================
    # Print comparison
    # ============================================
    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)

    for f_item in final:
        print(f"[{fmt(f_item['start'])} - {fmt(f_item['end'])}]")
        print(f"  EN: {f_item['en_fixed']}")
        print(f"  FA: {f_item['fa']}")
        print()

    # ============================================
    # Generate VTT files
    # ============================================
    vtt_en = ["WEBVTT", ""]
    vtt_fa = ["WEBVTT", ""]

    for f_item in final:
        time_line = f"{fmt(f_item['start'])} --> {fmt(f_item['end'])}"
        vtt_en.append(time_line)
        vtt_en.append(f_item["en_fixed"])
        vtt_en.append("")
        vtt_fa.append(time_line)
        vtt_fa.append(f_item["fa"])
        vtt_fa.append("")

    with open(f"{output_prefix}_en.vtt", "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_en))
    with open(f"{output_prefix}_fa.vtt", "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_fa))

    # ============================================
    # Summary
    # ============================================
    total = whisper_time + fix_time + translate_time
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Whisper:    {whisper_time:.1f}s")
    print(f"Fix:        {fix_time:.1f}s")
    print(f"Translate:  {translate_time:.1f}s")
    print(f"Total:      {total:.1f}s")
    print(f"Output:     {output_prefix}_en.vtt, {output_prefix}_fa.vtt")


if __name__ == "__main__":
    audio_file = sys.argv[1] if len(sys.argv) > 1 else "english_audio.wav"
    output_prefix = sys.argv[2] if len(sys.argv) > 2 else "subtitle_en_to_fa"
    run_pipeline(audio_file, output_prefix)
