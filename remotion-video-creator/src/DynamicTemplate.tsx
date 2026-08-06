import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  staticFile,
  continueRender,
  delayRender,
  cancelRender,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/fonts";
import type { DynamicTemplateProps, LayerConfig } from "./layers/types";
import { templateConfigSchema } from "./schemas";
import { resolveVariables } from "./layers/positionHelper";
import { VideoLayer } from "./layers/VideoLayer";
import { SubtitleLayer } from "./layers/SubtitleLayer";
import { TextLayer } from "./layers/TextLayer";
import { ImageLayer } from "./layers/ImageLayer";

/**
 * Resolve opacity for a layer based on its time range and fade settings.
 * Layer-specific timing (e.g. text `duration`, subtitle cue fades) stays in the layer.
 */
function resolveLayerOpacity(layer: LayerConfig, currentTime: number): number {
  const start = layer.startTime ?? 0;
  const end = layer.endTime ?? Infinity;
  const fadeIn = layer.fadeIn ?? 0;
  const fadeOut = layer.fadeOut ?? 0;

  if (currentTime < start || currentTime >= end) return 0;

  let opacity = layer.opacity ?? 1;

  if (fadeIn > 0 && currentTime < start + fadeIn) {
    opacity *= interpolate(currentTime, [start, start + fadeIn], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  if (fadeOut > 0 && Number.isFinite(end) && currentTime > end - fadeOut) {
    opacity *= interpolate(currentTime, [end - fadeOut, end], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return opacity;
}

/**
 * Render a single layer based on its type.
 */
const LayerRenderer: React.FC<{
  layer: LayerConfig;
  variables: Record<string, string>;
  currentTime: number;
}> = ({ layer, variables, currentTime }) => {
  const opacity = resolveLayerOpacity(layer, currentTime);
  if (opacity <= 0) return null;

  let content: React.ReactNode = null;

  switch (layer.type) {
    case "video":
      content = (
        <VideoLayer
          config={{
            ...layer,
            source: resolveVariables(layer.source, variables),
          }}
        />
      );
      break;
    case "subtitle":
      content = (
        <SubtitleLayer
          config={{
            ...layer,
            source: resolveVariables(layer.source, variables),
          }}
        />
      );
      break;
    case "text":
      content = (
        <TextLayer
          config={{
            ...layer,
            content: resolveVariables(layer.content, variables),
          }}
        />
      );
      break;
    case "image":
      content = (
        <ImageLayer
          config={{
            ...layer,
            source: resolveVariables(layer.source, variables),
          }}
        />
      );
      break;
    default:
      return null;
  }

  return <div style={{ opacity }}>{content}</div>;
};

/**
 * DynamicTemplate — Remotion composition driven by a JSON template config.
 */
export const DynamicTemplate: React.FC<DynamicTemplateProps> = ({
  templateConfig,
  videoSrc = "video.mp4",
  subtitleContent = "",
  title = "",
  watermark = "",
  scrollingText = "",
  variables = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

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

  const config = useMemo(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(templateConfig);
    } catch (err) {
      return cancelRender(
        new Error(
          `Invalid template config JSON: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }

    const result = templateConfigSchema.safeParse(parsed);
    if (!result.success) {
      return cancelRender(
        new Error(
          `Invalid template config: ${result.error.issues.map((i) => i.message).join("; ")}`,
        ),
      );
    }
    return result.data;
  }, [templateConfig]);

  const allVars: Record<string, string> = {
    videoSrc,
    subtitleContent,
    title,
    watermark,
    scrollingText,
    ...variables,
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      {config.layers.map((layer, index) => (
        <LayerRenderer
          key={index}
          layer={layer}
          variables={allVars}
          currentTime={currentTime}
        />
      ))}
    </AbsoluteFill>
  );
};
