import React from "react";
import { OffthreadVideo, staticFile, AbsoluteFill } from "remotion";
import type { VideoLayerConfig } from "./types";

export const VideoLayer: React.FC<{ config: VideoLayerConfig }> = ({
  config,
}) => {
  const objectFit = config.objectFit ?? "cover";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(config.source)}
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
