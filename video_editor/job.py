"""Isolated job management for parallel video rendering.

Provides ``RenderJob`` — a context manager that creates a unique temporary
directory for each rendering job, preventing file conflicts when multiple
jobs run concurrently.

Directory layout::

    project/
    ├── temps/
    │   └── <job_id>/          ← isolated working directory
    │       ├── text/          ← static text images
    │       ├── marquee/       ← marquee text images
    │       ├── watermark.png  ← watermark image
    │       └── _safe_font.ttf ← FFmpeg-safe font copy
    └── outputs/
        └── <output_name>      ← final rendered video
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional
from uuid import uuid4


class RenderJob:
    """Manages an isolated rendering workspace.

    Usage::

        with RenderJob("final.mp4") as job:
            editor = VideoEditor(config, work_dir=job.work_dir)
            editor.render()
            job.commit()  # move output to outputs/
        # temp directory is automatically cleaned up

    Attributes:
        job_id:     Unique 12-char hex identifier.
        work_dir:   Isolated temporary directory for this job.
        output_dir: Project-level ``outputs/`` directory.
    """

    def __init__(self, output_name: str = "output.mp4") -> None:
        self.job_id = uuid4().hex[:12]
        self._base = Path.cwd()
        self.work_dir: Path = self._base / "temps" / self.job_id
        self.output_dir: Path = self._base / "outputs"
        self.output_name = output_name
        self._final_output: Optional[Path] = None

    # ── Context manager ──────────────────────────────────────────────

    def __enter__(self) -> RenderJob:
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.cleanup()

    # ── Path helpers ─────────────────────────────────────────────────

    @property
    def text_dir(self) -> Path:
        """Directory for static text overlay images."""
        return self.work_dir / "text"

    @property
    def marquee_dir(self) -> Path:
        """Directory for marquee text overlay images."""
        return self.work_dir / "marquee"

    @property
    def watermark_path(self) -> Path:
        """Path for the rendered watermark image."""
        return self.work_dir / "watermark.png"

    @property
    def safe_font_path(self) -> Path:
        """Path for the FFmpeg-safe font copy."""
        return self.work_dir / "_safe_font.ttf"

    @property
    def final_output(self) -> Path:
        """Absolute path where the final video will be placed."""
        if self._final_output is None:
            self._final_output = self.output_dir / self.output_name
        return self._final_output

    # ── Lifecycle ────────────────────────────────────────────────────

    def commit(self) -> Path:
        """Move the rendered video from work_dir to outputs/.

        The video is written directly to ``final_output`` by the renderer,
        so this method simply returns the path. It exists for API
        symmetry and to allow future post-processing hooks.
        """
        if not self.final_output.exists():
            raise FileNotFoundError(
                f"Rendered video not found: {self.final_output}"
            )
        return self.final_output

    def cleanup(self) -> None:
        """Remove the temporary working directory."""
        if self.work_dir.exists():
            shutil.rmtree(self.work_dir, ignore_errors=True)
