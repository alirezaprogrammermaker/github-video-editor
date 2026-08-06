# Subtitle Generator

Turns a video's audio track into WebVTT subtitle files using Cloudflare Workers AI.
The `.vtt` it produces is fed into the `subtitle_content` input of
`.github/workflows/video-edit.yml`, and parsed on the render side by
`remotion-video-creator/src/utils/parseVtt.ts`.

## Pipeline

`subtitle_pipeline.py` (Persian audio → English subtitles) runs three steps:

1. **Transcribe** — `@cf/openai/whisper-large-v3-turbo` with `language: fa`,
   `vad_filter`, `beam_size: 5`. Returns timed `segments`.
2. **Correct** — `@cf/openai/gpt-oss-120b` fixes speech-to-text errors in the
   Persian text, segment by segment (`temperature 0.1`).
3. **Translate** — `@cf/openai/gpt-oss-120b` translates the corrected Persian
   into English (`temperature 0.3`).

Both intermediate results keep their segment index, so the original Whisper
timings survive all three steps. Two files are written: the English translation
and the corrected Persian.

`translate_en_to_fa.py` is the same pipeline in the opposite direction
(English audio → Persian subtitles).

## Setup

```bash
pip install -r requirements.txt
```

Credentials come from the environment — nothing is hardcoded. Either a single
account:

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."
```

or several, which are rotated automatically when one returns HTTP 429 (the free
Workers AI tier has a daily quota):

```bash
export CLOUDFLARE_ACCOUNTS="acct1:<account_id>:<api_token>,acct2:<account_id>:<api_token>"
```

The token needs the **Workers AI: Read** permission.

## Usage

The scripts take an audio file, not a video. Extract the track first:

```bash
ffmpeg -i video.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 video_audio.wav -y
```

Then:

```bash
python subtitle_pipeline.py video_audio.wav my_subtitle
# → my_subtitle_en.vtt, my_subtitle_fa.vtt

python translate_en_to_fa.py english_audio.wav my_subtitle
# → my_subtitle_en.vtt, my_subtitle_fa.vtt
```

Pass the resulting file's contents as the `subtitle_content` workflow input.

## Output format (the contract with `parseVtt.ts`)

The generated file is a deliberately minimal subset of WebVTT:

```
WEBVTT

00:00:01.234 --> 00:00:05.678
First cue text

00:00:05.678 --> 00:00:10.123
Second cue text
```

Rules the parser relies on:

- First line is the literal `WEBVTT` header, followed by a blank line.
  `parseVtt.ts` skips everything before the first `-->`, so the header is
  effectively ignored, but it is written for compatibility with real VTT players.
- Timestamps are always `HH:MM:SS.mmm` (zero-padded hours, minutes, seconds;
  three-digit milliseconds; a **dot**, not a comma, before the milliseconds).
  `parseVtt.ts` also accepts `MM:SS.mmm`, but this generator never emits it.
- The separator is ` --> ` with a space on each side.
- No cue identifiers, no cue settings (`align:`, `line:`, …), no `NOTE` blocks,
  no `STYLE` blocks. Anything of that sort would be silently skipped or
  misparsed downstream.
- Cue text is one or more non-blank lines directly after the timestamp line.
  Multiple lines are joined with `\n` and rendered with `white-space: pre-wrap`.
- A blank line terminates each cue. The file is UTF-8 with `\n` line endings
  (`parseVtt.ts` normalises `\r\n` anyway).
- Cues are emitted in Whisper's order and are non-overlapping. The renderer
  picks the first cue where `start <= t < end`, so overlapping cues would mean
  the later one never shows.

If you change this format, update `remotion-video-creator/src/utils/parseVtt.ts`
in the same change — there is no test guarding the contract.

## `experiments/`

Earlier prototypes kept for reference: two-step Whisper + M2M100 translation,
Whisper's own `task: translate` mode, and the first 3-step LLM version. They
have hardcoded input filenames and are not part of the pipeline. Their
credentials were also read from `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`.
