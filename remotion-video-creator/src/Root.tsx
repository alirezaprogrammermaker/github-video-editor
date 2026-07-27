import "./index.css";
import { Composition, CalculateMetadataFunction } from "remotion";
import { InstagramReel } from "./InstagramReel";
import { YouTubeLongVideo } from "./YouTubeLongVideo";

type InstagramReelProps = {
  watermark?: string;
  title?: string;
  scrollingText?: string;
  videoSrc?: string;
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

// Sample VTT for preview in Remotion Studio
const SAMPLE_VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
This is a sample subtitle

00:00:04.500 --> 00:00:08.000
It will be replaced with real content

00:00:08.500 --> 00:00:12.000
When rendered via GitHub Actions`;

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
    </>
  );
};
