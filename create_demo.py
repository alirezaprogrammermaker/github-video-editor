"""Create demo video: static text for 2s, then marquee text."""
import os
from pathlib import Path
from video_editor.ffmpeg import FFmpegRunner
from video_editor.font import FontManager
from video_editor.text import TextRenderer
from video_editor.config import TextStyle

INPUT = Path("video.mp4")
OUTPUT = Path("demo_output.mp4")

STATIC_TEXT = "یک پدر و دوازده فرزند"
MARQUEE_TEXT = "برای خرید فالوور اینستاگرام به آیا ig_shop پیام بدید"

ffmpeg = FFmpegRunner()
font_mgr = FontManager()
font_path = font_mgr.resolve()
safe_font = font_mgr.prepare_for_filter(font_path)

video_w, video_h = ffmpeg.get_video_dimensions(INPUT)
duration = ffmpeg.get_video_duration(INPUT)

# --- Phase 1: Static text (0-2s) ---
static_style = TextStyle(font_size=60, background=True,
                         background_color="black@0.95", background_padding=15)
static_renderer = TextRenderer(font_size=static_style.font_size,
                               line_spacing=static_style.line_spacing)
static_block = static_renderer.prepare(STATIC_TEXT, video_w)
static_y = static_block.get_y_positions(video_h, "bottom-center")[0]

# --- Phase 2: Marquee text (2s onwards) ---
marquee_speed = 1.0
marquee_duration = duration - 2
marquee_style = TextStyle(font_size=50, background=True,
                          background_color="red@0.95", background_padding=15,
                          font_color="white")
marquee_renderer = TextRenderer(font_size=marquee_style.font_size,
                                line_spacing=marquee_style.line_spacing)
marquee_block = marquee_renderer.prepare(MARQUEE_TEXT, video_w, marquee=True)
marquee_y = marquee_block.get_y_positions(video_h, "bottom-center")[0]

# Write text files in CWD with simple names
with open("_static.txt", "w", encoding="utf-8-sig") as f:
    f.write(static_block.lines[0])
with open("_marquee.txt", "w", encoding="utf-8-sig") as f:
    f.write(marquee_block.lines[0])

try:
    vf = (
        # Phase 1: Static text (0-2s)
        f"drawtext="
        f"fontfile={safe_font.name}"
        f":textfile=_static.txt"
        f":fontsize={static_style.font_size}"
        f":fontcolor={static_style.font_color}"
        f":borderw={static_style.border_width}"
        f":bordercolor={static_style.border_color}"
        f":shadowx={static_style.shadow_offset}"
        f":shadowy={static_style.shadow_offset}"
        f":shadowcolor={static_style.shadow_color}"
        f":x=(w-text_w)/2:y={static_y}"
        f":box=1:boxcolor={static_style.background_color}"
        f":boxborderw={static_style.background_padding}"
        f":enable='between(t\\,0\\,2)'"
        ","
        # Phase 2: Marquee text (2s onwards)
        f"drawtext="
        f"fontfile={safe_font.name}"
        f":textfile=_marquee.txt"
        f":fontsize={marquee_style.font_size}"
        f":fontcolor={marquee_style.font_color}"
        f":borderw={marquee_style.border_width}"
        f":bordercolor={marquee_style.border_color}"
        f":shadowx={marquee_style.shadow_offset}"
        f":shadowy={marquee_style.shadow_offset}"
        f":shadowcolor={marquee_style.shadow_color}"
        f":x=-(text_w)+(text_w+w)*(t-2)/({marquee_duration}-2)"
        f":y={marquee_y}"
        f":box=1:boxcolor={marquee_style.background_color}"
        f":boxborderw={marquee_style.background_padding}"
        f":enable='gte(t\\,2)'"
    )

    cmd = [
        str(ffmpeg.ffmpeg), "-y",
        "-i", str(INPUT),
        "-vf", vf,
        "-c:a", "copy",
        str(OUTPUT),
    ]

    print(f"Video:   {video_w}x{video_h}, {duration:.1f}s")
    print(f"Static:  '{STATIC_TEXT}' (0-2s)")
    print(f"Marquee: '{MARQUEE_TEXT}' (2s-{duration:.0f}s)")
    print("Running FFmpeg...")
    result = ffmpeg.execute(cmd)
    print(f"Done! Output saved to: {OUTPUT}")

finally:
    for f in ["_static.txt", "_marquee.txt"]:
        if os.path.exists(f):
            os.unlink(f)
    font_mgr.cleanup()
