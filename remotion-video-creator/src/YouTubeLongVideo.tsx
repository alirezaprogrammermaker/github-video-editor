import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  continueRender,
  delayRender,
  cancelRender,
} from "remotion";
import { loadFont } from "@remotion/fonts";
import type { YouTubeLongVideoProps } from "./schemas";
import {
  findActiveCue,
  getCueOpacity,
  useSubtitleCues,
} from "./utils/subtitles";
import { textDirectionStyle } from "./utils/textDirection";

const fontFamily = "Vazirmatn";

export const YouTubeLongVideo: React.FC<YouTubeLongVideoProps> = ({
  videoSrc = "video.mp4",
  subtitleContent = "",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  const cues = useSubtitleCues(subtitleContent);
  const currentTime = frame / fps;
  const activeCue = findActiveCue(cues, currentTime);
  const subtitleOpacity = getCueOpacity(activeCue, currentTime, fps);

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      <OffthreadVideo
        src={staticFile(videoSrc)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

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
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              borderRadius: 8,
              padding: "10px 24px",
              ...textDirectionStyle("auto"),
            }}
          >
            {activeCue.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
