import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import type { SubtitleLayerConfig, SubtitleMode } from "./types";
import { parseVtt, SubtitleCue } from "../utils/parseVtt";
import { resolvePosition } from "./positionHelper";

const DEFAULT_FONT = "Vazirmatn";

/**
 * Find the active cue at the current time.
 */
function findActiveCue(
  cues: SubtitleCue[],
  time: number,
): SubtitleCue | null {
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) return cue;
  }
  return null;
}

/**
 * Smooth opacity for fade in/out transitions.
 */
function getCueOpacity(
  cue: SubtitleCue | null,
  time: number,
  fps: number,
): number {
  if (!cue) return 0;
  const fade = Math.round(fps * 0.15) / fps;
  const fadeIn = interpolate(
    time,
    [cue.start, cue.start + fade],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const fadeOut = interpolate(
    time,
    [cue.end - fade, cue.end],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return Math.min(fadeIn, fadeOut);
}

// --- Classic mode: white text with shadow at bottom ---
const ClassicSubtitle: React.FC<{
  cue: SubtitleCue;
  config: SubtitleLayerConfig;
  opacity: number;
}> = ({ cue, config, opacity }) => {
  const posStyle = resolvePosition(
    config.position ?? "bottom-center",
    config.offsetX ?? 0,
    config.offsetY ?? 80,
  );

  return (
    <div style={{ ...posStyle, opacity, padding: "0 40px" }}>
      <div
        style={{
          fontSize: config.fontSize ?? 44,
          fontFamily: config.fontFamily ?? DEFAULT_FONT,
          fontWeight: config.fontWeight ?? 700,
          lineHeight: 1.4,
          textAlign: "center",
          color: config.color ?? "white",
          textShadow:
            config.textShadow ??
            "0 0 8px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.9), -2px -2px 4px rgba(0,0,0,0.9), 0 3px 10px rgba(0,0,0,0.7)",
          maxWidth: config.maxWidth ?? "85%",
          whiteSpace: "pre-wrap",
          backgroundColor: config.bgColor ?? "rgba(0, 0, 0, 0.55)",
          borderRadius: config.borderRadius ?? 8,
          padding: `${config.padding ?? 10}px 24px`,
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

// --- Karaoke mode: each word highlights as time progresses ---
const KaraokeSubtitle: React.FC<{
  cue: SubtitleCue;
  config: SubtitleLayerConfig;
  opacity: number;
  currentTime: number;
}> = ({ cue, config, opacity, currentTime }) => {
  const posStyle = resolvePosition(
    config.position ?? "bottom-center",
    config.offsetX ?? 0,
    config.offsetY ?? 100,
  );

  const words = cue.text.split(/\s+/);
  const elapsed = currentTime - cue.start;
  const duration = cue.end - cue.start;
  const wordDuration = duration / Math.max(words.length, 1);
  const currentWordIdx = Math.min(
    Math.floor(elapsed / wordDuration),
    words.length - 1,
  );

  return (
    <div style={{ ...posStyle, opacity, padding: "0 40px" }}>
      <div
        style={{
          fontSize: config.fontSize ?? 48,
          fontFamily: config.fontFamily ?? DEFAULT_FONT,
          fontWeight: config.fontWeight ?? 800,
          lineHeight: 1.5,
          textAlign: "center",
          maxWidth: config.maxWidth ?? "90%",
          whiteSpace: "pre-wrap",
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              color: i <= currentWordIdx
                ? (config.highlightColor ?? "#FFFFFF")
                : (config.color ?? "rgba(255,255,255,0.5)"),
              textShadow: i <= currentWordIdx
                ? `0 0 12px ${config.highlightColor ?? "#FFFFFF"}, 0 0 20px rgba(255,215,0,0.6)`
                : "none",
              transition: "color 0.05s, text-shadow 0.05s",
              marginRight: "0.3em",
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
};

// --- Bold center mode: large bold text in the middle ---
const BoldCenterSubtitle: React.FC<{
  cue: SubtitleCue;
  config: SubtitleLayerConfig;
  opacity: number;
}> = ({ cue, config, opacity }) => {
  const posStyle = resolvePosition(
    config.position ?? "center",
    config.offsetX ?? 0,
    config.offsetY ?? 0,
  );

  return (
    <div style={{ ...posStyle, opacity, padding: "0 40px" }}>
      <div
        style={{
          fontSize: config.fontSize ?? 64,
          fontFamily: config.fontFamily ?? DEFAULT_FONT,
          fontWeight: config.fontWeight ?? 900,
          lineHeight: 1.3,
          textAlign: "center",
          color: config.color ?? "white",
          textShadow:
            config.textShadow ??
            "0 0 10px rgba(0,0,0,1), 3px 3px 6px rgba(0,0,0,0.9), -3px -3px 6px rgba(0,0,0,0.9)",
          maxWidth: config.maxWidth ?? "85%",
          whiteSpace: "pre-wrap",
          backgroundColor: config.bgColor ?? "transparent",
          borderRadius: config.borderRadius ?? 0,
          padding: config.padding ? `${config.padding}px 24px` : "0",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

// --- Main SubtitleLayer component ---
export const SubtitleLayer: React.FC<{ config: SubtitleLayerConfig }> = ({
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const cues = useMemo(() => {
    if (!config.source || !config.source.trim()) return [];
    return parseVtt(config.source);
  }, [config.source]);

  const activeCue = findActiveCue(cues, currentTime);
  const opacity = getCueOpacity(activeCue, currentTime, fps);
  const mode: SubtitleMode = config.mode ?? "classic";

  if (!activeCue) return null;

  switch (mode) {
    case "karaoke":
      return (
        <AbsoluteFill>
          <KaraokeSubtitle
            cue={activeCue}
            config={config}
            opacity={opacity}
            currentTime={currentTime}
          />
        </AbsoluteFill>
      );
    case "bold-center":
      return (
        <AbsoluteFill>
          <BoldCenterSubtitle
            cue={activeCue}
            config={config}
            opacity={opacity}
          />
        </AbsoluteFill>
      );
    default:
      return (
        <AbsoluteFill>
          <ClassicSubtitle
            cue={activeCue}
            config={config}
            opacity={opacity}
          />
        </AbsoluteFill>
      );
  }
};
