import { Hono } from 'hono';
import { InstagramVideo, type InstagramVideoRow } from '../db/InstagramVideo';
import { VideoTemplate, type VideoTemplateRow } from '../db/VideoTemplate';
import { ZernioAccount, type ZernioAccountRow } from '../db/ZernioAccount';
import { ZernioSocialAccount } from '../db/ZernioSocialAccount';
import { Setting } from '../db/Setting';
import { requireAuth } from '../middleware';
import { nowTehran } from '../timezone';
import { VideoStatus } from '../constants/video-status';
import type { Bindings, Variables } from '../types';

const videos = new Hono<{ Bindings: Bindings; Variables: Variables }>();

videos.use('*', requireAuth);

// --- Helpers ---

function extractTagFromOutputUrl(outputUrl: string): string | null {
    const match = outputUrl.match(/\/download\/(video-\d+)\//);
    return match ? match[1] : null;
}

async function deleteGitHubRelease(db: D1Database, tag: string): Promise<{ ok: boolean; message: string }> {
    Setting.use(db);
    const repo = await Setting.get('github_repo');
    const token = await Setting.get('github_token');
    const branch = await Setting.get('github_branch') || 'main';

    if (!repo || !token) {
        return { ok: false, message: 'GitHub token یا repo تنظیم نشده است' };
    }

    const url = `https://api.github.com/repos/${repo}/actions/workflows/release-delete.yml/dispatches`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'VideoCreatorWorker',
        },
        body: JSON.stringify({ ref: branch, inputs: { tag_name: tag } }),
    });

    if (res.status === 204) {
        return { ok: true, message: `حذف release ${tag} با موفقیت ارسال شد` };
    } else {
        const errorText = await res.text();
        return { ok: false, message: `GitHub API error ${res.status}: ${errorText.slice(0, 200)}` };
    }
}

// --- Templates ---

videos.get('/templates', async (c) => {
    try {
        VideoTemplate.use(c.env.DB);
        const templates = await VideoTemplate.all<VideoTemplateRow>();
        return c.json(templates.map(t => ({
            ...t,
            fields: VideoTemplate.getFields(t),
        })));
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت قالب‌ها' }, 500);
    }
});

videos.get('/templates/:id', async (c) => {
    try {
        const id = c.req.param('id');
        VideoTemplate.use(c.env.DB);
        const template = await VideoTemplate.find<VideoTemplateRow>(id);
        if (!template) return c.json({ error: 'قالب یافت نشد' }, 404);
        return c.json({
            ...template,
            fields: VideoTemplate.getFields(template),
        });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت قالب' }, 500);
    }
});

// --- Videos ---

videos.get('/', async (c) => {
    try {
        InstagramVideo.use(c.env.DB);
        const allVideos = await InstagramVideo.sorted<InstagramVideoRow>('created_at', 'DESC');
        return c.json(allVideos);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت ویدیوها' }, 500);
    }
});

videos.get('/:shortcode', async (c) => {
    try {
        const shortcode = c.req.param('shortcode');
        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);
        return c.json(video);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت ویدیو' }, 500);
    }
});

videos.put('/:shortcode', async (c) => {
    try {
        const shortcode = c.req.param('shortcode');
        const body = await c.req.json<{
            user_caption?: string;
            text_on_video?: string | null;
            animated_text?: string | null;
            watermark?: string | null;
            status?: string;
            template_id?: string | null;
            template_data?: Record<string, string>;
        }>();

        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);

        // Map template_data fields to video fields
        const staticText = body.template_data?.static_text ?? body.text_on_video ?? null;
        const marqueeText = body.template_data?.marquee_text ?? body.animated_text ?? null;
        const watermarkText = body.template_data?.watermark_text ?? body.watermark ?? null;

        const updates: Record<string, any> = {
            updated_at: nowTehran(),
            user_caption: body.user_caption ?? video.user_caption,
            template_id: body.template_id ?? video.template_id,
            text_on_video: staticText,
            animated_text: marqueeText,
            watermark: watermarkText,
        };

        // Handle status change to building
        if (body.status === VideoStatus.BUILDING && video.status !== VideoStatus.BUILDING) {
            updates.status = VideoStatus.BUILDING;
            updates.build_log = 'در حال ارسال به workflow...';

            // Trigger workflow in background
            c.executionCtx.waitUntil((async () => {
                try {
                    await triggerVideoWorkflow(c.env.DB, video, {
                        static_text: staticText || '',
                        marquee_text: marqueeText || '',
                        watermark_text: watermarkText || '',
                    }, body.template_id ?? video.template_id);
                } catch (e: any) {
                    console.error('[Videos] Workflow trigger error:', e?.message);
                    InstagramVideo.use(c.env.DB);
                    await InstagramVideo.update(video.id, {
                        build_log: `خطا: ${e?.message}`,
                        updated_at: nowTehran(),
                    });
                }
            })());
        } else {
            updates.status = body.status ?? video.status;
        }

        await InstagramVideo.update(video.id, updates);
        console.log(`[Videos] Updated video ${shortcode}:`, updates);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی ویدیو' }, 500);
    }
});

videos.delete('/:shortcode', async (c) => {
    try {
        const shortcode = c.req.param('shortcode');
        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);

        // Delete GitHub release/tag if output_url exists
        let releaseResult: { ok: boolean; message: string } | null = null;
        if (video.output_url) {
            const tag = extractTagFromOutputUrl(video.output_url);
            if (tag) {
                releaseResult = await deleteGitHubRelease(c.env.DB, tag);
            }
        }

        await InstagramVideo.delete(video.id);
        return c.json({
            ok: true,
            release: releaseResult,
        });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در حذف ویدیو' }, 500);
    }
});

// --- Delete GitHub Release/Tag ---

videos.post('/:shortcode/delete-release', async (c) => {
    try {
        const shortcode = c.req.param('shortcode');
        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);
        if (!video.output_url) return c.json({ error: 'این ویدیو release ندارد' }, 400);

        const tag = extractTagFromOutputUrl(video.output_url);
        if (!tag) return c.json({ error: 'تگ ویدیو قابل شناسایی نیست' }, 400);

        const result = await deleteGitHubRelease(c.env.DB, tag);

        // Clear output_url after successful deletion
        if (result.ok) {
            await InstagramVideo.update(video.id, {
                output_url: null,
                updated_at: nowTehran(),
            });
        }

        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در حذف release' }, 500);
    }
});

// --- Publish Now ---

videos.post('/:shortcode/publish', async (c) => {
    try {
        const shortcode = c.req.param('shortcode');
        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);
        if (video.status !== VideoStatus.WAIT_FOR_PUBLISH) {
            return c.json({ error: 'ویدیو آماده انتشار نیست' }, 400);
        }
        if (!video.output_url) {
            return c.json({ error: 'لینک خروجی ویدیو موجود نیست' }, 400);
        }
        if (!video.social_account_id) {
            return c.json({ error: 'حساب اجتماعی ویدیو تنظیم نشده' }, 400);
        }

        ZernioAccount.use(c.env.DB);
        const zernioAccounts = await ZernioAccount.all<ZernioAccountRow>();
        if (zernioAccounts.length === 0) {
            return c.json({ error: 'حساب Zernio تنظیم نشده' }, 400);
        }

        const apiKey = zernioAccounts[0].api_key;
        const accountId = video.social_account_id.replace('sa_', '');

        // Render caption using template
        const rawCaption = video.user_caption || video.original_caption || '';
        ZernioSocialAccount.use(c.env.DB);
        const socialAccount = await ZernioSocialAccount.findByAccountId(video.social_account_id);
        const finalCaption = ZernioSocialAccount.renderCaption(socialAccount?.caption_template ?? null, rawCaption);

        const publishRes = await fetch('https://zernio.com/api/v1/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                content: finalCaption,
                mediaItems: [{ url: video.output_url, type: 'video' }],
                platforms: [
                    { platform: 'instagram', accountId },
                ],
                publishNow: true,
            }),
        });

        const publishData = await publishRes.json() as { success?: boolean; data?: { post?: { id: string } } };

        if (publishData.success && publishData.data?.post?.id) {
            await InstagramVideo.update(video.id, {
                status: VideoStatus.PUBLISHED,
                published_post_id: publishData.data.post.id,
                published_at: nowTehran(),
                updated_at: nowTehran(),
            });
            return c.json({ ok: true, post_id: publishData.data.post.id });
        } else {
            return c.json({ error: 'انتشار ناموفق بود' }, 500);
        }
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در انتشار ویدیو' }, 500);
    }
});

// --- AI Analyze Video ---

videos.post('/:shortcode/analyze', async (c) => {
    try {
        const shortcode = c.req.param('shortcode');
        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);

        Setting.use(c.env.DB);
        const repo = await Setting.get('github_repo');
        const token = await Setting.get('github_token');

        if (!repo || !token) {
            return c.json({ error: 'GitHub settings not configured' }, 400);
        }

        // Trigger analyze-video workflow
        const webhookUrl = `https://video-creator-worker.social-panel.workers.dev/api/callback/analyze`;
        const url = `https://api.github.com/repos/${repo}/actions/workflows/analyze-video.yml/dispatches`;
        const branch = await Setting.get('github_branch') || 'main';

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': 'VideoCreatorWorker',
            },
            body: JSON.stringify({
                ref: branch,
                inputs: {
                    video_url: video.proxied_url,
                    webhook_url: webhookUrl,
                    shortcode: video.shortcode,
                },
            }),
        });

        if (res.status === 204) {
            await InstagramVideo.update(video.id, {
                ai_analysis: 'در حال تحلیل...',
                updated_at: nowTehran(),
            });
            return c.json({ ok: true, message: 'تحلیل ویدیو شروع شد' });
        } else {
            const errorText = await res.text();
            return c.json({ error: `GitHub API error ${res.status}: ${errorText.slice(0, 200)}` }, 500);
        }
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در شروع تحلیل' }, 500);
    }
});

// --- Workflow Trigger ---

async function triggerVideoWorkflow(db: D1Database, video: InstagramVideoRow, templateData: Record<string, string>, templateId?: string | null) {
    Setting.use(db);
    const repo = await Setting.get('github_repo');
    const token = await Setting.get('github_token');
    const workflow = await Setting.get('github_workflow') || 'video-edit.yml';
    const branch = await Setting.get('github_branch') || 'main';

    if (!repo || !token) {
        throw new Error('GitHub token یا repo تنظیم نشده است');
    }

    // Build webhook URL from the worker's own domain
    const webhookUrl = `https://video-creator-worker.social-panel.workers.dev/api/callback/workflow`;

    const inputs: Record<string, string> = {
        video_url: video.proxied_url,
        template: templateId || 'default',
        webhook_url: webhookUrl,
        shortcode: video.shortcode,
    };
    if (templateData.static_text) inputs.static_text = templateData.static_text;
    if (templateData.marquee_text) inputs.marquee_text = templateData.marquee_text;
    if (templateData.watermark_text) inputs.watermark_text = templateData.watermark_text;

    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
    const body = JSON.stringify({ ref: branch, inputs });

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'VideoCreatorWorker',
        },
        body,
    });

    if (res.status === 204) {
        InstagramVideo.use(db);
        await InstagramVideo.update(video.id, {
            build_log: 'Workflow با موفقیت trigger شد',
            updated_at: nowTehran(),
        });
    } else {
        const errorText = await res.text();
        throw new Error(`GitHub API error ${res.status}: ${errorText.slice(0, 200)}`);
    }
}

// --- Check All Building Videos ---

videos.post('/check-all-building', async (c) => {
    try {
        InstagramVideo.use(c.env.DB);
        const buildingVideos = await InstagramVideo.findByStatus(VideoStatus.BUILDING);
        const results = [];

        for (const video of buildingVideos) {
            try {
                // Trigger check for each video
                const checkUrl = `${c.req.url.replace('/check-all-building', '')}/check-workflow/${video.shortcode}`;
                const checkRes = await fetch(checkUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                const checkData = await checkRes.json() as Record<string, any>;
                results.push({ shortcode: video.shortcode, ...checkData });
            } catch (e: any) {
                results.push({ shortcode: video.shortcode, error: e?.message });
            }
        }

        return c.json({ ok: true, checked: results.length, results });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بررسی ویدیوها' }, 500);
    }
});

// --- Check Workflow Status ---

videos.post('/check-workflow/:shortcode', async (c) => {
    try {
        const shortcode = c.req.param('shortcode');
        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);
        if (video.status !== VideoStatus.BUILDING) return c.json({ ok: true, message: 'ویدیو در حال ساخت نیست' });

        Setting.use(c.env.DB);
        const repo = await Setting.get('github_repo');
        const token = await Setting.get('github_token');
        const workflow = await Setting.get('github_workflow') || 'video-edit.yml';

        if (!repo || !token) {
            return c.json({ error: 'GitHub settings not configured' }, 400);
        }

        // Get latest workflow runs
        const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=5`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'VideoCreatorWorker',
            },
        });

        if (!res.ok) {
            return c.json({ error: `GitHub API error ${res.status}` }, 500);
        }

        const data = await res.json() as { workflow_runs?: Array<{ id: number; run_number: number; status: string; conclusion?: string; created_at: string; artifacts_url: string }> };
        const runs = data.workflow_runs || [];

        // Extract trigger time from build_log
        const triggerMatch = video.build_log?.match(/TRIGGERED:(.+)/);
        const triggerTime = triggerMatch ? new Date(triggerMatch[1]).getTime() : 0;

        // Find run created after this video's trigger time
        const matchingRuns = runs.filter(r =>
            new Date(r.created_at).getTime() >= triggerTime
        );

        // Find the latest matching run (completed or in_progress)
        const latestRun = matchingRuns.find(r => r.status === 'completed' || r.status === 'in_progress');

        if (!latestRun) {
            return c.json({ ok: true, status: 'no_runs', message: 'هیچ workflow اجرا نشده' });
        }

        if (latestRun.status === 'in_progress') {
            return c.json({ ok: true, status: 'in_progress', message: 'Workflow هنوز در حال اجراست' });
        }

        if (latestRun.conclusion === 'success') {
            // Get release to find the output video
            const releaseTag = `video-${latestRun.run_number}`;
            const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${releaseTag}`;
            const releaseRes = await fetch(releaseUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'VideoCreatorWorker',
                },
            });

            if (releaseRes.ok) {
                const releaseData = await releaseRes.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
                const assets = releaseData.assets || [];
                const videoAsset = assets.find(a => a.name.endsWith('.mp4') || a.name.includes('output'));

                if (videoAsset) {
                    await InstagramVideo.update(video.id, {
                        status: VideoStatus.WAIT_FOR_PUBLISH,
                        output_url: videoAsset.browser_download_url,
                        build_log: `Workflow completed. Video: ${videoAsset.name}`,
                        updated_at: nowTehran(),
                    });
                    return c.json({ ok: true, status: VideoStatus.WAIT_FOR_PUBLISH, output_url: videoAsset.browser_download_url });
                }
            }

            // If no release found, construct the URL
            const outputUrl = `https://github.com/${repo}/releases/download/video-${latestRun.run_number}/output.mp4`;
            await InstagramVideo.update(video.id, {
                status: VideoStatus.WAIT_FOR_PUBLISH,
                output_url: outputUrl,
                build_log: 'Workflow completed successfully',
                updated_at: nowTehran(),
            });
            return c.json({ ok: true, status: VideoStatus.WAIT_FOR_PUBLISH, output_url: outputUrl });
        }

        // Workflow failed
        await InstagramVideo.update(video.id, {
            status: VideoStatus.FAILED,
            build_log: `Workflow failed: ${latestRun.conclusion}`,
            updated_at: nowTehran(),
        });
        return c.json({ ok: true, status: VideoStatus.FAILED, message: 'Workflow با خطا مواجه شد' });

    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بررسی وضعیت workflow' }, 500);
    }
});

export default videos;
