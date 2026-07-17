import { Octokit } from "@octokit/rest";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Only handle /api/* routes
    if (!path.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
    const [owner, repo] = env.GITHUB_REPO.split("/");

    // GET /api/status
    if (request.method === "GET" && path === "/api/status") {
      try {
        const { data } = await octokit.rest.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: env.GITHUB_WORKFLOW,
          per_page: 5,
        });

        const runs = data.workflow_runs.map((run) => ({
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          created_at: run.created_at,
          updated_at: run.updated_at,
          html_url: run.html_url,
          run_number: run.run_number,
        }));

        return json({ success: true, runs });
      } catch (error) {
        return json({ success: false, error: error.message }, error.status || 500);
      }
    }

    // GET /api/release
    if (request.method === "GET" && path === "/api/release") {
      try {
        const { data } = await octokit.rest.repos.getLatestRelease({
          owner,
          repo,
        });

        const videoAsset = data.assets.find((a) => a.name.endsWith(".mp4"));

        return json({
          success: true,
          release: {
            tag: data.tag_name,
            name: data.name,
            created_at: data.created_at,
            video_url: videoAsset ? videoAsset.browser_download_url : null,
            video_name: videoAsset ? videoAsset.name : null,
            zip_url: data.zipball_url,
            html_url: data.html_url,
          },
        });
      } catch (error) {
        if (error.status === 404) {
          return json({ success: false, error: "No releases found" }, 404);
        }
        return json({ success: false, error: error.message }, error.status || 500);
      }
    }

    // POST /api/trigger
    if (request.method === "POST" && path === "/api/trigger") {
      try {
        const body = await request.json();

        const {
          video_url,
          static_text = "12 فرزند",
          marquee_text = "برای خرید فالوور لایک ویدیو اینستاگرام به آیدی @insta_shop پیام بدید",
          watermark_text = "@insta_shop",
          output_format = "mp4",
        } = body;

        console.log(`Triggering workflow on ${env.GITHUB_REPO}...`);

        const response = await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: env.GITHUB_WORKFLOW,
          ref: env.GITHUB_BRANCH,
          inputs: {
            ...(video_url && { video_url }),
            static_text,
            marquee_text,
            watermark_text,
            output_format,
          },
        });

        return json({
          success: true,
          message: "Workflow triggered successfully",
          status: response.status,
          repo: env.GITHUB_REPO,
          workflow: env.GITHUB_WORKFLOW,
          branch: env.GITHUB_BRANCH,
          inputs: {
            video_url: video_url || "(bundled video.mp4)",
            static_text,
            marquee_text,
            watermark_text,
            output_format,
          },
          check_url: `https://github.com/${env.GITHUB_REPO}/actions`,
        });
      } catch (error) {
        return json(
          { success: false, error: error.message, documentation_url: error.documentation_url || null },
          error.status || 500
        );
      }
    }

    return json({ error: "Not found" }, 404);
  },
};
