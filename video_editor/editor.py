"""Core video editor — overlays text and watermark onto video.

Renders text as transparent PNG images via Pillow, then composites
them with FFmpeg. This avoids FFmpeg's broken bidirectional text
rendering for mixed Persian/English text.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from .config import VideoConfig
from .exceptions import VideoNotFoundError
from .ffmpeg import FFmpegRunner
from .font import FontManager
from .text_image import TextImage, TextImageGenerator
from .watermark import WatermarkRenderer


class VideoEditor:
    """Orchestrates text overlay rendering on video files."""

    def __init__(self, config: VideoConfig,
                 work_dir: Optional[Path] = None) -> None:
        self._config = config
        self._work_dir = work_dir or Path.cwd()
        # Resolve paths to absolute so FFmpeg can find them from work_dir
        self._config = VideoConfig(
            input_file=config.input_file.resolve(),
            output_file=config.output_file.resolve(),
            text=config.text,
            font_path=config.font_path,
            style=config.style,
            position=config.position,
            horizontal_margin=config.horizontal_margin,
            scroll_speed=config.scroll_speed,
            watermark=config.watermark,
        )
        self._ffmpeg = FFmpegRunner(cwd=self._work_dir)
        self._font_manager = FontManager(work_dir=self._work_dir)
        self._font_path = self._font_manager.resolve(config.font_path)

    def render(self) -> Path:
        """Render text overlays and watermark onto the input video."""
        if not self._config.input_file.exists():
            raise VideoNotFoundError(
                f"Input file not found: {self._config.input_file}"
            )

        video_w, video_h = self._ffmpeg.get_video_dimensions(
            self._config.input_file
        )

        is_marquee = self._config.position == "marquee"
        duration = None
        if is_marquee:
            duration = self._ffmpeg.get_video_duration(self._config.input_file)

        style = self._config.style
        renderer = FontManager(work_dir=self._work_dir)
        block = self._prepare_text(video_w, is_marquee)
        y_positions = block.get_y_positions(video_h, self._config.position)

        # Render text images
        bg_color = (
            style.background_color if (style.background or is_marquee) else None
        )
        img_gen = TextImageGenerator(
            font_path=self._font_path,
            font_size=style.font_size,
            font_color=style.font_color,
            bg_color=bg_color,
            bg_padding=style.background_padding,
            border_width=style.border_width,
            border_color="black",
            shadow_offset=style.shadow_offset,
            shadow_color="black",
        )
        text_dir = self._work_dir / "_text_imgs"
        images = img_gen.render_lines(block.lines, text_dir)

        # Render watermark
        watermark_img: Optional[TextImage] = None
        wm_renderer: Optional[WatermarkRenderer] = None
        wm_cfg = self._config.watermark
        if wm_cfg and (wm_cfg.image_path or wm_cfg.text):
            wm_renderer = WatermarkRenderer(wm_cfg, self._font_path)
            watermark_img = wm_renderer.render(
                video_w, video_h, self._work_dir / "_watermark.png"
            )

        try:
            vf = self._build_overlay_vf(
                images, y_positions, video_w,
                is_marquee, duration,
                watermark_img, video_w, video_h,
            )
            self._run(vf, images, watermark_img)
        finally:
            img_gen.cleanup(images)
            if watermark_img and wm_renderer:
                wm_renderer.cleanup([watermark_img])
            FontManager(work_dir=self._work_dir).cleanup()

        return self._config.output_file

    def _prepare_text(self, video_w: int, is_marquee: bool):
        from .text import TextRenderer
        style = self._config.style
        tr = TextRenderer(
            font_size=style.font_size,
            line_spacing=style.line_spacing,
            horizontal_margin=self._config.horizontal_margin,
        )
        return tr.prepare(self._config.text, video_w, marquee=is_marquee)

    def _build_overlay_vf(
        self,
        images: List[TextImage],
        y_positions: List[int],
        video_w: int,
        is_marquee: bool,
        duration: float = 0,
        watermark: Optional[TextImage] = None,
        vw: int = 0,
        vh: int = 0,
    ) -> str:
        speed = self._config.scroll_speed
        parts = []

        for i, (img, y_pos) in enumerate(zip(images, y_positions)):
            if is_marquee:
                x_expr = (
                    f"-{img.width}+{speed}*({img.width}+w)*(t-2)/({duration}-2)"
                )
                overlay = f"overlay={x_expr}:{y_pos}:enable='gte(t,2)'"
            else:
                x_expr = f"(w-{img.width})/2"
                overlay = f"overlay={x_expr}:{y_pos}"
            parts.append(overlay)

        # Watermark overlay
        if watermark and self._config.watermark:
            wm_renderer = WatermarkRenderer(self._config.watermark)
            wm_x, wm_y = wm_renderer.get_position(
                watermark.width, watermark.height, vw, vh
            )
            parts.append(f"overlay={wm_x}:{wm_y}")

        return ",".join(parts)

    def _run(
        self,
        vf: str,
        images: List[TextImage],
        watermark_img: Optional[TextImage] = None,
    ) -> None:
        inputs = ["-i", str(self._config.input_file)]
        for img in images:
            inputs.extend(["-i", img.path])
        if watermark_img:
            inputs.extend(["-i", watermark_img.path])

        cmd = [
            str(self._ffmpeg.ffmpeg), "-y",
            *inputs,
            "-filter_complex", vf,
            "-c:a", "copy",
            str(self._config.output_file),
        ]
        self._ffmpeg.execute(cmd)
