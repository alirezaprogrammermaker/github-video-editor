"""Render a video from a VideoTemplate configuration.

Supports multiple phases: static text (0-Ns) + marquee (Ns-end) + watermark.
All intermediate files are written to an isolated work_dir.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from .config import TextStyle, WatermarkConfig
from .editor import VideoEditor
from .ffmpeg import FFmpegRunner
from .font import FontManager
from .layout import LayoutCalculator
from .text import TextRenderer
from .text_image import TextImage, TextImageGenerator
from .templates import (
    MarqueeConfig,
    StaticTextConfig,
    VideoTemplate,
    WatermarkElementConfig,
)
from .watermark import WatermarkRenderer


class TemplateRenderer:
    """Renders video by composing template elements."""

    def __init__(
        self,
        template: VideoTemplate,
        input_video: Path,
        output_video: Path,
        font: Optional[Path] = None,
        work_dir: Optional[Path] = None,
    ) -> None:
        self._template = template
        self._input = input_video.resolve()
        self._output = output_video.resolve()
        self._font = font
        self._work_dir = work_dir or Path.cwd()

    def render(self) -> Path:
        elements = self._template.build_elements()

        if not elements:
            self._copy_input()
            return self._output

        # Separate elements by type
        static_cfg: Optional[StaticTextConfig] = None
        marquee_cfg: Optional[MarqueeConfig] = None
        watermark_cfg: Optional[WatermarkElementConfig] = None

        for elem in elements:
            if elem["type"] == "static_text":
                static_cfg = elem["config"]
            elif elem["type"] == "marquee":
                marquee_cfg = elem["config"]
            elif elem["type"] == "watermark":
                watermark_cfg = elem["config"]

        # Single-phase: marquee only
        if not static_cfg and marquee_cfg:
            return self._render_single(marquee_cfg, watermark_cfg)

        # Single-phase: static only
        if static_cfg and not marquee_cfg:
            return self._render_single_static(static_cfg, watermark_cfg)

        # Multi-phase: static + marquee
        if static_cfg and marquee_cfg:
            return self._render_multi(static_cfg, marquee_cfg, watermark_cfg)

        # Watermark only
        if watermark_cfg:
            return self._render_watermark_only(watermark_cfg)

        self._copy_input()
        return self._output

    # ── Single-phase renderers ───────────────────────────────────────

    def _render_single(
        self,
        cfg: MarqueeConfig,
        watermark_cfg: Optional[WatermarkElementConfig],
    ) -> Path:
        config = self._make_config(
            text=cfg.text,
            position=cfg.position,
            style=cfg.style,
            scroll_speed=cfg.speed,
            watermark_cfg=watermark_cfg,
        )
        return VideoEditor(config, work_dir=self._work_dir).render()

    def _render_single_static(
        self,
        cfg: StaticTextConfig,
        watermark_cfg: Optional[WatermarkElementConfig],
    ) -> Path:
        config = self._make_config(
            text=cfg.text,
            position=cfg.position,
            style=cfg.style,
            watermark_cfg=watermark_cfg,
        )
        return VideoEditor(config, work_dir=self._work_dir).render()

    def _render_watermark_only(
        self, cfg: WatermarkElementConfig
    ) -> Path:
        config = self._make_config(text="", watermark_cfg=cfg)
        return VideoEditor(config, work_dir=self._work_dir).render()

    def _make_config(
        self,
        text: str,
        position: str = "bottom-center",
        style: Optional[TextStyle] = None,
        scroll_speed: float = 1.0,
        watermark_cfg: Optional[WatermarkElementConfig] = None,
    ):
        from .config import VideoConfig
        return VideoConfig(
            input_file=self._input,
            output_file=self._output,
            text=text,
            font_path=self._font,
            position=position,
            scroll_speed=scroll_speed,
            style=style or TextStyle(),
            watermark=watermark_cfg.config if watermark_cfg else None,
        )

    # ── Multi-phase renderer ─────────────────────────────────────────

    def _render_multi(
        self,
        static_cfg: StaticTextConfig,
        marquee_cfg: MarqueeConfig,
        watermark_cfg: Optional[WatermarkElementConfig],
    ) -> Path:
        ffmpeg = FFmpegRunner(cwd=self._work_dir)
        font_mgr = FontManager(work_dir=self._work_dir)
        font_path = font_mgr.resolve(self._font)

        video_w, video_h = ffmpeg.get_video_dimensions(self._input)
        duration = ffmpeg.get_video_duration(self._input)
        layout = LayoutCalculator(video_w, video_h)

        marquee_start = marquee_cfg.start
        marquee_duration = duration - marquee_start

        # Static text image
        static_images, static_y = self._render_phase(
            static_cfg.text, static_cfg.style, video_w, video_h,
            layout, is_marquee=False,
        )

        # Marquee text image
        marquee_images, marquee_y = self._render_phase(
            marquee_cfg.text, marquee_cfg.style, video_w, video_h,
            layout, is_marquee=True,
        )

        # Watermark image
        watermark_img: Optional[TextImage] = None
        wm_renderer: Optional[WatermarkRenderer] = None
        if watermark_cfg and watermark_cfg.config.text:
            wm_renderer = WatermarkRenderer(watermark_cfg.config, font_path)
            watermark_img = wm_renderer.render(
                video_w, video_h, self._work_dir / "_watermark.png"
            )

        try:
            vf = self._build_multi_vf(
                static_images, static_y, static_cfg.style.font_size,
                marquee_images, marquee_y, marquee_cfg.style.font_size,
                video_w, marquee_start, marquee_duration, marquee_cfg.speed,
                watermark_img, video_w, video_h,
            )
            self._run_multi(vf, static_images, marquee_images, watermark_img)
        finally:
            TextImageGenerator().cleanup(static_images)
            TextImageGenerator().cleanup(marquee_images)
            if watermark_img and wm_renderer:
                wm_renderer.cleanup([watermark_img])
            font_mgr.cleanup()

        return self._output

    def _render_phase(
        self,
        text: str,
        style: TextStyle,
        video_w: int,
        video_h: int,
        layout: LayoutCalculator,
        is_marquee: bool,
    ) -> tuple:
        """Render a single text phase and return (images, y_position)."""
        img_gen = TextImageGenerator(
            font_path=self._font_path,
            font_size=style.font_size,
            font_color=style.font_color,
            bg_color=style.background_color if style.background else None,
            bg_padding=style.background_padding,
            border_width=style.border_width,
            shadow_offset=style.shadow_offset,
        )
        tr = TextRenderer(
            font_size=style.font_size,
            line_spacing=style.line_spacing,
        )
        block = tr.prepare(text, video_w, marquee=is_marquee)

        if is_marquee:
            y = block.get_y_positions(video_h, "marquee")[0]
            suffix = "_marquee_imgs"
            images = img_gen.render_lines(block.lines, self._work_dir / suffix)
        else:
            # Use combined rendering for static text (multi-line support)
            combined_path = self._work_dir / "_static_combined.png"
            combined_img = img_gen.render_combined(block.lines, combined_path)
            y = layout.vertical_position(
                combined_img.height, "bottom", margin_percent=0.15
            )
            images = [combined_img]

        return images, y

    def _build_multi_vf(
        self,
        static_imgs: List[TextImage],
        static_y: int,
        static_fontsize: int,
        marquee_imgs: List[TextImage],
        marquee_y: int,
        marquee_fontsize: int,
        video_w: int,
        marquee_start: float,
        marquee_duration: float,
        speed: float,
        watermark_img: Optional[TextImage],
        vw: int,
        vh: int,
    ) -> str:
        parts: List[str] = []
        layout = LayoutCalculator(vw, vh)

        # Static text (0 → marquee_start)
        if static_imgs:
            img = static_imgs[0]
            bounds = layout.position(img.width, img.height, static_y, align="center")
            parts.append(
                f"[0:v][1:v]overlay={bounds.x}:{bounds.y}"
                f":enable='between(t\\,0\\,{marquee_start})'[v1]"
            )
            last = "[v1]"
        else:
            last = "[0:v]"

        # Marquee text (marquee_start → end) — LTR scroll that loops until end.
        # Auto-speed: the text should traverse at least ~3 times in the available
        # window (with one extra pass per 30s), but never faster than 400 px/s or
        # slower than 180 px/s so it stays readable. `speed` (template/CLI) acts
        # as a multiplier on top of this baseline. Longer clips scroll slightly
        # slower (clamped to the floor) and thus show more passes.
        if marquee_imgs:
            img = marquee_imgs[0]
            cycle_pixels = img.width + vw
            marquee_window = max(1.0, marquee_duration)
            target_cycles = 3.0 + marquee_window / 30.0
            needed_pxps = cycle_pixels * target_cycles / marquee_window
            base_pxps = max(180.0, min(400.0, needed_pxps))
            pxps = base_pxps * max(speed, 0.01)
            cycle_duration = max(0.5, cycle_pixels / pxps)
            # local time since marquee started, wrapped into [0, cycle_pixels)
            x_expr = (
                f"-{img.width}+mod({cycle_pixels}*"
                f"(t-{marquee_start})/{cycle_duration}\\,{cycle_pixels})"
            )
            parts.append(
                f"{last}[2:v]overlay={x_expr}:{marquee_y}"
                f":enable='gte(t\\,{marquee_start})'[vm0]"
            )
            last = "[vm0]"

        # Watermark (full duration)
        if watermark_img:
            wm_bounds = layout.position(
                watermark_img.width, watermark_img.height,
                y=layout.vertical_position(watermark_img.height, "top", 0.02),
                align="right", margin=20,
            )
            parts.append(
                f"{last}[3:v]overlay={wm_bounds.x}:{wm_bounds.y}[vout]"
            )
            last = "[vout]"

        if not parts:
            return "null"

        # Ensure final output is labelled [vout]
        if last != "[vout]":
            parts[-1] = parts[-1].replace(last, "[vout]")

        return ";".join(parts)

    def _run_multi(
        self,
        vf: str,
        static_imgs: List[TextImage],
        marquee_imgs: List[TextImage],
        watermark_img: Optional[TextImage],
    ) -> None:
        ffmpeg = FFmpegRunner(cwd=self._work_dir)

        inputs = ["-i", str(self._input)]
        for img in static_imgs:
            inputs.extend(["-i", img.path])
        for img in marquee_imgs:
            inputs.extend(["-i", img.path])
        if watermark_img:
            inputs.extend(["-i", watermark_img.path])

        cmd = [
            str(ffmpeg.ffmpeg), "-y",
            *inputs,
            "-filter_complex", vf,
            "-map", "[vout]",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-c:a", "copy",
            str(self._output),
        ]
        ffmpeg.execute(cmd)

    # ── Helpers ──────────────────────────────────────────────────────

    def _copy_input(self) -> None:
        import shutil
        shutil.copy2(self._input, self._output)

    @property
    def _font_path(self) -> Optional[Path]:
        if self._font and self._font.exists():
            return self._font
        from .font import _DEFAULT_FONT
        return _DEFAULT_FONT if _DEFAULT_FONT.exists() else None
