import "./index.css";
import { Composition, CalculateMetadataFunction } from "remotion";
import { InstagramReel } from "./InstagramReel";
import { YouTubeLongVideo } from "./YouTubeLongVideo";
import { DynamicTemplate } from "./DynamicTemplate";
import type { DynamicTemplateProps } from "./layers/types";

type InstagramReelProps = {
  watermark?: string;
  title?: string;
  scrollingText?: string;
  videoSrc?: string;
  subtitleContent?: string;
  durationInSeconds?: number;
};

type YouTubeLongVideoProps = {
  videoSrc?: string;
  subtitleContent?: string;
  durationInSeconds?: number;
};

const FPS = 30;

const calculateInstagramMetadata: CalculateMetadataFunction<
  InstagramReelProps
> = ({ props }) => {
  const duration = props.durationInSeconds ?? 15;
  return {
    durationInFrames: Math.ceil(duration * FPS),
  };
};

const calculateYouTubeMetadata: CalculateMetadataFunction<
  YouTubeLongVideoProps
> = ({ props }) => {
  const duration = props.durationInSeconds ?? 60;
  return {
    durationInFrames: Math.ceil(duration * FPS),
  };
};

const calculateDynamicMetadata: CalculateMetadataFunction<
  DynamicTemplateProps
> = ({ props }) => {
  const duration = props.durationInSeconds ?? 15;
  return {
    durationInFrames: Math.ceil(duration * FPS),
  };
};

// Sample VTT for preview in Remotion Studio
const SAMPLE_VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
This is a sample subtitle

00:00:04.500 --> 00:00:08.000
It will be replaced with real content

00:00:08.500 --> 00:00:12.000
When rendered via GitHub Actions`;

// Sample template for preview in Remotion Studio
const SAMPLE_TEMPLATE = JSON.stringify({
  name: "Classic Reel Preview",
  layers: [
    { type: "video", source: "{{videoSrc}}", objectFit: "cover", loop: true },
    { type: "subtitle", source: "{{subtitleContent}}", mode: "classic", fontSize: 44, offsetY: 80 },
    { type: "text", content: "{{watermark}}", fontSize: 36, color: "white", bgColor: "rgba(0,0,0,0.6)", position: "top-right", offsetX: 24, offsetY: 24, borderRadius: 20, padding: 14 },
    { type: "text", content: "{{title}}", fontSize: 52, color: "black", bgColor: "rgba(255,255,255,0.95)", position: "bottom-center", offsetY: 160, duration: 3, borderRadius: 14, padding: 18 },
  ],
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="InstagramReel"
        component={InstagramReel}
        calculateMetadata={calculateInstagramMetadata}
        fps={FPS}
        width={720}
        height={1280}
        defaultProps={{
          watermark: "@yourpage",
          title: "این یک عنوان شش کلمه‌ای است",
          scrollingText: "متن متحرک از چپ به راست",
          videoSrc: "video.mp4",
          subtitleContent: SAMPLE_VTT,
        }}
      />
      <Composition
        id="YouTubeLongVideo"
        component={YouTubeLongVideo}
        calculateMetadata={calculateYouTubeMetadata}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          videoSrc: "video.mp4",
          subtitleContent: SAMPLE_VTT,
        }}
      />
      <Composition
        id="DynamicTemplate"
        component={DynamicTemplate}
        calculateMetadata={calculateDynamicMetadata}
        fps={FPS}
        width={720}
        height={1280}
        defaultProps={{
          templateConfig: SAMPLE_TEMPLATE,
          videoSrc: "video.mp4",
          subtitleContent: SAMPLE_VTT,
          title: "پیش‌نمایش قالب",
          watermark: "@yourpage",
        }}
      />
    </>
  );
};
