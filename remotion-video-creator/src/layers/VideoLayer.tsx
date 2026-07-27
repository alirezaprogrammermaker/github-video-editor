import React from "react";
import { Video, staticFile, AbsoluteFill } from "remotion";
import type { VideoLayerConfig } from "./types";

export const VideoLayer: React.FC<{ config: VideoLayerConfig }> = ({
  config,
}) => {
  const objectFit = config.objectFit ?? "cover";
  const loop = config.loop ?? true;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Video
        src={staticFile(config.source)}
        loop={loop}
        playbackRate={config.playbackRate ?? 1}
        style={{
          width: "100%",
          height: "100%",
          objectFit,
        }}
      />
    </AbsoluteFill>
  );
};
