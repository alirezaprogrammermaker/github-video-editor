/**
 * Dynamic Template Layer System
 *
 * Templates define a list of layers rendered bottom-to-top.
 * Each layer type has its own renderer component.
 * Dynamic variables like {{videoSrc}} are replaced at render time.
 */

// --- Position system ---
export type PositionAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PositionStyle {
  position?: PositionAnchor;
  offsetX?: number;
  offsetY?: number;
}

// --- Layer base ---
export interface BaseLayer {
  type: string;
  opacity?: number;
  /** Show layer only during this time range (seconds) */
  startTime?: number;
  endTime?: number;
  /** Fade in/out duration in seconds */
  fadeIn?: number;
  fadeOut?: number;
}

// --- Video layer ---
export interface VideoLayerConfig extends BaseLayer {
  type: "video";
  source: string; // {{videoSrc}}
  objectFit?: "cover" | "contain" | "fill";
  loop?: boolean;
  playbackRate?: number;
}

// --- Subtitle modes ---
export type SubtitleMode = "classic" | "karaoke" | "bold-center";

export interface SubtitleLayerConfig extends BaseLayer {
  type: "subtitle";
  source: string; // {{subtitleContent}}
  mode?: SubtitleMode;
  // Style
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  color?: string;
  highlightColor?: string; // for karaoke mode
  bgColor?: string;
  textShadow?: string;
  borderRadius?: number;
  padding?: number;
  maxWidth?: string;
  // Position
  position?: PositionAnchor;
  offsetX?: number;
  offsetY?: number;
}

// --- Text layer ---
export interface TextLayerConfig extends BaseLayer {
  type: "text";
  content: string; // static text or {{variable}}
  // Style
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  color?: string;
  bgColor?: string;
  borderRadius?: number;
  padding?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  whiteSpace?: "normal" | "nowrap" | "pre-wrap";
  maxWidth?: string;
  // Position
  position?: PositionAnchor;
  offsetX?: number;
  offsetY?: number;
  /** Duration in seconds (auto-fades after this) */
  duration?: number;
  // Scroll animation
  scroll?: boolean;
  scrollSpeed?: number; // pixels per second
}

// --- Image layer ---
export interface ImageLayerConfig extends BaseLayer {
  type: "image";
  source: string; // URL or {{variable}}
  width?: number;
  height?: number;
  objectFit?: "cover" | "contain" | "fill";
  // Position
  position?: PositionAnchor;
  offsetX?: number;
  offsetY?: number;
}

// --- Union type ---
export type LayerConfig =
  | VideoLayerConfig
  | SubtitleLayerConfig
  | TextLayerConfig
  | ImageLayerConfig;

// --- Template config ---
export interface TemplateConfig {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
  layers: LayerConfig[];
}

// --- Dynamic props passed to DynamicTemplate ---
export interface DynamicTemplateProps {
  templateConfig: string; // JSON string of TemplateConfig
  videoSrc?: string;
  subtitleContent?: string;
  title?: string;
  watermark?: string;
  scrollingText?: string;
  durationInSeconds?: number;
  /** Extra variables accessible via {{key}} */
  variables?: Record<string, string>;
}
