import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  continueRender,
  delayRender,
  cancelRender,
} from "remotion";
import { loadFont } from "@remotion/fonts";

type InstagramReelProps = {
  watermark?: string;
  title?: string;
  scrollingText?: string;
};

const fontFamily = "Vazirmatn";
const fontWeight = "700";

// Simple text box with auto-expanding background
const TikTokTextBox: React.FC<{
  text: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  borderRadius?: number;
  padding?: number;
  nowrap?: boolean;
}> = ({ text, fontSize, color, backgroundColor, borderRadius = 20, padding = 20, nowrap = false }) => {
  if (!text.trim()) return null;

  return (
    <div
      style={{
        backgroundColor,
        borderRadius,
        padding: `${padding}px ${padding * 1.5}px`,
        display: "inline-block",
        maxWidth: nowrap ? "none" : "80vw",
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight,
          fontFamily,
          lineHeight: 1.5,
          textAlign: "center",
          color,
          whiteSpace: nowrap ? "nowrap" : "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const InstagramReel: React.FC<InstagramReelProps> = ({
  watermark = "@yourpage",
  title = "",
  scrollingText = "",
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Load fonts on mount with delayRender to prevent stuttering
  const [handle] = useState(() => delayRender("Loading fonts"));

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

  // Title timing: show for 3 seconds (90 frames)
  const titleDuration = 3 * fps;
  const titleOpacity = interpolate(frame, [0, 10, titleDuration - 15, titleDuration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scrolling text timing: starts from beginning, exits by end of video
  const { durationInFrames } = useVideoConfig();
  const scrollDuration = durationInFrames;
  const scrollProgress = interpolate(
    frame,
    [0, scrollDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }
  );

  const textWidth = scrollingText.length * 35;
  const scrollX = interpolate(scrollProgress, [0, 1], [-textWidth - 50, width + 100]);

  const scrollOpacity = interpolate(
    frame,
    [0, 15, scrollDuration - 30, scrollDuration - 5],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const showScrollingText = scrollingText.trim() !== "" && frame >= 0;

  // Watermark fade in
  const watermarkOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      <Video
        src={staticFile("video.mp4")}
        loop
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Watermark - top right */}
      {watermark.trim() !== "" && (
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            opacity: watermarkOpacity,
          }}
        >
          <TikTokTextBox
            text={watermark}
            fontSize={36}
            color="white"
            backgroundColor="rgba(0, 0, 0, 0.6)"
            borderRadius={20}
            padding={14}
          />
        </div>
      )}

      {/* Title - bottom center with TikTok style */}
      {title.trim() !== "" && (
        <div
          style={{
            position: "absolute",
            bottom: 96,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: titleOpacity,
          }}
        >
          <TikTokTextBox
            text={title}
            fontSize={52}
            color="black"
            backgroundColor="rgba(255, 255, 255, 0.95)"
            borderRadius={14}
            padding={18}
          />
        </div>
      )}

      {/* Scrolling text - red background with TikTok style */}
      {showScrollingText && (
        <div
          style={{
            position: "absolute",
            bottom: 180,
            left: scrollX,
            opacity: scrollOpacity,
          }}
        >
          <TikTokTextBox
            text={scrollingText}
            fontSize={44}
            color="white"
            backgroundColor="#dc2626"
            borderRadius={12}
            padding={16}
            nowrap
          />
        </div>
      )}
    </AbsoluteFill>
  );
};
