from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class TextBlock:
    """Processed text ready for per-line rendering."""
    lines: List[str]
    line_height: int
    total_height: int

    def get_y_positions(self, video_height: int, position: str) -> List[int]:
        if position == "bottom-center":
            start_y = video_height - self.total_height - 200
        elif position == "top-center":
            start_y = 50
        elif position == "marquee":
            start_y = video_height - self.total_height - 150
        elif position == "center":
            start_y = (video_height - self.total_height) // 2
        else:
            start_y = (video_height - self.total_height) // 2

        return [start_y + i * self.line_height for i in range(len(self.lines))]


class TextRenderer:
    """Wraps text and computes line positions for Persian/Arabic scripts."""

    def __init__(self, font_size: int = 60, line_spacing: int = 8,
                 horizontal_margin: int = 50):
        self._font_size = font_size
        self._line_spacing = line_spacing
        self._h_margin = horizontal_margin

    def prepare(self, text: str, video_width: int, marquee: bool = False) -> TextBlock:
        if marquee:
            lines = [text]
        else:
            usable_width = video_width - 2 * self._h_margin
            chars_per_line = max(1, int(usable_width / (self._font_size * 0.65)))
            lines = self._wrap(text, chars_per_line)

        line_height = self._font_size + self._line_spacing

        return TextBlock(
            lines=lines,
            line_height=line_height,
            total_height=line_height * len(lines),
        )

    @staticmethod
    def _wrap(text: str, max_chars: int) -> List[str]:
        if len(text) <= max_chars:
            return [text]

        lines: List[str] = []
        current = ""

        for char in text:
            if len(current) + 1 <= max_chars:
                current += char
            else:
                lines.append(current)
                current = char

        if current:
            lines.append(current)

        return lines
