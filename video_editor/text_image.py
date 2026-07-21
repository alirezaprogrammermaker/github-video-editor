"""Render Persian/Arabic text onto transparent PNG images using Pillow.

This avoids FFmpeg's broken bidirectional text rendering by pre-rendering
the text as a bitmap with proper shaping, then overlaying the image.

Uses arabic-reshaper for correct RTL shaping and python-bidi for
bidirectional text ordering.
"""
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display

_BUNDLED_DIR = Path(__file__).resolve().parent.parent / "fonts"
_DEFAULT_FONT = _BUNDLED_DIR / "Vazirmatn-Bold.ttf"


@dataclass(frozen=True)
class TextImage:
    """A rendered text image with positioning metadata."""
    path: str
    width: int
    height: int


def _is_rtl_char(ch: str) -> bool:
    cp = ord(ch)
    return (
        0x0600 <= cp <= 0x06FF
        or 0x0750 <= cp <= 0x077F
        or 0xFB50 <= cp <= 0xFDFF
        or 0xFE70 <= cp <= 0xFEFF
        or 0x0590 <= cp <= 0x05FF
    )


def _shape_text(text: str) -> str:
    """Reshape Arabic/Persian text into presentation forms."""
    return arabic_reshaper.reshape(text)


class TextImageGenerator:
    """Renders text onto transparent PNG images for video overlay."""

    def __init__(self, font_path: str | Path | None = None,
                 font_size: int = 60,
                 font_color: str = "white",
                 bg_color: str | None = "black@0.95",
                 bg_padding: int = 15,
                 border_width: int = 2,
                 border_color: str = "black",
                 shadow_offset: int = 2,
                 shadow_color: str = "black"):
        self._font_size = font_size
        self._border_width = border_width
        self._shadow_offset = shadow_offset
        self._shadow_color = self._parse_color(shadow_color, 0.5)
        self._bg_padding = bg_padding

        resolved = self._resolve_font(font_path)
        # Use BASIC layout to disable HarfBuzz/RAQM bidi processing.
        # We handle bidi ourselves via python-bidi's get_display(),
        # so Pillow must NOT re-apply it (double processing = reversed text).
        try:
            self._font = ImageFont.truetype(
                str(resolved), font_size,
                layout_engine=ImageFont.Layout.BASIC,
            )
        except (TypeError, AttributeError, OSError):
            self._font = ImageFont.truetype(str(resolved), font_size)
        self._bold_font = self._font

        self._font_color = self._parse_color(font_color)
        self._bg_color = self._parse_color(bg_color) if bg_color else None

    @staticmethod
    def _resolve_font(path):
        if path and Path(path).exists():
            return Path(path)
        if _DEFAULT_FONT.exists():
            return _DEFAULT_FONT
        win = Path("C:/Windows/Fonts/tahoma.ttf")
        if win.exists():
            return win
        from .font import FontManager
        mgr = FontManager()
        downloaded = mgr._ensure_bundled_font()
        if downloaded:
            return downloaded
        raise FileNotFoundError("No font found.")

    _NAMED_COLORS = {
        "white": (255, 255, 255),
        "black": (0, 0, 0),
        "red": (255, 0, 0),
        "green": (0, 128, 0),
        "blue": (0, 0, 255),
        "yellow": (255, 255, 0),
        "cyan": (0, 255, 255),
        "magenta": (255, 0, 255),
        "gray": (128, 128, 128),
        "grey": (128, 128, 128),
        "orange": (255, 165, 0),
        "pink": (255, 192, 203),
        "purple": (128, 0, 128),
    }

    @classmethod
    def _parse_color(cls, color: str, default_alpha: float = 1.0) -> Tuple[int, int, int, int]:
        parts = color.split("@")
        raw = parts[0].lower().strip()
        alpha = float(parts[1]) if len(parts) > 1 else default_alpha

        if raw in cls._NAMED_COLORS:
            r, g, b = cls._NAMED_COLORS[raw]
        else:
            hex_c = raw.lstrip("#")
            if len(hex_c) == 3:
                hex_c = "".join(c * 2 for c in hex_c)
            r = int(hex_c[0:2], 16)
            g = int(hex_c[2:4], 16)
            b = int(hex_c[4:6], 16)

        return (r, g, b, int(alpha * 255))

    def render(self, text: str, output_path: str | Path) -> TextImage:
        """Render text to a transparent PNG and return its metadata."""
        output_path = Path(output_path)

        shaped = _shape_text(text)
        display_text = get_display(shaped)

        bbox = self._font.getbbox(display_text)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        padding = self._bg_padding + self._border_width + self._shadow_offset
        total_w = text_w + 2 * padding
        total_h = text_h + 2 * padding

        # Ensure even dimensions for libx264 compatibility
        total_w = total_w + (total_w % 2)
        total_h = total_h + (total_h % 2)

        img = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Background box
        if self._bg_color:
            draw.rounded_rectangle(
                [0, 0, total_w - 1, total_h - 1],
                radius=8,
                fill=self._bg_color,
            )

        # Shadow
        if self._shadow_offset:
            shadow_x = padding - bbox[0] + self._shadow_offset
            shadow_y = padding - bbox[1] + self._shadow_offset
            draw.text((shadow_x, shadow_y), display_text, font=self._font,
                      fill=self._shadow_color)

        # Main text
        text_x = padding - bbox[0]
        text_y = padding - bbox[1]
        draw.text((text_x, text_y), display_text, font=self._font,
                  fill=self._font_color)

        img.save(str(output_path), "PNG")

        return TextImage(
            path=str(output_path),
            width=total_w,
            height=total_h,
        )

    def render_lines(self, lines: List[str], output_dir: str | Path) -> List[TextImage]:
        """Render multiple lines of text to separate PNG files."""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        images = []
        for i, line in enumerate(lines):
            path = output_dir / f"text_{i}.png"
            images.append(self.render(line, path))
        return images

    def render_combined(self, lines: List[str], output_path: str | Path,
                        video_height: int = 0) -> TextImage:
        """Render multiple lines of text into a single combined PNG.

        Args:
            lines: Text lines to render
            output_path: Output PNG file path
            video_height: Video height in pixels for dynamic spacing calculation.
                         If 0, uses default spacing.
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if len(lines) == 1:
            return self.render(lines[0], output_path)

        # Render each line to get dimensions
        line_images = []
        for line in lines:
            shaped = _shape_text(line)
            display_text = get_display(shaped)
            bbox = self._font.getbbox(display_text)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            padding = self._bg_padding + self._border_width + self._shadow_offset
            line_images.append((display_text, text_w, text_h, padding, bbox))

        # Calculate combined dimensions
        # Account for negative bbox[0] in RTL text (text extends beyond measured width)
        min_bbox_x = min(li[4][0] for li in line_images)  # most negative bbox[0]
        max_bbox_x2 = max(li[4][2] for li in line_images)  # max bbox[2]
        text_span = max_bbox_x2 - min_bbox_x  # actual horizontal span including overshoot
        max_width = text_span + 2 * line_images[0][3]

        # Calculate single line height (text + padding on both sides)
        single_line_height = line_images[0][2] + line_images[0][3] * 2
        num_lines = len(lines)

        # Dynamic line spacing calculation based on video height
        if video_height > 0 and num_lines > 1:
            # Static text is positioned at bottom with ~15% margin from bottom
            # So available height is roughly 15% to 85% of video = 70% of video height
            # But we should be conservative - use only the space above the margin
            available_height = int(video_height * 0.35)  # Conservative: 35% of video height

            # Calculate space needed for all lines (without inter-line spacing)
            min_total_height = single_line_height * num_lines

            # Calculate spacing based on available space
            if min_total_height < available_height:
                # We have room - distribute remaining space evenly
                remaining_space = available_height - min_total_height
                line_spacing = remaining_space // (num_lines - 1)

                # Cap at reasonable limits (20-40% of line height)
                max_reasonable = int(single_line_height * 0.4)
                min_reasonable = int(single_line_height * 0.2)
                line_spacing = max(min_reasonable, min(line_spacing, max_reasonable))
            else:
                # Tight fit - use minimal spacing (20% of line height)
                line_spacing = int(single_line_height * 0.2)
        else:
            # Default spacing for single line or when video_height not provided
            # Use 25% of font size as baseline
            line_spacing = int(self._font_size * 0.25)

        # Calculate total height: sum of text heights + spacing + padding top/bottom
        total_text_height = sum(li[2] for li in line_images)
        total_spacing = line_spacing * (num_lines - 1)
        padding_top_bottom = line_images[0][3] * 2  # padding at top and bottom
        total_height = total_text_height + total_spacing + padding_top_bottom

        # Ensure even dimensions
        max_width = max_width + (max_width % 2)
        total_height = total_height + (total_height % 2)

        img = Image.new("RGBA", (max_width, total_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Background box
        if self._bg_color:
            draw.rounded_rectangle(
                [0, 0, max_width - 1, total_height - 1],
                radius=8,
                fill=self._bg_color,
            )

        # Render each line
        # y_offset tracks the VISIBLE top position of each line
        y_offset = line_images[0][3]  # start with top padding
        for i, (display_text, text_w, text_h, padding, bbox) in enumerate(line_images):
            # Center each line horizontally within max_width
            line_visible_width = bbox[2] - bbox[0]
            text_x = (max_width - line_visible_width) // 2 - bbox[0]
            # Draw at visible position minus bbox offset
            text_y = y_offset - bbox[1]

            # Shadow
            if self._shadow_offset:
                shadow_x = text_x + self._shadow_offset
                shadow_y = text_y + self._shadow_offset
                draw.text((shadow_x, shadow_y), display_text, font=self._font,
                          fill=self._shadow_color)

            # Main text
            draw.text((text_x, text_y), display_text, font=self._font,
                      fill=self._font_color)

            # Advance to next line's visible top
            y_offset += text_h
            if i < len(lines) - 1:
                y_offset += line_spacing

        img.save(str(output_path), "PNG")

        return TextImage(
            path=str(output_path),
            width=max_width,
            height=total_height,
        )

    def cleanup(self, images: List[TextImage]) -> None:
        """Remove temporary image files."""
        for img in images:
            p = Path(img.path)
            if p.exists():
                p.unlink()
