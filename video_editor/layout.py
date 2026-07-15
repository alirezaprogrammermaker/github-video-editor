"""Precise layout calculator for video element positioning.

Handles all coordinate math for overlaying elements on video frames.
Every position is calculated relative to the video canvas (0,0 = top-left).
"""
from dataclasses import dataclass
from typing import Tuple


@dataclass
class ElementBounds:
    """Precise bounding box for an element on the video canvas."""
    x: int
    y: int
    width: int
    height: int

    @property
    def right(self) -> int:
        return self.x + self.width

    @property
    def bottom(self) -> int:
        return self.y + self.height

    @property
    def center_x(self) -> int:
        return self.x + self.width // 2

    @property
    def center_y(self) -> int:
        return self.y + self.height // 2


class LayoutCalculator:
    """Calculates exact pixel positions for video overlays.

    Video coordinate system:
      (0,0) ──────────── (w,0)
        │                  │
        │     VIDEO        │
        │                  │
      (0,h) ──────────── (w,h)
    """

    def __init__(self, video_width: int, video_height: int):
        self.vw = video_width
        self.vh = video_height

    def center_horizontal(self, elem_width: int, elem_height: int,
                          y: int) -> ElementBounds:
        """Center element horizontally at given y position."""
        x = (self.vw - elem_width) // 2
        return ElementBounds(x=x, y=y, width=elem_width, height=elem_height)

    def right_align(self, elem_width: int, elem_height: int,
                    y: int, margin: int = 50) -> ElementBounds:
        """Right-align element with margin from right edge."""
        x = self.vw - elem_width - margin
        return ElementBounds(x=x, y=y, width=elem_width, height=elem_height)

    def left_align(self, elem_width: int, elem_height: int,
                   y: int, margin: int = 50) -> ElementBounds:
        """Left-align element with margin from left edge."""
        return ElementBounds(x=margin, y=y, width=elem_width, height=elem_height)

    def position(self, elem_width: int, elem_height: int,
                 y: int, align: str = "center",
                 margin: int = 50) -> ElementBounds:
        """Position element with specified alignment."""
        if align == "center":
            return self.center_horizontal(elem_width, elem_height, y)
        elif align == "right":
            return self.right_align(elem_width, elem_height, y, margin)
        elif align == "left":
            return self.left_align(elem_width, elem_height, y, margin)
        else:
            raise ValueError(f"Unknown alignment: {align}")

    def vertical_position(self, elem_height: int, position: str,
                          margin_percent: float = 0.12) -> int:
        """Calculate y position for vertical placement.

        Args:
            margin_percent: Distance from edge as percentage of video height.
                          0.12 = 12% from bottom edge.
        """
        margin = int(self.vh * margin_percent)
        if position == "bottom":
            return self.vh - elem_height - margin
        elif position == "top":
            return margin
        elif position == "center":
            return (self.vh - elem_height) // 2
        else:
            raise ValueError(f"Unknown vertical position: {position}")

    def marquee_expression(self, elem_width: int, start_time: float,
                           duration: float, speed: float = 1.0) -> str:
        """Generate FFmpeg expression for marquee animation.

        Text enters from left edge, exits at right edge.
        At t=start_time: x = -elem_width (off-screen left)
        At t=start_time+duration/speed: x = video_width (off-screen right)
        """
        return (
            f"-{elem_width}"
            f"+{speed}*({elem_width}+w)"
            f"*(t-{start_time})"
            f"/({duration})"
        )

    def debug_print(self, name: str, bounds: ElementBounds) -> None:
        """Print position info for debugging."""
        print(f"  {name}: x={bounds.x}, y={bounds.y}, "
              f"w={bounds.width}, h={bounds.height}, "
              f"center_x={bounds.center_x}")
