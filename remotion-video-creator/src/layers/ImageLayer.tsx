import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { ImageLayerConfig } from "./types";
import { resolvePosition } from "./positionHelper";

export const ImageLayer: React.FC<{ config: ImageLayerConfig }> = ({
  config,
}) => {
  if (!config.source || !config.source.trim()) return null;

  const posStyle = resolvePosition(
    config.position ?? "top-right",
    config.offsetX ?? 24,
    config.offsetY ?? 24,
  );

  // Support both staticFile paths and external URLs
  const src = config.source.startsWith("http")
    ? config.source
    : staticFile(config.source);

  return (
    <AbsoluteFill>
      <div style={posStyle}>
        <Img
          src={src}
          style={{
            width: config.width ?? "auto",
            height: config.height ?? 60,
            objectFit: config.objectFit ?? "contain",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
