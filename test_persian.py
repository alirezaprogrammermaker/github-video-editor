#!/usr/bin/env python3
"""Self-validating Persian font test.

Renders a PNG with Persian text AND verifies (programmatically) that the
Persian glyphs are actually present. Exits non-zero if the text got
corrupted before reaching the renderer — this is the smoke test that
catches the "??? instead of Persian letters" bug on CI runners.

Usage:
    python test_persian.py [PERSIAN_TEXT]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display

FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONT_PATH = FONT_DIR / "Vazirmatn-Bold.ttf"

# The exact strings used by the workflow defaults — exercising them here
# catches any argv-decoding breakage on the CI runner.
DEFAULT_TEXT = sys.argv[1] if len(sys.argv) > 1 else "۱۲ فرزند"


def main() -> int:
    # ── 1. Diagnostics ───────────────────────────────────────────────
    print("=" * 60)
    print("PERSIAN FONT DIAGNOSTICS")
    print("=" * 60)
    print(f"PYTHONUTF8 env       : {__import__('os').environ.get('PYTHONUTF8', '(unset)')}")
    print(f"filesystem encoding  : {sys.getfilesystemencoding()}")
    print(f"stdout encoding      : {sys.stdout.encoding}")
    print(f"input text           : {DEFAULT_TEXT!r}")
    print(f"input text bytes     : {DEFAULT_TEXT.encode('utf-8')!r}")
    print(f"font exists          : {FONT_PATH.exists()}")

    # ── 2. CRITICAL CHECK: did Persian chars survive arrival? ────────
    # Persian letters live in the Arabic script block: U+0600–U+06FF,
    # plus Arabic Presentation Forms U+FB50–U+FEFF, plus Persian digits.
    persian_range = any(
        ('\u0600' <= ch <= '\u06FF') or
        ('\uFB50' <= ch <= '\uFEFF') or
        ('\u06F0' <= ch <= '\u06F9')  # Persian digits ۰-۹
        for ch in DEFAULT_TEXT
    )
    # If we expected Persian but only see '?' / replacement chars, the text
    # was corrupted (decoded as ascii under a POSIX locale) before it got here.
    corrupted = any(ch in DEFAULT_TEXT for ch in ('?', '\ufffd'))
    print(f"has Persian glyphs   : {persian_range}")
    print(f"text corrupted (??)  : {corrupted}")

    if not persian_range or corrupted:
        print()
        print("FAIL: Persian text did not arrive intact. The non-ASCII bytes")
        print("were decoded as ASCII (POSIX locale) and became '?'.")
        print("Fix: set PYTHONUTF8=1 in the workflow / runner environment.")
        return 1

    # ── 3. Resolve font ──────────────────────────────────────────────
    if FONT_PATH.exists():
        font_file = FONT_PATH
    else:
        win = Path("C:/Windows/Fonts/tahoma.ttf")
        if win.exists():
            font_file = win
        else:
            print("FAIL: No font available for rendering.")
            return 1
    print(f"using font           : {font_file}")

    # ── 4. Shape + render ────────────────────────────────────────────
    font = ImageFont.truetype(str(font_file), 80)
    reshaped = arabic_reshaper.reshape(DEFAULT_TEXT)
    display_text = get_display(reshaped)
    print(f"shaped text          : {display_text!r}")

    bbox = font.getbbox(display_text)
    w, h = bbox[2] - bbox[0] + 40, bbox[3] - bbox[1] + 40
    img = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), display_text, font=font, fill="white")

    out = Path(__file__).resolve().parent / "test_persian_output.png"
    img.save(str(out))
    print(f"saved PNG            : {out} ({w}x{h})")
    print()
    print("OK: Persian text rendered successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
