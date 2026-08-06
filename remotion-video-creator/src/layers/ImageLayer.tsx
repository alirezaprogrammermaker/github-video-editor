import React from "react";
import { AbsoluteFill, Img, staticFile, cancelRender } from "remotion";
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

  if (config.source.startsWith("http://")) {
    cancelRender(
      new Error(
        `ImageLayer only allows https:// URLs (got ${JSON.stringify(config.source)})`,
      ),
    );
  }

  const src = config.source.startsWith("https://")
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
