"""FFmpeg/FFprobe discovery and execution."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from .exceptions import FFmpegExecutionError, FFmpegNotFoundError

_SEARCH_PATHS = [
    r"C:\Users\Kratos\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin",
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin"),
    os.path.expandvars(r"%USERPROFILE%\scoop\apps\ffmpeg\current\bin"),
    r"C:\ProgramData\chocolatey\bin",
    "/usr/bin",
]


class FFmpegRunner:
    """Discovers and executes FFmpeg/FFprobe binaries."""

    def __init__(self, cwd: Optional[Path] = None) -> None:
        self._cwd = cwd or Path.cwd()
        self._ffmpeg = self._find("ffmpeg")
        self._ffprobe = self._find("ffprobe")

    @property
    def ffmpeg(self) -> Path:
        return self._ffmpeg

    @property
    def ffprobe(self) -> Path:
        return self._ffprobe

    def _find(self, name: str) -> Path:
        exe = shutil.which(name)
        if exe:
            return Path(exe)

        for base_dir in _SEARCH_PATHS:
            if not base_dir:
                continue
            for suffix in (".exe", ""):
                candidate = Path(base_dir) / f"{name}{suffix}"
                if candidate.is_file():
                    return candidate

        raise FFmpegNotFoundError(
            f"{name} not found. Install it or add it to PATH."
        )

    def get_video_dimensions(self, video_path: Path) -> Tuple[int, int]:
        cmd = [
            str(self._ffprobe), "-v", "quiet",
            "-print_format", "json",
            "-show_streams", str(video_path),
        ]
        result = self.execute(cmd)
        info = json.loads(result.stdout)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                return int(stream["width"]), int(stream["height"])
        raise FFmpegExecutionError("No video stream found in file.")

    def get_video_duration(self, video_path: Path) -> float:
        cmd = [
            str(self._ffprobe), "-v", "quiet",
            "-print_format", "json",
            "-show_format", str(video_path),
        ]
        result = self.execute(cmd)
        info = json.loads(result.stdout)
        duration = info.get("format", {}).get("duration")
        if duration is None:
            raise FFmpegExecutionError("Cannot determine video duration.")
        return float(duration)

    def execute(self, cmd: List[str]) -> subprocess.CompletedProcess:
        """Run a command with cwd set to the job's working directory.

        This ensures FFmpeg can find relative paths (fonts, overlay images)
        that were placed in the job directory.
        """
        result = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8",
            cwd=str(self._cwd),
        )
        if result.returncode != 0:
            raise FFmpegExecutionError(
                f"Command failed with exit code {result.returncode}",
                stderr=result.stderr,
            )
        return result
