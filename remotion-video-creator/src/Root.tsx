import "./index.css";
import { Composition, CalculateMetadataFunction } from "remotion";
import { InstagramReel } from "./InstagramReel";

type InstagramReelProps = {
  watermark?: string;
  title?: string;
  scrollingText?: string;
  videoSrc?: string;
  durationInSeconds?: number;
};

const FPS = 30;
const DEFAULT_DURATION = 15 * FPS; // 15 seconds default

const calculateMetadata: CalculateMetadataFunction<InstagramReelProps> = ({
  props,
}) => {
  const duration = props.durationInSeconds ?? 15;
  return {
    durationInFrames: Math.ceil(duration * FPS),
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
          durationInSeconds: 15,
        }}
      />
    </>
  );
};
