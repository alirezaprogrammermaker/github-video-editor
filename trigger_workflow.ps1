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
        video_url = "https://ig-proxy.dknow2296.workers.dev/?url=https%3A%2F%2Fscontent-sea5-1.cdninstagram.com%2Fo1%2Fv%2Ft2%2Ff2%2Fm86%2FAQMC3viBGgU4ec4K7D2t5BYAIfiAtAvCG8fOOxtUDMZTH7iKm-KerRsUw4wipl_SVYcWVJgySDghfSFsqq9bOss6NaD7oBqQT5vQz74.mp4"
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
    Write-Host "Workflow triggered successfully!"
} catch {
    Write-Host "Error: $_"
}
