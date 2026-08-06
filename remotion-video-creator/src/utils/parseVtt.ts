export type SubtitleCue = {
  start: number; // seconds
  end: number; // seconds
  text: string;
};

/** `[HH:]MM:SS[.mmm]`, with `,` accepted as decimal separator for SRT-style input. */
const TIMESTAMP = String.raw`(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?`;

/** A cue timing line, ignoring any trailing cue settings such as `align:start position:50%`. */
const CUE_TIMING = new RegExp(
  `^\\s*${TIMESTAMP}\\s*-->\\s*${TIMESTAMP}(?:\\s+\\S.*)?\\s*$`,
);

/** Inline cue spans (`<c.yellow>`, `</c>`, `<v Ali>`) and karaoke timestamps (`<00:00:02.000>`). */
const INLINE_TAG = /<[^>]*>/g;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": "\u00a0",
  "&lrm;": "\u200e",
  "&rlm;": "\u200f",
};

function toSeconds(
  hours: string | undefined,
  minutes: string,
  seconds: string,
  millis: string | undefined,
): number {
  return (
    Number(hours ?? 0) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number((millis ?? "0").padEnd(3, "0")) / 1000
  );
}

/**
 * Remove inline cue markup and decode the entities WebVTT requires to be escaped.
 */
export function stripCueMarkup(text: string): string {
  return text
    .replace(INLINE_TAG, "")
    .replace(/&(?:amp|lt|gt|nbsp|lrm|rlm);/g, (entity) => ENTITIES[entity]);
}

/**
 * Parse WebVTT content into an array of subtitle cues.
 *
 * Supports the format produced by subtitle_pipeline.py:
 *   WEBVTT
 *
 *   00:00:01.234 --> 00:00:05.678
 *   Some text here
 *
 *   00:00:05.678 --> 00:00:10.123
 *   Another line
 *
 * Cue identifiers, `NOTE`/`STYLE`/`REGION` blocks and trailing cue settings are
 * ignored. Throws on a malformed cue timing instead of silently dropping the cue.
 */
export function parseVtt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.replace(/\r\n?/g, "\n").split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    if (/^(?:WEBVTT|NOTE|STYLE|REGION)\b/.test(lines[0].trim())) continue;

    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const timingLine = lines[timingIndex];
    const match = CUE_TIMING.exec(timingLine);
    if (!match) {
      throw new Error(
        `Invalid WebVTT cue timing: ${JSON.stringify(timingLine.trim())}`,
      );
    }

    const start = toSeconds(match[1], match[2], match[3], match[4]);
    const end = toSeconds(match[5], match[6], match[7], match[8]);
    if (end <= start) {
      throw new Error(
        `WebVTT cue ends before it starts: ${JSON.stringify(timingLine.trim())}`,
      );
    }

    const text = lines
      .slice(timingIndex + 1)
      .map((line) => stripCueMarkup(line).trim())
      .filter((line) => line !== "")
      .join("\n");

    if (text !== "") {
      cues.push({ start, end, text });
    }
  }

  return cues;
}
