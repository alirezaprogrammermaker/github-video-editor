"""Template system for video generation.

Templates define a reusable video composition pipeline. Each template
specifies which elements to render (static text, marquee, watermark)
and how to compose them.
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List

from .config import TextStyle, WatermarkConfig


@dataclass
class ElementConfig:
    """Base for any visual element in a template."""
    enabled: bool = True


@dataclass
class StaticTextConfig(ElementConfig):
    """Static text shown for a fixed duration at the start."""
    text: str = ""
    start: float = 0.0
    end: float = 2.0
    style: TextStyle = field(default_factory=lambda: TextStyle(
        font_size=60, font_color="white",
        background=True, background_color="black@0.95",
        background_padding=15,
    ))
    position: str = "bottom-center"


@dataclass
class MarqueeConfig(ElementConfig):
    """Scrolling text that enters from left and exits right."""
    text: str = ""
    start: float = 2.0
    speed: float = 1.0
    style: TextStyle = field(default_factory=lambda: TextStyle(
        font_size=50, font_color="white",
        background=True, background_color="red@0.95",
        background_padding=15,
    ))
    position: str = "marquee"


@dataclass
class WatermarkElementConfig(ElementConfig):
    """Watermark overlay (image or text)."""
    config: WatermarkConfig = field(default_factory=lambda: WatermarkConfig(
        text="",
        position="top-right",
        opacity=1.0,
        scale=0.25,
        margin=20,
    ))


class VideoTemplate:
    """Base class for video templates.

    Subclasses define default elements. Users can override any field
    at runtime via the ``apply()`` method.
    """
    name: str = "base"
    description: str = ""

    static_text: Optional[StaticTextConfig] = None
    marquee: Optional[MarqueeConfig] = None
    watermark: Optional[WatermarkElementConfig] = None

    def apply(self, **overrides) -> "VideoTemplate":
        """Return a new template instance with overrides applied."""
        import copy
        t = copy.deepcopy(self)

        if "static_text" in overrides:
            t.static_text = StaticTextConfig(**overrides["static_text"]) if isinstance(overrides["static_text"], dict) else overrides["static_text"]
        if "marquee_text" in overrides and t.marquee:
            t.marquee = copy.deepcopy(t.marquee)
            t.marquee.text = overrides["marquee_text"]
        if "marquee_start" in overrides and t.marquee:
            t.marquee = copy.deepcopy(t.marquee)
            t.marquee.start = overrides["marquee_start"]
        if "watermark_text" in overrides and t.watermark:
            t.watermark = copy.deepcopy(t.watermark)
            t.watermark.config = WatermarkConfig(
                **{**t.watermark.config.__dict__, "text": overrides["watermark_text"]}
            )
        if "watermark_position" in overrides and t.watermark:
            t.watermark = copy.deepcopy(t.watermark)
            t.watermark.config = WatermarkConfig(
                **{**t.watermark.config.__dict__, "position": overrides["watermark_position"]}
            )
        if "watermark_opacity" in overrides and t.watermark:
            t.watermark = copy.deepcopy(t.watermark)
            t.watermark.config = WatermarkConfig(
                **{**t.watermark.config.__dict__, "opacity": overrides["watermark_opacity"]}
            )
        return t

    def build_elements(self) -> List[dict]:
        """Return ordered list of enabled elements for the render pipeline."""
        elements = []
        if self.static_text and self.static_text.enabled and self.static_text.text:
            elements.append({"type": "static_text", "config": self.static_text})
        if self.marquee and self.marquee.enabled and self.marquee.text:
            elements.append({"type": "marquee", "config": self.marquee})
        if self.watermark and self.watermark.enabled:
            elements.append({"type": "watermark", "config": self.watermark})
        return elements


class DefaultTemplate(VideoTemplate):
    """Default template: static text (0-2s) + marquee (2s-end) + watermark."""
    name = "default"
    description = "Static text 0-2s, marquee 2s-end, watermark top-right"

    static_text = StaticTextConfig(position="bottom-center")
    marquee = MarqueeConfig()
    watermark = WatermarkElementConfig()


# Only default template is used
TEMPLATES = {
    "default": DefaultTemplate,
}


def get_template(name: str) -> VideoTemplate:
    """Get a template instance by name."""
    cls = TEMPLATES.get(name)
    if not cls:
        available = ", ".join(TEMPLATES.keys())
        raise ValueError(f"Template '{name}' not found. Available: {available}")
    return cls()
