"""Font discovery, download, and FFmpeg-safe path handling."""
from __future__ import annotations

import shutil
import urllib.request
from pathlib import Path
from typing import Optional

from .exceptions import FontNotFoundError

_BUNDLED_DIR = Path(__file__).resolve().parent.parent / "fonts"
_DEFAULT_FONT = _BUNDLED_DIR / "Vazirmatn-Bold.ttf"
_WINDOWS_FALLBACK = Path("C:/Windows/Fonts/tahoma.ttf")
_SAFE_NAME = "_safe_font.ttf"

_FONT_URL = "https://github.com/rastikerdar/vazirmatn/releases/download/v33.003/Vazirmatn-fonts-ttf-fonts-ttf-v33.003.zip"


class FontManager:
    """Font discovery, download, and FFmpeg-safe path handling."""

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

        # Try to ensure bundled font exists
        downloaded = self._ensure_bundled_font()
        if downloaded:
            return downloaded

        raise FontNotFoundError(
            "No font file found. Place a .ttf in fonts/ or pass --font."
        )

    def _ensure_bundled_font(self) -> Optional[Path]:
        """Download font if not present in the bundle."""
        if _DEFAULT_FONT.exists():
            return _DEFAULT_FONT

        try:
            _BUNDLED_DIR.mkdir(parents=True, exist_ok=True)
            font_path = self._download_font()
            if font_path and font_path.exists():
                return font_path
        except Exception:
            pass
        return None

    def _download_font(self) -> Optional[Path]:
        """Download Vazirmatn font from GitHub releases."""
        import zipfile
        import io
        import tempfile

        try:
            print("Downloading Vazirmatn font...")
            req = urllib.request.Request(
                _FONT_URL,
                headers={"User-Agent": "video-editor/1.0"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                zip_data = resp.read()

            with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
                # Find Vazirmatn-Bold.ttf in the zip
                for name in zf.namelist():
                    if name.endswith("Vazirmatn-Bold.ttf") and "Static" not in name:
                        with zf.open(name) as src, open(_DEFAULT_FONT, "wb") as dst:
                            dst.write(src.read())
                        print(f"Font saved to: {_DEFAULT_FONT}")
                        return _DEFAULT_FONT

            # Fallback: try any .ttf with "Bold" in name
            with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
                for name in zf.namelist():
                    if name.endswith(".ttf") and "Bold" in name:
                        with zf.open(name) as src, open(_DEFAULT_FONT, "wb") as dst:
                            dst.write(src.read())
                        print(f"Font saved to: {_DEFAULT_FONT}")
                        return _DEFAULT_FONT

        except Exception as e:
            print(f"Failed to download font: {e}")
        return None

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
