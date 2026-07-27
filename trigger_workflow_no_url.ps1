$token = $env:GITHUB_TOKEN  # Set this environment variable before running
$repo = "alirezaprogrammermaker/github-video-editor"
$workflow = "video-edit.yml"

$headers = @{
    "Accept" = "application/vnd.github.v3+json"
    "Authorization" = "token $token"
    "Content-Type" = "application/json"
}

$body = @{
    ref = "main"
    inputs = @{
        static_text = "test video"
        marquee_text = "this is scrolling text"
        watermark_text = "@test_page"
        composition = "InstagramReel"
        subtitle_content = ""
        output_format = "mp4"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/workflows/$workflow/dispatches" -Method Post -Headers $headers -Body $body
    Write-Host "Workflow triggered successfully (no URL - using bundled video)!"
} catch {
    Write-Host "Error: $_"
}
