class VideoEditorError(Exception):
    """Base exception for all video editor errors."""
    pass


class FFmpegNotFoundError(VideoEditorError):
    """FFmpeg or ffprobe binary not found."""
    pass


class FontNotFoundError(VideoEditorError):
    """No suitable font file found."""
    pass


class VideoNotFoundError(VideoEditorError):
    """Input video file does not exist."""
    pass


class FFmpegExecutionError(VideoEditorError):
    """FFmpeg command failed during execution."""

    def __init__(self, message: str, stderr: str = ""):
        super().__init__(message)
        self.stderr = stderr
