import { useMemo } from "react";
import { cancelRender, interpolate } from "remotion";
import { parseVtt, SubtitleCue } from "./parseVtt";

/** Fade in/out duration applied at the edges of every cue. */
const FADE_SECONDS = 0.15;

/**
 * Find the subtitle cue that should be displayed at the given time.
 */
export function findActiveCue(
  cues: SubtitleCue[],
  currentTime: number,
): SubtitleCue | null {
  for (const cue of cues) {
    if (currentTime >= cue.start && currentTime < cue.end) {
      return cue;
    }
  }
  return null;
}

/**
 * Calculate opacity for smooth subtitle transitions.
 */
export function getCueOpacity(
  cue: SubtitleCue | null,
  currentTime: number,
  fps: number,
): number {
  if (!cue) return 0;

  const fadeDuration = Math.max(Math.round(fps * FADE_SECONDS), 1) / fps;

  const fadeIn = interpolate(
    currentTime,
    [cue.start, cue.start + fadeDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const fadeOut = interpolate(
    currentTime,
    [cue.end - fadeDuration, cue.end],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return Math.min(fadeIn, fadeOut);
}

/**
 * Parse VTT content once per composition. A malformed track cancels the render
 * rather than producing a video that is silently missing its subtitles.
 */
export function useSubtitleCues(content: string | undefined): SubtitleCue[] {
  return useMemo(() => {
    if (!content || !content.trim()) return [];
    try {
      return parseVtt(content);
    } catch (err) {
      return cancelRender(err);
    }
  }, [content]);
}
