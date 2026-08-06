import { zColor } from "@remotion/zod-types";
import { z } from "zod";

/**
 * Runtime validation for every prop that crosses the process boundary.
 *
 * Props are produced by the GitHub Actions workflow from user-supplied inputs and
 * handed to Remotion as a JSON file, so nothing here can be trusted at compile time.
 * `templateConfigSchema` doubles as the contract handed to the LLM template builder.
 */

/**
 * A file inside `public/`. Rejects separators and traversal so that
 * `staticFile(videoSrc)` cannot escape the public directory.
 */
export const videoSrcSchema = z
  .string()
  .regex(/^[\w.-]+\.mp4$/, "videoSrc must be an .mp4 file inside public/");

export const textDirectionSchema = z.enum(["rtl", "ltr", "auto"]);

export const positionAnchorSchema = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

export const subtitleModeSchema = z.enum(["classic", "karaoke", "bold-center"]);

const objectFitSchema = z.enum(["cover", "contain", "fill"]);

const positionSchema = {
  position: positionAnchorSchema.optional(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
};

const baseLayerSchema = {
  opacity: z.number().min(0).max(1).optional(),
  /** Show layer only during this time range (seconds) */
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(0).optional(),
  /** Fade in/out duration in seconds */
  fadeIn: z.number().min(0).optional(),
  fadeOut: z.number().min(0).optional(),
};

export const videoLayerSchema = z.object({
  ...baseLayerSchema,
  type: z.literal("video"),
  source: z.string(),
  objectFit: objectFitSchema.optional(),
  playbackRate: z.number().positive().optional(),
});

export const subtitleLayerSchema = z.object({
  ...baseLayerSchema,
  ...positionSchema,
  type: z.literal("subtitle"),
  source: z.string(),
  mode: subtitleModeSchema.optional(),
  fontSize: z.number().positive().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  color: zColor().optional(),
  /** for karaoke mode */
  highlightColor: zColor().optional(),
  bgColor: zColor().optional(),
  textShadow: z.string().optional(),
  borderRadius: z.number().min(0).optional(),
  padding: z.number().min(0).optional(),
  maxWidth: z.string().optional(),
  direction: textDirectionSchema.optional(),
});

export const textLayerSchema = z.object({
  ...baseLayerSchema,
  ...positionSchema,
  type: z.literal("text"),
  /** static text or {{variable}} */
  content: z.string(),
  fontSize: z.number().positive().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  color: zColor().optional(),
  bgColor: zColor().optional(),
  borderRadius: z.number().min(0).optional(),
  padding: z.number().min(0).optional(),
  lineHeight: z.number().positive().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  whiteSpace: z.enum(["normal", "nowrap", "pre-wrap"]).optional(),
  maxWidth: z.string().optional(),
  direction: textDirectionSchema.optional(),
  /** Duration in seconds (auto-fades after this) */
  duration: z.number().positive().optional(),
  scroll: z.boolean().optional(),
  /** pixels per second */
  scrollSpeed: z.number().positive().optional(),
});

export const imageLayerSchema = z.object({
  ...baseLayerSchema,
  ...positionSchema,
  type: z.literal("image"),
  /** a file inside public/, or an https:// URL */
  source: z.string(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  objectFit: objectFitSchema.optional(),
});

export const layerConfigSchema = z.discriminatedUnion("type", [
  videoLayerSchema,
  subtitleLayerSchema,
  textLayerSchema,
  imageLayerSchema,
]);

export const templateConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  layers: z.array(layerConfigSchema).min(1),
});

export const instagramReelSchema = z.object({
  watermark: z.string().optional(),
  title: z.string().optional(),
  scrollingText: z.string().optional(),
  videoSrc: videoSrcSchema.optional(),
  subtitleContent: z.string().optional(),
  durationInSeconds: z.number().positive().optional(),
});

export const youTubeLongVideoSchema = z.object({
  videoSrc: videoSrcSchema.optional(),
  subtitleContent: z.string().optional(),
  durationInSeconds: z.number().positive().optional(),
});

export const dynamicTemplateSchema = z.object({
  /** JSON string of a TemplateConfig */
  templateConfig: z.string(),
  videoSrc: videoSrcSchema.optional(),
  subtitleContent: z.string().optional(),
  title: z.string().optional(),
  watermark: z.string().optional(),
  scrollingText: z.string().optional(),
  durationInSeconds: z.number().positive().optional(),
  /** Extra variables accessible via {{key}} */
  variables: z.record(z.string(), z.string()).optional(),
});

export type PositionAnchor = z.infer<typeof positionAnchorSchema>;
export type SubtitleMode = z.infer<typeof subtitleModeSchema>;
export type VideoLayerConfig = z.infer<typeof videoLayerSchema>;
export type SubtitleLayerConfig = z.infer<typeof subtitleLayerSchema>;
export type TextLayerConfig = z.infer<typeof textLayerSchema>;
export type ImageLayerConfig = z.infer<typeof imageLayerSchema>;
export type LayerConfig = z.infer<typeof layerConfigSchema>;
export type TemplateConfig = z.infer<typeof templateConfigSchema>;
export type InstagramReelProps = z.infer<typeof instagramReelSchema>;
export type YouTubeLongVideoProps = z.infer<typeof youTubeLongVideoSchema>;
export type DynamicTemplateProps = z.infer<typeof dynamicTemplateSchema>;
