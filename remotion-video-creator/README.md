# remotion-video-creator

Remotion compositions used by GitHub Actions to render Instagram Reels and YouTube long-form videos with Persian (RTL) overlays, marquee text, and WebVTT subtitles.

## Compositions

| ID | Size | Purpose |
| --- | --- | --- |
| `InstagramReel` | 720×1280 | Vertical reel with watermark, title, marquee, subtitles |
| `YouTubeLongVideo` | 1920×1080 | Landscape video with subtitles |
| `DynamicTemplate` | 720×1280 (default) | Layer-based template from a JSON config (`templateConfig`) |

Props are validated at runtime via zod schemas in `src/schemas.ts`.

## Setup

```console
npm ci
```

Fonts live in `public/` (`Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf`). Place the source clip as `public/video.mp4` (or pass another `videoSrc` that matches `^[\w.-]+\.mp4$`).

## Commands

**Studio preview**

```console
npm run dev
```

**Lint + typecheck**

```console
npm run lint
```

**Unit tests** (`parseVtt`, `positionHelper`)

```console
npm test
```

**Render Instagram Reel**

```console
npx remotion render InstagramReel out/reel.mp4 --props=props.example.json
```

**Render YouTube long video**

```console
npx remotion render YouTubeLongVideo out/youtube.mp4 --props=props.example.json
```

**Render a dynamic template**

```console
npx remotion render DynamicTemplate out/dynamic.mp4 --props=props.example.json
```

`DynamicTemplate` also requires a `templateConfig` string (JSON) describing layers. See `src/schemas.ts` (`templateConfigSchema`) for the contract.

## Props (InstagramReel)

| Prop | Type | Notes |
| --- | --- | --- |
| `videoSrc` | string | Filename inside `public/`, e.g. `video.mp4` |
| `watermark` | string | Top-right badge |
| `title` | string | Static title for the first ~3s |
| `scrollingText` | string | Marquee after the title ends |
| `subtitleContent` | string | WebVTT document |
| `durationInSeconds` | number | Composition length (default 15) |

## WebVTT

Subtitles are parsed by `src/utils/parseVtt.ts`. Cue settings after `-->` are ignored; inline tags are stripped. Malformed cues cancel the render via `cancelRender`.

## Notes

- Video frames use `<OffthreadVideo>` (ffmpeg), not Chrome's `<Video>` decoder.
- `OffthreadVideo` has no `loop` prop; composition duration is set to the clip length via `calculateMetadata`.
- Invalid `DynamicTemplate` JSON / schema failures call `cancelRender` so a bad template never publishes as a successful black video.
