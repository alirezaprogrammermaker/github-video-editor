import React, { useEffect, useMemo, useState } from "react";
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
import { parseVtt, SubtitleCue } from "./utils/parseVtt";

type InstagramReelProps = {
  watermark?: string;
  title?: string;
  scrollingText?: string;
  videoSrc?: string;
  subtitleContent?: string;
};

/**
 * Find the subtitle cue that should be displayed at the given time.
 */
function findActiveCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  for (const cue of cues) {
    if (currentTime >= cue.start && currentTime < cue.end) {
      return cue;
    }
  }
  return null;
}

/**
 * Calculate opacity for smooth subtitle transitions (fade in/out over ~0.15s).
 */
function getSubtitleOpacity(
  cue: SubtitleCue | null,
  currentTime: number,
  fps: number,
): number {
  if (!cue) return 0;

  const fadeDuration = Math.round(fps * 0.15) / fps;

  const fadeIn = interpolate(
    currentTime,
    [cue.start, cue.start + fadeDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const fadeOut = interpolate(
    currentTime,
    [cue.end - fadeDuration, cue.end],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return Math.min(fadeIn, fadeOut);
}

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
  videoSrc = "video.mp4",
  subtitleContent = "",
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Parse VTT subtitles
  const cues = useMemo(() => {
    if (!subtitleContent || !subtitleContent.trim()) return [];
    return parseVtt(subtitleContent);
  }, [subtitleContent]);

  const currentTime = frame / fps;
  const activeCue = findActiveCue(cues, currentTime);
  const subtitleOpacity = getSubtitleOpacity(activeCue, currentTime, fps);

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
  const titleOpacity = interpolate(frame, [0, titleDuration - 15, titleDuration], [1, 1, 0], {
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
        src={staticFile(videoSrc)}
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
            bottom: 160,
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

      {/* Subtitles — bottom center, vertical-friendly style */}
      {activeCue && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            opacity: subtitleOpacity,
            padding: "0 32px",
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              fontFamily,
              lineHeight: 1.4,
              textAlign: "center",
              color: "white",
              textShadow:
                "0 0 6px rgba(0,0,0,0.9), 2px 2px 3px rgba(0,0,0,0.9), -2px -2px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)",
              maxWidth: "90%",
              whiteSpace: "pre-wrap",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              borderRadius: 8,
              padding: "8px 20px",
            }}
          >
            {activeCue.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
