/**
 * Dynamic Template Layer System
 *
 * Templates define a list of layers rendered bottom-to-top.
 * Each layer type has its own renderer component.
 * Dynamic variables like {{videoSrc}} are replaced at render time.
 *
 * The shapes live in `src/schemas.ts` as zod schemas so that the runtime
 * validation and the compile-time types cannot drift apart; this module only
 * re-exports them for the layer renderers.
 */

export type {
  DynamicTemplateProps,
  ImageLayerConfig,
  LayerConfig,
  PositionAnchor,
  SubtitleLayerConfig,
  SubtitleMode,
  TemplateConfig,
  TextLayerConfig,
  VideoLayerConfig,
} from "../schemas";
