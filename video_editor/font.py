"""Font discovery and FFmpeg-safe path handling."""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from .exceptions import FontNotFoundError

_BUNDLED_DIR = Path(__file__).resolve().parent.parent / "fonts"
_DEFAULT_FONT = _BUNDLED_DIR / "Vazirmatn-Bold.ttf"
_WINDOWS_FALLBACK = Path("C:/Windows/Fonts/tahoma.ttf")
_SAFE_NAME = "_safe_font.ttf"


class FontManager:
    """Font discovery and FFmpeg-safe path handling."""

    def __init__(self, work_dir: Optional[Path] = None) -> None:
        self._work_dir = work_dir or Path.cwd()

    def resolve(self, font_path: Optional[Path] = None) -> Path:
        """Find the best available font file."""
        if font_path and font_path.exists():
            return font_path
        if _DEFAULT_FONT.exists():
            return _DEFAULT_FONT
        if _WINDOWS_FALLBACK.exists():
            return _WINDOWS_FALLBACK
        raise FontNotFoundError(
            "No font file found. Place a .ttf in fonts/ or pass --font."
        )

    def prepare_for_filter(self, font_path: Path) -> Path:
        """Copy font to work_dir with a simple name for FFmpeg.

        FFmpeg's drawtext filter uses ``:`` as a key-value separator,
        which clashes with Windows drive letters. Copying to a relative,
        colon-free path sidesteps the issue entirely.
        """
        dst = self._work_dir / _SAFE_NAME
        shutil.copy2(font_path, dst)
        return dst

    def cleanup(self) -> None:
        """Remove the temporary safe-font file."""
        p = self._work_dir / _SAFE_NAME
        p.unlink(missing_ok=True)
