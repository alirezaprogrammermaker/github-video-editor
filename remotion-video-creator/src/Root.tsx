import "./index.css";
import { Composition, CalculateMetadataFunction } from "remotion";
import { InstagramReel } from "./InstagramReel";
import { getVideoMetadata } from "@remotion/media";

type InstagramReelProps = {
  watermark?: string;
  title?: string;
  scrollingText?: string;
  videoSrc?: string;
};

const FPS = 30;

const calculateMetadata: CalculateMetadataFunction<InstagramReelProps> = async ({
  props,
}) => {
  const src = props.videoSrc ?? "video.mp4";
  const metadata = await getVideoMetadata(
    src.startsWith("http") ? src : `http://localhost:3000/${src}`
  );
  return {
    durationInFrames: Math.ceil(metadata.durationInSeconds * FPS),
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="InstagramReel"
        component={InstagramReel}
        calculateMetadata={calculateMetadata}
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
    </>
  );
};
