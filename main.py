import subprocess
import sys
import os


def run_ffmpeg(input_file, output_file="output.mp4", text="Hello World"):
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)

    cmd = [
        "ffmpeg", "-y",
        "-i", input_file,
        "-vf", f"drawtext=text='{text}':fontsize=50:fontcolor=white:x=20:y=20",
        output_file
    ]

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"Done! Output saved to: {output_file}")
    else:
        print(f"FFmpeg error:\n{result.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <input_video> [output_file] [text]")
        print("Example: python main.py video.mp4 output.mp4 'My Text'")
        sys.exit(1)

    input_video = sys.argv[1]
    output_video = sys.argv[2] if len(sys.argv) > 2 else "output.mp4"
    overlay_text = sys.argv[3] if len(sys.argv) > 3 else "Hello World"

    run_ffmpeg(input_video, output_video, overlay_text)
