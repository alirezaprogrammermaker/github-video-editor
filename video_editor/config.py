from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class TextStyle:
    """Text visual styling configuration."""
    font_size: int = 60
    font_color: str = "white"
    border_width: int = 2
    border_color: str = "black@0.8"
    shadow_offset: int = 2
    shadow_color: str = "black@0.5"
    line_spacing: int = 12
    background: bool = False
    background_color: str = "black@0.85"
    background_padding: int = 10


@dataclass(frozen=True)
class WatermarkConfig:
    """Watermark overlay configuration."""
    image_path: Optional[Path] = None
    text: Optional[str] = None
    position: str = "bottom-right"
    opacity: float = 0.5
    scale: float = 0.15
    margin: int = 20


@dataclass(frozen=True)
class VideoConfig:
    """Complete video editing configuration."""
    input_file: Path
    output_file: Path = Path("output.mp4")
    text: str = "سلام دنیا!"
    font_path: Optional[Path] = None
    style: TextStyle = field(default_factory=TextStyle)
    position: str = "bottom-center"
    horizontal_margin: int = 50
    scroll_speed: float = 1.0
    watermark: Optional[WatermarkConfig] = None
