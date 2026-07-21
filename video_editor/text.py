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
        """Wrap text at word boundaries (spaces) to prevent splitting words."""
        if len(text) <= max_chars:
            return [text]

        # Split text into words (preserving spaces for RTL)
        words = text.split(' ')

        lines: List[str] = []
        current_line = ""

        for word in words:
            # Check if adding this word would exceed the limit
            test_line = current_line + (" " if current_line else "") + word
            if len(test_line) <= max_chars:
                current_line = test_line
            else:
                # If current line is not empty, save it and start new line
                if current_line:
                    lines.append(current_line)
                current_line = word

        if current_line:
            lines.append(current_line)

        return lines
