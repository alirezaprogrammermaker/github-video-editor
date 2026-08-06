import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleLayerConfig, SubtitleMode } from "./types";
import type { SubtitleCue } from "../utils/parseVtt";
import {
  findActiveCue,
  getCueOpacity,
  useSubtitleCues,
} from "../utils/subtitles";
import { resolvePosition } from "./positionHelper";
import { textDirectionStyle } from "../utils/textDirection";

const DEFAULT_FONT = "Vazirmatn";

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
          ...textDirectionStyle(config.direction ?? "auto"),
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

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
          ...textDirectionStyle(config.direction ?? "auto"),
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              color:
                i <= currentWordIdx
                  ? (config.highlightColor ?? "#FFFFFF")
                  : (config.color ?? "rgba(255,255,255,0.5)"),
              textShadow:
                i <= currentWordIdx
                  ? `0 0 12px ${config.highlightColor ?? "#FFFFFF"}, 0 0 20px rgba(255,215,0,0.6)`
                  : "none",
              marginInlineEnd: "0.3em",
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
};

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
          ...textDirectionStyle(config.direction ?? "auto"),
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

export const SubtitleLayer: React.FC<{ config: SubtitleLayerConfig }> = ({
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const cues = useSubtitleCues(config.source);
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
