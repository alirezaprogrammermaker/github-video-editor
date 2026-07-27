import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  continueRender,
  delayRender,
  cancelRender,
} from "remotion";
import { loadFont } from "@remotion/fonts";
import { parseVtt, SubtitleCue } from "./utils/parseVtt";

type YouTubeLongVideoProps = {
  videoSrc?: string;
  subtitleContent?: string;
  durationInSeconds?: number;
};

const fontFamily = "Vazirmatn";

/**
 * Find the subtitle cue that should be displayed at the given time.
 */
function findActiveCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  for (const cue of cues) {
    if (currentTime >= cue.start && currentTime < cue.end) {
      return cue;
    }
  }
  return null;
}

/**
 * Calculate opacity for smooth subtitle transitions (fade in/out over ~0.15s).
 */
function getSubtitleOpacity(
  cue: SubtitleCue | null,
  currentTime: number,
  fps: number,
): number {
  if (!cue) return 0;

  const fadeFrames = Math.round(fps * 0.15); // ~0.15s fade
  const fadeDuration = fadeFrames / fps;

  // Fade in at start
  const fadeIn = interpolate(
    currentTime,
    [cue.start, cue.start + fadeDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Fade out at end
  const fadeOut = interpolate(
    currentTime,
    [cue.end - fadeDuration, cue.end],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return Math.min(fadeIn, fadeOut);
}

export const YouTubeLongVideo: React.FC<YouTubeLongVideoProps> = ({
  videoSrc = "video.mp4",
  subtitleContent = "",
  durationInSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load fonts on mount
  const [handle] = useState(() => delayRender("Loading fonts and subtitles"));

  useEffect(() => {
    Promise.all([
      loadFont({
        family: "Vazirmatn",
        url: staticFile("Vazirmatn-Regular.ttf"),
        weight: "400",
      }),
      loadFont({
        family: "Vazirmatn",
        url: staticFile("Vazirmatn-Bold.ttf"),
        weight: "700",
      }),
    ])
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
  }, [handle]);

  // Parse VTT content once
  const cues = useMemo(() => {
    if (!subtitleContent || !subtitleContent.trim()) return [];
    return parseVtt(subtitleContent);
  }, [subtitleContent]);

  // Current time in seconds
  const currentTime = frame / fps;

  // Find the active subtitle cue
  const activeCue = findActiveCue(cues, currentTime);
  const subtitleOpacity = getSubtitleOpacity(activeCue, currentTime, fps);

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      {/* Video */}
      <Video
        src={staticFile(videoSrc)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Subtitles — bottom center, YouTube-style */}
      {activeCue && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: subtitleOpacity,
            padding: "0 60px",
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              fontFamily,
              lineHeight: 1.4,
              textAlign: "center",
              color: "white",
              textShadow:
                "0 0 8px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.9), -2px -2px 4px rgba(0,0,0,0.9), 0 3px 10px rgba(0,0,0,0.7)",
              maxWidth: "85%",
              whiteSpace: "pre-wrap",
              // Semi-transparent background bar
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              borderRadius: 8,
              padding: "10px 24px",
            }}
          >
            {activeCue.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
