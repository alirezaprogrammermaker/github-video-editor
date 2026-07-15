"""Watermark generator for video overlay."""
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from .config import WatermarkConfig
from .text_image import TextImage, TextImageGenerator

_BUNDLED_DIR = Path(__file__).resolve().parent.parent / "fonts"
_DEFAULT_FONT = _BUNDLED_DIR / "Vazirmatn-Bold.ttf"


class WatermarkRenderer:
    """Generates watermark images (image-based or text-based)."""

    def __init__(self, config: WatermarkConfig,
                 font_path: Optional[Path] = None):
        self._config = config
        self._font_path = font_path

    def render(self, video_width: int, video_height: int,
               output_path: str | Path) -> TextImage:
        """Render watermark to a PNG file."""
        output_path = Path(output_path)

        if self._config.image_path and Path(self._config.image_path).exists():
            return self._render_image(video_width, video_height, output_path)
        elif self._config.text:
            return self._render_text(video_width, video_height, output_path)
        else:
            raise ValueError("Watermark requires image_path or text.")

    def _render_image(self, vw: int, vh: int, output: Path) -> TextImage:
        """Scale and apply opacity to an image watermark."""
        img = Image.open(self._config.image_path).convert("RGBA")

        max_w = int(vw * self._config.scale)
        max_h = int(vh * self._config.scale)
        img.thumbnail((max_w, max_h), Image.LANCZOS)

        if self._config.opacity < 1.0:
            alpha = img.split()[3]
            alpha = alpha.point(lambda p: int(p * self._config.opacity))
            img.putalpha(alpha)

        # Ensure even dimensions for libx264 compatibility
        w = img.width + (img.width % 2)
        h = img.height + (img.height % 2)
        if w != img.width or h != img.height:
            img = img.resize((w, h), Image.LANCZOS)

        img.save(str(output), "PNG")
        return TextImage(path=str(output), width=w, height=h)

    def _render_text(self, vw: int, vh: int, output: Path) -> TextImage:
        """Render text as watermark with semi-transparency."""
        font_size = max(30, int(vh * 0.04))
        opacity = self._config.opacity
        gen = TextImageGenerator(
            font_path=self._font_path,
            font_size=font_size,
            font_color=f"white@{opacity}",
            bg_color=None,
            border_width=0,
            shadow_offset=0,
        )
        return gen.render(self._config.text, output)

    def get_position(self, img_w: int, img_h: int,
                     vw: int, vh: int) -> Tuple[int, int]:
        """Calculate (x, y) for the watermark based on position string."""
        m = self._config.margin
        pos = self._config.position

        positions = {
            "top-left": (m, m),
            "top-center": ((vw - img_w) // 2, m),
            "top-right": (vw - img_w - m, m),
            "center": ((vw - img_w) // 2, (vh - img_h) // 2),
            "bottom-left": (m, vh - img_h - m),
            "bottom-center": ((vw - img_w) // 2, vh - img_h - m),
            "bottom-right": (vw - img_w - m, vh - img_h - m),
        }
        return positions.get(pos, positions["bottom-right"])

    def cleanup(self, images: list) -> None:
        """Remove temporary watermark files."""
        for img in images:
            p = Path(img.path)
            if p.exists():
                p.unlink()
