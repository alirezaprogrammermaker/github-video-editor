import "./index.css";
import { MyComposition } from "./Composition";
import { Composition } from "remotion";
import { InstagramReel } from "./InstagramReel";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="InstagramReel"
        component={InstagramReel}
        durationInFrames={456}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          watermark: "@yourpage",
          title: "این یک عنوان شش کلمه‌ای است شسیب شسیب شسیب شسیب شسیب شسیب",
          scrollingText: "متن متحرک از چپ به راست",
        }}
      />
    </>
  );
};
