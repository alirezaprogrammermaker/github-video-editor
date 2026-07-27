import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import type { TextLayerConfig } from "./types";
import { resolvePosition } from "./positionHelper";

const DEFAULT_FONT = "Vazirmatn";

export const TextLayer: React.FC<{ config: TextLayerConfig }> = ({
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const currentTime = frame / fps;

  if (!config.content || !config.content.trim()) return null;

  // Time-based visibility
  const startTime = config.startTime ?? 0;
  const endTime = config.endTime ?? Infinity;
  const duration = config.duration;

  let opacity = 1;

  // If duration is set, fade out after that time
  if (duration !== undefined) {
    const fadeFrames = Math.round(fps * (config.fadeOut ?? 0.5));
    const fadeDuration = fadeFrames / fps;
    opacity = interpolate(
      currentTime,
      [
        startTime,
        startTime + (config.fadeIn ?? 0),
        startTime + duration - fadeDuration,
        startTime + duration,
      ],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  } else if (currentTime < startTime || currentTime >= endTime) {
    opacity = 0;
  } else if (config.fadeIn) {
    opacity = interpolate(
      currentTime,
      [startTime, startTime + config.fadeIn],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  }

  // Scroll animation
  let scrollX = 0;
  if (config.scroll) {
    const textLen = config.content.length * (config.fontSize ?? 44) * 0.6;
    const scrollSpeed = config.scrollSpeed ?? 100; // px/sec
    const totalDistance = textLen + width + 100;
    const scrollDuration = totalDistance / scrollSpeed;

    const progress = interpolate(
      currentTime,
      [0, scrollDuration],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    scrollX = interpolate(progress, [0, 1], [-textLen - 50, width + 100]);

    // Fade in/out for scroll
    const scrollOpacity = interpolate(
      currentTime,
      [0, 0.5, scrollDuration - 1, scrollDuration],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    opacity *= scrollOpacity;
  }

  const posStyle = config.scroll
    ? { position: "absolute" as const, bottom: config.offsetY ?? 180, left: scrollX }
    : resolvePosition(
        config.position ?? "bottom-center",
        config.offsetX ?? 0,
        config.offsetY ?? 160,
      );

  return (
    <AbsoluteFill>
      <div style={{ ...posStyle, opacity }}>
        <div
          style={{
            backgroundColor: config.bgColor ?? "rgba(255, 255, 255, 0.95)",
            borderRadius: config.borderRadius ?? 14,
            padding: `${config.padding ?? 18}px ${(config.padding ?? 18) * 1.5}px`,
            display: "inline-block",
            maxWidth: config.scroll ? "none" : (config.maxWidth ?? "80vw"),
          }}
        >
          <div
            style={{
              fontSize: config.fontSize ?? 52,
              fontWeight: config.fontWeight ?? 700,
              fontFamily: config.fontFamily ?? DEFAULT_FONT,
              lineHeight: config.lineHeight ?? 1.5,
              textAlign: config.textAlign ?? "center",
              color: config.color ?? "black",
              whiteSpace: config.scroll
                ? "nowrap"
                : (config.whiteSpace ?? "pre-wrap"),
            }}
          >
            {config.content}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
