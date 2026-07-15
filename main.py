"""Video editor CLI — overlay Persian/Arabic text onto video files."""
import argparse
import sys
from pathlib import Path

from video_editor import (
    RenderJob,
    VideoConfig,
    VideoEditor,
    TextStyle,
    VideoEditorError,
)
from video_editor.config import WatermarkConfig
from video_editor.templates import get_template, TEMPLATES
from video_editor.template_renderer import TemplateRenderer


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="video-editor",
        description="Overlay Persian/Arabic text onto video files using FFmpeg.",
    )
    p.add_argument("input_video", nargs="?", help="Path to the input video file")
    p.add_argument("output_video", nargs="?", default="output.mp4",
                   help="Output file name (default: output.mp4)")
    p.add_argument("text", nargs="?", default=None,
                   help="Text to overlay (overrides template text)")

    # Text overrides
    p.add_argument("--static-text", default=None,
                   help="Static text for first phase (0-Ns)")
    p.add_argument("--marquee-text", default=None,
                   help="Marquee text for second phase (Ns-end)")

    # Template
    p.add_argument("--template", default=None,
                   choices=list(TEMPLATES.keys()),
                   help="Use a predefined template")
    p.add_argument("--list-templates", action="store_true",
                   help="List all available templates and exit")

    # Font
    p.add_argument("--font", type=Path, default=None,
                   help="Path to a .ttf font file")

    # Text options
    p.add_argument("--fontsize", type=int, default=None,
                   help="Font size in pixels")
    p.add_argument("--fontcolor", default=None,
                   help="Font color")
    p.add_argument("--position", default=None,
                   choices=["bottom-center", "top-center", "center", "marquee"],
                   help="Text position")
    p.add_argument("--line-spacing", type=int, default=None,
                   help="Line spacing in pixels")
    p.add_argument("--scroll-speed", type=float, default=None,
                   help="Marquee scroll speed multiplier")

    # Background
    p.add_argument("--bg", action="store_true", default=False,
                   help="Enable background box behind text")
    p.add_argument("--bg-color", default=None,
                   help="Background color with opacity")
    p.add_argument("--bg-padding", type=int, default=None,
                   help="Background padding in pixels")

    # Watermark
    wm = p.add_argument_group("watermark options")
    wm.add_argument("--watermark-image", type=Path, default=None,
                    help="Path to watermark image file")
    wm.add_argument("--watermark-text", default=None,
                    help="Text to use as watermark")
    wm.add_argument("--watermark-position", default=None,
                    choices=["top-left", "top-center", "top-right",
                             "center", "bottom-left", "bottom-center", "bottom-right"],
                    help="Watermark position")
    wm.add_argument("--watermark-opacity", type=float, default=None,
                    help="Watermark opacity 0.0-1.0")
    wm.add_argument("--watermark-scale", type=float, default=None,
                    help="Watermark scale relative to video")
    wm.add_argument("--watermark-margin", type=int, default=None,
                    help="Watermark margin from edges")
    return p


def list_templates():
    print("Available templates:\n")
    for name, cls in TEMPLATES.items():
        t = cls()
        elements = []
        if t.static_text:
            elements.append(f"static_text({t.static_text.start}-{t.static_text.end}s)")
        if t.marquee:
            elements.append(f"marquee({t.marquee.start}s-end)")
        if t.watermark:
            elements.append(f"watermark({t.watermark.config.position})")
        print(f"  {name:20s}  {t.description}")
        print(f"  {'':20s}  elements: {', '.join(elements)}")
    print()


def main() -> int:
    args = build_parser().parse_args()

    if args.list_templates:
        list_templates()
        return 0

    with RenderJob(args.output_video) as job:
        try:
            if args.template:
                output = _run_template(args, job)
            else:
                output = _run_direct(args, job)
            job.commit()
            print(f"Done! Output saved to: {output}")
            return 0
        except VideoEditorError as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1


def _run_template(args, job) -> Path:
    """Render using a named template."""
    tpl = get_template(args.template)
    overrides = _build_template_overrides(args, tpl)

    if overrides:
        tpl = tpl.apply(**overrides)

    renderer = TemplateRenderer(
        tpl, Path(args.input_video), job.final_output,
        args.font, work_dir=job.work_dir,
    )
    return renderer.render()


def _run_direct(args, job) -> Path:
    """Render without a template (direct mode)."""
    text = args.text or "سلام دنیا!"
    position = args.position or "bottom-center"
    font_size = args.fontsize or 60
    font_color = args.fontcolor or "white"
    line_spacing = args.line_spacing or 8
    scroll_speed = args.scroll_speed or 1.0
    bg_color = args.bg_color or "black@0.5"
    bg_padding = args.bg_padding or 10

    watermark = None
    if args.watermark_image or args.watermark_text:
        watermark = WatermarkConfig(
            image_path=args.watermark_image,
            text=args.watermark_text,
            position=args.watermark_position or "bottom-right",
            opacity=args.watermark_opacity or 0.5,
            scale=args.watermark_scale or 0.15,
            margin=args.watermark_margin or 20,
        )

    config = VideoConfig(
        input_file=Path(args.input_video),
        output_file=job.final_output,
        text=text,
        font_path=args.font,
        position=position,
        scroll_speed=scroll_speed,
        watermark=watermark,
        style=TextStyle(
            font_size=font_size,
            font_color=font_color,
            line_spacing=line_spacing,
            background=args.bg,
            background_color=bg_color,
            background_padding=bg_padding,
        ),
    )

    return VideoEditor(config, work_dir=job.work_dir).render()


def _build_template_overrides(args, tpl) -> dict:
    """Build override dict from CLI arguments."""
    overrides = {}

    # Static text
    if args.static_text and tpl.static_text:
        overrides["static_text"] = {
            **tpl.static_text.__dict__, "text": args.static_text
        }
    elif args.text and tpl.static_text:
        overrides["static_text"] = {
            **tpl.static_text.__dict__, "text": args.text
        }

    # Marquee text
    if args.marquee_text and tpl.marquee:
        overrides["marquee_text"] = args.marquee_text
    elif args.text and tpl.marquee:
        overrides["marquee_text"] = args.text

    # Watermark overrides
    if tpl.watermark:
        if args.watermark_text:
            overrides["watermark_text"] = args.watermark_text
        if args.watermark_position:
            overrides["watermark_position"] = args.watermark_position
        if args.watermark_opacity:
            overrides["watermark_opacity"] = args.watermark_opacity

    return overrides


if __name__ == "__main__":
    sys.exit(main())
