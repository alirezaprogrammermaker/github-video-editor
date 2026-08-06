import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { measureText } from "@remotion/layout-utils";
import type { TextLayerConfig } from "./types";
import { resolvePosition } from "./positionHelper";
import { textDirectionStyle } from "../utils/textDirection";

const DEFAULT_FONT = "Vazirmatn";

export const TextLayer: React.FC<{ config: TextLayerConfig }> = ({
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const currentTime = frame / fps;

  if (!config.content || !config.content.trim()) return null;

  // startTime / endTime / fadeIn / fadeOut are applied by DynamicTemplate LayerRenderer.
  // duration is text-specific: auto-fade after N seconds from startTime.
  const startTime = config.startTime ?? 0;
  const duration = config.duration;
  const fontSize = config.fontSize ?? 52;
  const fontFamily = config.fontFamily ?? DEFAULT_FONT;
  const fontWeight = config.fontWeight ?? 700;
  const padding = config.padding ?? 18;

  let opacity = 1;

  if (duration !== undefined) {
    const fadeDuration = config.fadeOut ?? 0.5;
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
  }

  let scrollX = 0;
  if (config.scroll) {
    const measured = measureText({
      text: config.content,
      fontFamily,
      fontSize,
      fontWeight,
    });
    const textLen = measured.width + padding * 1.5 * 2;
    const scrollSpeed = config.scrollSpeed ?? 100;
    const totalDistance = textLen + width + 100;
    const scrollDuration = totalDistance / scrollSpeed;

    const progress = interpolate(currentTime, [0, scrollDuration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    scrollX = interpolate(progress, [0, 1], [-textLen - 50, width + 100]);

    const scrollOpacity = interpolate(
      currentTime,
      [0, 0.5, scrollDuration - 1, scrollDuration],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    opacity *= scrollOpacity;
  }

  const posStyle = config.scroll
    ? {
        position: "absolute" as const,
        bottom: config.offsetY ?? 180,
        left: scrollX,
      }
    : resolvePosition(
        config.position ?? "bottom-center",
        config.offsetX ?? 0,
        config.offsetY ?? 160,
      );

  const directionStyle = textDirectionStyle(config.direction ?? "auto");

  return (
    <AbsoluteFill>
      <div style={{ ...posStyle, opacity }}>
        <div
          style={{
            backgroundColor: config.bgColor ?? "rgba(255, 255, 255, 0.95)",
            borderRadius: config.borderRadius ?? 14,
            padding: `${padding}px ${padding * 1.5}px`,
            display: "inline-block",
            maxWidth: config.scroll ? "none" : (config.maxWidth ?? "80vw"),
          }}
        >
          <div
            style={{
              fontSize,
              fontWeight,
              fontFamily,
              lineHeight: config.lineHeight ?? 1.5,
              textAlign: config.textAlign ?? "center",
              color: config.color ?? "black",
              whiteSpace: config.scroll
                ? "nowrap"
                : (config.whiteSpace ?? "pre-wrap"),
              ...directionStyle,
            }}
          >
            {config.content}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
