export type SubtitleCue = {
  start: number; // seconds
  end: number; // seconds
  text: string;
};

/**
 * Convert a VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to seconds.
 */
function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(":");
  let h = 0,
    m = 0,
    s = 0;

  if (parts.length === 3) {
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    s = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    m = parseInt(parts[0], 10);
    s = parseFloat(parts[1]);
  }

  return h * 3600 + m * 60 + s;
}

/**
 * Parse WebVTT content into an array of subtitle cues.
 *
 * Supports the minimal VTT format produced by subtitle_pipeline.py:
 *   WEBVTT
 *
 *   00:00:01.234 --> 00:00:05.678
 *   Some text here
 *
 *   00:00:05.678 --> 00:00:10.123
 *   Another line
 */
export function parseVtt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  // Normalize line endings and split into lines
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Skip the WEBVTT header
  let i = 0;
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Look for timestamp line: HH:MM:SS.mmm --> HH:MM:SS.mmm
    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map((s) => s.trim());
      const start = parseTimestamp(startStr);
      const end = parseTimestamp(endStr);

      // Collect text lines until blank line or end
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        cues.push({
          start,
          end,
          text: textLines.join("\n"),
        });
      }
    } else {
      i++;
    }
  }

  return cues;
}
