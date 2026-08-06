# Cloudflare Workers AI — Complete Reference (Verified Models Only)

> All models below are tested, working, and free-tier compatible.
> Last verified: 2026-07-22

---

## Accounts

**Do not store API tokens in this file.** Load credentials from the environment:

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."
# or multi-account rotation:
export CLOUDFLARE_ACCOUNTS="name:<account_id>:<api_token>,..."
```

See `tools/subtitle-generator/cf_auth.py` for the shared loader used by the subtitle pipeline.

**Rate limit (free tier):** ~10,000 neurons/day per account. Rotate on HTTP 429.

---

## Base URL & Auth

```
POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL_ID}
Authorization: Bearer {API_KEY}
Content-Type: application/json
```

**Response always has:**
```json
{
  "result": { ... },
  "success": true,
  "errors": [],
  "messages": []
}
```

---

## 1. Text-to-Speech (TTS)

### 1.1 Aura-2 English — Best Quality

**Model:** `@cf/deepgram/aura-2-en`
**Cost:** $0.03 per 1k characters

```json
POST /ai/run/@cf/deepgram/aura-2-en
{
  "text": "Hello, welcome to our service.",
  "speaker": "luna"
}
```

**Parameters:**
| Param | Type | Required | Default | Options |
|-------|------|----------|---------|---------|
| `text` | string | Yes | - | Text to speak |
| `speaker` | string | No | `luna` | `amalthea`, `andromeda`, `apollo`, `arcas`, `aries`, `asteria`, `athena`, `atlas`, `aurora`, `callista`, `cora`, `cordelia`, `delia`, `draco`, `electra`, `harmonia`, `helena`, `hera`, `hermes`, `hyperion`, `iris`, `janus`, `juno`, `jupiter`, `luna`, `mars`, `minerva`, `neptune`, `odysseus`, `ophelia`, `orion`, `orpheus`, `pandora`, `phoebe`, `pluto`, `saturn`, `thalia`, `theia`, `vesta`, `zeus` |
| `encoding` | string | No | - | `linear16`, `flac`, `mulaw`, `alaw`, `mp3`, `opus`, `aac` |
| `container` | string | No | - | `none`, `wav`, `ogg` |

**Response:** Binary MP3 audio (Content-Type: audio/mpeg)

---

### 1.2 Aura-2 Spanish

**Model:** `@cf/deepgram/aura-2-es`

```json
POST /ai/run/@cf/deepgram/aura-2-es
{
  "text": "Hola, bienvenido a nuestro servicio.",
  "speaker": "carina"
}
```

**Speakers:** `sirio`, `nestor`, `carina`, `celeste`, `alvaro`, `diana`, `aquila`, `selena`, `estrella`, `javier`

---

### 1.3 Aura-1 English

**Model:** `@cf/deepgram/aura-1`
**Cost:** $0.015 per 1k characters

```json
POST /ai/run/@cf/deepgram/aura-1
{
  "text": "Hello, welcome to our service.",
  "speaker": "angus"
}
```

**Speakers:** `angus`, `asteria`, `arcas`, `orion`, `orpheus`, `athena`, `luna`, `zeus`, `perseus`, `helios`, `hera`, `stella`

---

### 1.4 MeloTTS — Multi-lingual

**Model:** `@cf/myshell-ai/melotts`
**Cost:** $0.0002 per audio minute

```json
POST /ai/run/@cf/myshell-ai/melotts
{
  "prompt": "Hello, welcome to our service.",
  "lang": "en"
}
```

**Parameters:**
| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `prompt` | string | Yes | - | Text to speak |
| `lang` | string | No | `en` | `en`, `es` (NOT `fr`, `fa`) |

**Response:** JSON with base64 audio:
```json
{
  "result": {
    "audio": "UklGRi..." // base64-encoded WAV
  }
}
```

**⚠️ Important:** Returns WAV format, NOT MP3. Save as `.wav`.

---

## 2. Text-to-Image

### 2.1 FLUX.1 Schnell — Fastest

**Model:** `@cf/black-forest-labs/flux-1-schnell`
**Cost:** $0.000053 per 512x512 tile

```json
POST /ai/run/@cf/black-forest-labs/flux-1-schnell
{
  "prompt": "A beautiful sunset over the ocean",
  "steps": 4
}
```

**Parameters:**
| Param | Type | Required | Default | Range |
|-------|------|----------|---------|-------|
| `prompt` | string | Yes | - | Max 2048 chars |
| `steps` | integer | No | 4 | 1-8 |
| `seed` | integer | No | random | - |

**Response:**
```json
{
  "result": {
    "image": "iVBORw0K..." // base64-encoded PNG
  }
}
```

---

### 2.2 SDXL Base 1.0 — Highest Quality

**Model:** `@cf/stabilityai/stable-diffusion-xl-base-1.0`

```json
POST /ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0
{
  "prompt": "A beautiful sunset over the ocean",
  "width": 1024,
  "height": 1024,
  "num_steps": 20
}
```

**Parameters:**
| Param | Type | Required | Default | Range |
|-------|------|----------|---------|-------|
| `prompt` | string | Yes | - | - |
| `width` | integer | No | - | 256-2048 |
| `height` | integer | No | - | 256-2048 |
| `num_steps` | integer | No | 20 | 1-20 |
| `guidance` | number | No | 7.5 | - |
| `negative_prompt` | string | No | - | - |

---

### 2.3 DreamShaper 8 LCM — Photorealistic

**Model:** `@cf/lykon/dreamshaper-8-lcm`

```json
POST /ai/run/@cf/lykon/dreamshaper-8-lcm
{
  "prompt": "A beautiful sunset over the ocean",
  "width": 512,
  "height": 512,
  "num_steps": 20
}
```

---

### 2.4 Lucid Origin (Leonardo) — Design Quality

**Model:** `@cf/leonardo/lucid-origin`

```json
POST /ai/run/@cf/leonardo/lucid-origin
{
  "prompt": "A beautiful sunset over the ocean"
}
```

---

### 2.5 Phoenix 1.0 (Leonardo)

**Model:** `@cf/leonardo/phoenix-1.0`

```json
POST /ai/run/@cf/leonardo/phoenix-1.0
{
  "prompt": "A beautiful sunset over the ocean"
}
```

---

### 2.6 SDXL Lightning — Ultra Fast

**Model:** `@cf/bytedance/stable-diffusion-xl-lightning`

```json
POST /ai/run/@cf/bytedance/stable-diffusion-xl-lightning
{
  "prompt": "A beautiful sunset over the ocean",
  "width": 1024,
  "height": 1024
}
```

**Response:** Binary JPEG image (not base64 JSON)

---

## 3. Translation

### 3.1 M2M100 — 100 Languages

**Model:** `@cf/meta/m2m100-1.2b`
**Cost:** $0.34 per M tokens

```json
POST /ai/run/@cf/meta/m2m100-1.2b
{
  "text": "Hello, how are you today?",
  "source_lang": "english",
  "target_lang": "persian"
}
```

**Parameters:**
| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `text` | string | Yes | - | Text to translate |
| `source_lang` | string | No | `english` | Auto-detect if omitted |
| `target_lang` | string | Yes | - | Target language name |

**Language names (not codes):** `english`, `french`, `spanish`, `german`, `arabic`, `chinese`, `japanese`, `russian`, `persian`, `hindi`, `portuguese`, `italian`, `korean`, `turkish`, etc.

**⚠️ Use "persian" NOT "farsi"** (farsi is not supported)

**Response:**
```json
{
  "result": {
    "translated_text": "سلام، حالتان چطور است؟",
    "usage": {
      "prompt_tokens": 9,
      "completion_tokens": 13,
      "total_tokens": 22,
      "neurons": 0.68
    }
  }
}
```

---

## 4. Text Generation (LLM)

**Base format for all LLMs:**
```json
POST /ai/run/{MODEL_ID}
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Your question here"}
  ],
  "max_tokens": 200
}
```

**Response:**
```json
{
  "result": {
    "response": "The model's answer here",
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 100,
      "total_tokens": 150,
      "neurons": 4.5
    }
  }
}
```

### 4.1 GPT-OSS 120B — Best General Purpose

**Model:** `@cf/openai/gpt-oss-120b`
**Speed:** ~2.2s | **Tags:** function calling, reasoning

```json
{
  "messages": [
    {"role": "user", "content": "What is the capital of France?"}
  ],
  "max_tokens": 200
}
```

---

### 4.2 GPT-OSS 20B — Fast

**Model:** `@cf/openai/gpt-oss-20b`
**Speed:** ~2.3s

---

### 4.3 Llama 4 Scout 17B — Vision Support

**Model:** `@cf/meta/llama-4-scout-17b-16e-instruct`
**Speed:** ~2.5s | **Tags:** vision, function calling

**Text only:**
```json
{
  "messages": [{"role": "user", "content": "Hello!"}],
  "max_tokens": 200
}
```

**With image (vision):**
```json
{
  "messages": [{
    "role": "user",
    "content": [
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}},
      {"type": "text", "text": "Describe this image"}
    ]
  }],
  "max_tokens": 200
}
```

---

### 4.4 Llama 3.3 70B — Fast

**Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
**Speed:** ~2.5s

---

### 4.5 Qwen3 30B — Reasoning

**Model:** `@cf/qwen/qwen3-30b-a3b-fp8`
**Speed:** ~2.3s | **Tags:** reasoning, function calling

---

### 4.6 QwQ 32B — Deep Reasoning

**Model:** `@cf/qwen/qwq-32b`
**Speed:** ~6.6s | **Tags:** reasoning

---

### 4.7 DeepSeek R1 32B — Reasoning

**Model:** `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`
**Speed:** ~6.0s | **Tags:** reasoning

---

### 4.8 Mistral Small 24B — Budget

**Model:** `@cf/mistralai/mistral-small-3.1-24b-instruct`
**Speed:** ~3.3s | **Tags:** function calling, vision

---

### 4.9 Kimi K2.7 Code — Best for Code

**Model:** `@cf/moonshotai/kimi-k2.7-code`
**Speed:** ~4.5s | **Tags:** function calling, reasoning, vision

---

### 4.10 Kimi K2.6 — Reasoning

**Model:** `@cf/moonshotai/kimi-k2.6`
**Speed:** ~6.5s | **Tags:** function calling, reasoning, vision

---

### 4.11 GLM 4.7 Flash — Fast

**Model:** `@cf/zai-org/glm-4.7-flash`
**Speed:** ~3.0s | **Tags:** fast, function calling

---

### 4.12 Granite 4.0 — Function Calling

**Model:** `@cf/ibm-granite/granite-4.0-h-micro`
**Speed:** ~3.1s

---

### 4.13 Nemotron 3 120B — Function Calling

**Model:** `@cf/nvidia/nemotron-3-120b-a12b`
**Speed:** ~2.3s | **Tags:** function calling, reasoning

---

## 5. Speech-to-Text (ASR)

### 5.1 Whisper Large V3 Turbo — Best Quality (VERIFIED: Persian, English, OGG/WAV)

**Model:** `@cf/openai/whisper-large-v3-turbo`
**Cost:** $0.00051 per audio minute
**Supports:** WAV, OGG, MP3, FLAC, WebM | Auto-detects language

**Request:**
```json
POST /ai/run/@cf/openai/whisper-large-v3-turbo
{
  "audio": "UklGRi..." // base64-encoded audio (WAV/OGG/MP3/FLAC)
}
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `audio` | string/array | Required | Audio data (base64 or byte array) |
| `task` | string | `transcribe` | `transcribe` = transcribe original language, `translate` = translate to English |
| `language` | string | auto | Language code: `fa`, `en`, `ar`, `es`, `fr`, etc. |
| `vad_filter` | boolean | `false` | Filter silence before processing |
| `initial_prompt` | string | - | Context text to improve accuracy |
| `prefix` | string | - | Prefix for output |
| `beam_size` | integer | `5` | Beam search width (higher = slower but more accurate) |
| `condition_on_previous_text` | boolean | `true` | Prevent hallucination loops |
| `no_speech_threshold` | number | `0.6` | Silence detection threshold |
| `compression_ratio_threshold` | number | `2.4` | Filter repetitive text |
| `log_prob_threshold` | number | `-1` | Confidence threshold |
| `hallucination_silence_threshold` | number | - | Skip silent periods causing hallucinations |

**Full Response:**
```json
{
  "result": {
    "text": "یک متنه تسته یک دو سه چهار",
    "word_count": 7,
    "transcription_info": {
      "language": "farsi",
      "language_probability": 0.85,
      "duration": 5.2,
      "duration_after_vad": 4.8
    },
    "segments": [
      {
        "start": 0.0,
        "end": 2.5,
        "text": "یک متنه تسته",
        "temperature": 0.0,
        "avg_logprob": -0.15,
        "compression_ratio": 1.2,
        "no_speech_prob": 0.01,
        "words": [
          {"word": "یک", "start": 0.0, "end": 0.3},
          {"word": "متنه", "start": 0.3, "end": 0.8}
        ]
      }
    ],
    "vtt": "WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nیک متنه تسته"
  }
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `text` | Complete transcribed text |
| `word_count` | Number of words |
| `transcription_info.language` | Detected language name |
| `transcription_info.language_probability` | Detection confidence (0-1) |
| `transcription_info.duration` | Original audio duration (seconds) |
| `transcription_info.duration_after_vad` | Duration after removing silence |
| `segments[].start/end` | Segment timing (seconds) |
| `segments[].text` | Segment text |
| `segments[].words[].word` | Individual word |
| `segments[].words[].start/end` | Word timing (seconds) |
| `segments[].avg_logprob` | Confidence score |
| `segments[].no_speech_prob` | Silence probability |
| `vtt` | WebVTT subtitle format |

**Use Cases:**
- Persian to English translation: `{"audio": "...", "task": "translate", "language": "fa"}`
- Generate subtitles: Use `segments[]` for timed text
- Word-level timing: Use `segments[].words[]` for karaoke-style display

---

### 5.2 Whisper Base

**Model:** `@cf/openai/whisper`

**Format: array of integers**
```json
POST /ai/run/@cf/openai/whisper
{
  "audio": [1, 2, 3, ...] // raw bytes as array
}
```

---

### 5.3 Whisper Tiny EN — English Only

**Model:** `@cf/openai/whisper-tiny-en`

**Format: array of integers**
```json
POST /ai/run/@cf/openai/whisper-tiny-en
{
  "audio": [1, 2, 3, ...]
}
```

---

### 5.4 Deepgram Nova 3 — Best Accuracy (99.7%)

**Model:** `@cf/deepgram/nova-3`
**Cost:** $0.0052 per audio minute

**Format: raw binary (NOT JSON)**
```
POST /ai/run/@cf/deepgram/nova-3
Content-Type: audio/wav
Authorization: Bearer {API_KEY}

[raw WAV bytes]
```

**Response:**
```json
{
  "result": {
    "results": {
      "channels": [{
        "alternatives": [{
          "transcript": "Hello, this is a test.",
          "confidence": 0.997,
          "words": [...]
        }]
      }]
    }
  }
}
```

---

## 6. Voice Activity Detection (End-of-Turn)

### 6.1 Smart Turn V2

**Model:** `@cf/pipecat-ai/smart-turn-v2`
**Cost:** $0.00034 per audio minute

**Format: base64 audio in JSON**
```json
POST /ai/run/@cf/pipecat-ai/smart-turn-v2
{
  "audio": "UklGRi..." // base64-encoded WAV
}
```

**Response:**
```json
{
  "result": {
    "is_complete": true,
    "probability": 0.95
  }
}
```

- `is_complete: true` → User finished speaking
- `is_complete: false` → User still speaking
- Language-independent (detects speech vs silence)

---

## 7. Sentiment Analysis

### 7.1 DistilBERT SST-2

**Model:** `@cf/huggingface/distilbert-sst-2-int8`

```json
POST /ai/run/@cf/huggingface/distilbert-sst-2-int8
{
  "text": "I love this product! It's amazing."
}
```

**Response:**
```json
{
  "result": [
    {"label": "NEGATIVE", "score": 0.0001},
    {"label": "POSITIVE", "score": 0.9999}
  ]
}
```

- Highest score = predicted sentiment
- Returns both labels with probabilities

---

## 8. Text Embeddings

### 8.1 BGE M3 — Multi-lingual

**Model:** `@cf/baai/bge-m3`

```json
POST /ai/run/@cf/baai/bge-m3
{
  "text": "Cloudflare Workers AI is great."
}
```

**Response:**
```json
{
  "result": {
    "data": [[0.005, -0.037, ...]], // 768-dimensional vector
    "meta": {"cost_metric_value_1": 17}
  }
}
```

---

### 8.2 BGE Large — English (1024d)

**Model:** `@cf/baai/bge-large-en-v1.5`

```json
POST /ai/run/@cf/baai/bge-large-en-v1.5
{
  "text": "Cloudflare Workers AI is great."
}
```

**Response:**
```json
{
  "result": {
    "data": [[0.005, -0.037, ...]] // 1024-dimensional vector
  }
}
```

---

## 9. Image Classification

### 9.1 ResNet-50

**Model:** `@cf/microsoft/resnet-50`

**Format: array of integers (NOT base64)**
```json
POST /ai/run/@cf/microsoft/resnet-50
{
  "image": [137, 66, 24, ...] // raw image bytes as array
}
```

**Response:**
```json
{
  "result": [
    {"label": "SEASHORE", "score": 0.42},
    {"label": "VOLCANO", "score": 0.20},
    {"label": "SCHOONER", "score": 0.19}
  ]
}
```

---

## 10. Object Detection

### 10.1 DETR ResNet-50

**Model:** `@cf/facebook/detr-resnet-50`

**Format: array of integers (NOT base64)**
```json
POST /ai/run/@cf/facebook/detr-resnet-50
{
  "image": [137, 66, 24, ...] // raw image bytes as array
}
```

**Response:**
```json
{
  "result": [
    {"label": "cat", "score": 0.95, "box": {"xmin": 100, "ymin": 50, "xmax": 300, "ymax": 250}},
    {"label": "dog", "score": 0.87, "box": {"xmin": 400, "ymin": 100, "xmax": 600, "ymax": 350}}
  ]
}
```

- Empty array `[]` = no objects detected
- `box` coordinates are pixel values

---

## 11. Vision (Image-to-Text)

### 11.1 Moondream 3.1

**Model:** `@cf/moondream/moondream3.1-9B-A2B`

**Format: OpenAI-compatible messages**
```json
POST /ai/run/@cf/moondream/moondream3.1-9B-A2B
{
  "messages": [{
    "role": "user",
    "content": [
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}},
      {"type": "text", "text": "Describe this image"}
    ]
  }],
  "max_tokens": 200
}
```

**Response:** Same as LLM format (text description of image)

---

## Quick Reference: API Formats by Model Type

| Type | Format | Example |
|------|--------|---------|
| LLM (chat) | JSON messages | `{"messages": [...]}` |
| TTS (Aura) | JSON text+speaker | `{"text": "...", "speaker": "luna"}` |
| TTS (MeloTTS) | JSON prompt+lang | `{"prompt": "...", "lang": "en"}` |
| Translation | JSON text+langs | `{"text": "...", "target_lang": "persian"}` |
| Image Gen | JSON prompt | `{"prompt": "...", "steps": 4}` |
| STT (Whisper) | JSON base64/array | `{"audio": "base64..."}` or `{"audio": [1,2,3]}` |
| STT (Nova 3) | Raw binary | `Content-Type: audio/wav` + raw bytes |
| VAD | JSON base64 | `{"audio": "base64..."}` |
| Sentiment | JSON text | `{"text": "..."}` |
| Embeddings | JSON text | `{"text": "..."}` |
| Image Class | JSON array | `{"image": [1,2,3,...]}` |
| Object Det | JSON array | `{"image": [1,2,3,...]}` |
| Vision | JSON messages | `{"messages": [{"content": [...]}]}` |

---

## Cost Summary (Free Tier)

| Category | Models | Daily Limit |
|----------|--------|-------------|
| TTS | All 4 models | 10,000 neurons/account |
| Image Gen | All 6 models | 10,000 neurons/account |
| Translation | M2M100 | 10,000 neurons/account |
| LLM | All 13 models | 10,000 neurons/account |
| STT | All 4 models | 10,000 neurons/account |
| VAD | Smart Turn V2 | 10,000 neurons/account |
| Sentiment | DistilBERT | 10,000 neurons/account |
| Embeddings | BGE M3/Large | 10,000 neurons/account |
| Image Class | ResNet-50 | 10,000 neurons/account |
| Object Det | DETR | 10,000 neurons/account |
| Vision | Moondream | 10,000 neurons/account |

**Total:** 30,000 neurons/day across 3 accounts.
