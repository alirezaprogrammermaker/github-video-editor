import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
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
import { measureText } from "@remotion/layout-utils";
import type { InstagramReelProps } from "./schemas";
import {
  findActiveCue,
  getCueOpacity,
  useSubtitleCues,
} from "./utils/subtitles";
import { textDirectionStyle } from "./utils/textDirection";

const fontFamily = "Vazirmatn";
const fontWeight = "700";
const MARQUEE_FONT_SIZE = 44;
const MARQUEE_PADDING = 16;

const TikTokTextBox: React.FC<{
  text: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  borderRadius?: number;
  padding?: number;
  nowrap?: boolean;
}> = ({
  text,
  fontSize,
  color,
  backgroundColor,
  borderRadius = 20,
  padding = 20,
  nowrap = false,
}) => {
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
          ...textDirectionStyle("auto"),
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
  const { fps, width, durationInFrames } = useVideoConfig();

  const cues = useSubtitleCues(subtitleContent);
  const currentTime = frame / fps;
  const activeCue = findActiveCue(cues, currentTime);
  const subtitleOpacity = getCueOpacity(activeCue, currentTime, fps);

  const [handle] = useState(() => delayRender("Loading fonts"));
  const [fontsReady, setFontsReady] = useState(false);

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
      .then(() => {
        setFontsReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);

  // Title timing: show for up to 3s, then marquee starts (matches workflow intent)
  const titleDuration = Math.min(3 * fps, durationInFrames);
  const marqueeStart = title.trim() !== "" ? titleDuration : 0;

  const titleOpacity =
    titleDuration <= 1
      ? interpolate(frame, [0, 1], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(
          frame,
          [0, Math.max(titleDuration - 15, 1), titleDuration],
          [1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

  const textWidth = useMemo(() => {
    if (!scrollingText.trim() || !fontsReady) {
      return scrollingText.length * 20;
    }
    const measured = measureText({
      text: scrollingText,
      fontFamily,
      fontSize: MARQUEE_FONT_SIZE,
      fontWeight,
    });
    return measured.width + MARQUEE_PADDING * 1.5 * 2;
  }, [scrollingText, fontsReady]);

  const marqueeActive = marqueeStart < durationInFrames;
  const marqueeEnd = Math.max(durationInFrames, marqueeStart + 1);
  const scrollProgress = marqueeActive
    ? interpolate(frame, [marqueeStart, marqueeEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    : 0;

  const scrollX = interpolate(
    scrollProgress,
    [0, 1],
    [-textWidth - 50, width + 100],
  );

  const marqueeSpan = marqueeEnd - marqueeStart;
  const scrollOpacity = !marqueeActive
    ? 0
    : marqueeSpan <= 30
      ? interpolate(frame, [marqueeStart, marqueeEnd], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(
          frame,
          [
            marqueeStart,
            marqueeStart + 15,
            marqueeEnd - 30,
            marqueeEnd - 5,
          ],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

  const showScrollingText =
    scrollingText.trim() !== "" && frame >= marqueeStart;

  const watermarkOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      <OffthreadVideo
        src={staticFile(videoSrc)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

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
            fontSize={MARQUEE_FONT_SIZE}
            color="white"
            backgroundColor="#dc2626"
            borderRadius={12}
            padding={MARQUEE_PADDING}
            nowrap
          />
        </div>
      )}

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
