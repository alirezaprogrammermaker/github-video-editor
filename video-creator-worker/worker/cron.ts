import { InstagramVideo, type InstagramVideoRow } from './db/InstagramVideo';
import { ZernioAccount, type ZernioAccountRow } from './db/ZernioAccount';
import { ZernioSocialAccount } from './db/ZernioSocialAccount';
import { PageAdmin } from './db/PageAdmin';
import { Schedule, type ScheduleRow } from './db/Schedule';
import { Setting } from './db/Setting';
import { nowTehran, tehranTime } from './timezone';
import { VideoStatus } from './constants/video-status';

export async function handleScheduledEvent(
    controller: ScheduledController,
    env: { DB: D1Database },
    ctx: ExecutionContext,
) {
    const { hour, minute, dayOfWeek } = tehranTime();

    console.log(`[Cron] Running at ${nowTehran()} (hour: ${hour}, minute: ${minute}, day: ${dayOfWeek})`);

    // Process ready videos (every minute)
    await processReadyVideos(env.DB);

    // Check building videos (every minute)
    await checkBuildingVideos(env.DB);

    // Check schedule for publishing (every minute)
    await checkScheduleForPublish(env.DB, hour, minute, dayOfWeek);

    // Check Zernio publish status (every minute)
    await checkZernioPublishStatus(env.DB);
}

// --- Process Ready Videos (send to workflow) ---

async function processReadyVideos(db: D1Database) {
    InstagramVideo.use(db);
    const readyVideos = await InstagramVideo.where<InstagramVideoRow>('status', VideoStatus.READY_FOR_CREATE_VIDEO);

    if (readyVideos.length === 0) return;

    console.log(`[Cron] Found ${readyVideos.length} ready video(s) to build`);

    Setting.use(db);
    const repo = await Setting.get('github_repo');
    const token = await Setting.get('github_token');
    const workflow = await Setting.get('github_workflow') || 'video-edit.yml';
    const branch = await Setting.get('github_branch') || 'main';

    if (!repo || !token) {
        console.log('[Cron] GitHub settings not configured');
        return;
    }

    for (const video of readyVideos) {
        try {
            console.log(`[Cron] Processing video: ${video.shortcode}`);

            await InstagramVideo.update(video.id, {
                status: VideoStatus.BUILDING,
                build_log: `TRIGGERED:${new Date().toISOString()}`,
                updated_at: nowTehran(),
            });

            const inputs: Record<string, string> = {
                video_url: video.video_url,
                template: video.template_id || 'default',
                webhook_url: 'https://video-creator-worker.social-panel.workers.dev/api/callback/workflow',
                shortcode: video.shortcode,
            };
            if (video.text_on_video !== null) inputs.static_text = video.text_on_video;
            if (video.animated_text !== null) inputs.marquee_text = video.animated_text;
            if (video.watermark !== null) inputs.watermark_text = video.watermark;

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
                await InstagramVideo.update(video.id, {
                    build_log: `TRIGGERED:${new Date().toISOString()}`,
                    updated_at: nowTehran(),
                });
                console.log(`[Cron] Triggered: ${video.shortcode}`);
            } else {
                const errorText = await res.text();
                throw new Error(`GitHub API ${res.status}: ${errorText.slice(0, 200)}`);
            }
        } catch (e: any) {
            console.error(`[Cron] Error: ${video.shortcode}:`, e?.message);
            await InstagramVideo.update(video.id, {
                build_log: `خطا: ${e?.message}`,
                updated_at: nowTehran(),
            });
        }
    }
}

// --- Check Building Videos ---

async function checkBuildingVideos(db: D1Database) {
    InstagramVideo.use(db);
    const buildingVideos = await InstagramVideo.where<InstagramVideoRow>('status', VideoStatus.BUILDING);

    if (buildingVideos.length === 0) return;

    console.log(`[Cron] Checking ${buildingVideos.length} building video(s)`);

    Setting.use(db);
    const repo = await Setting.get('github_repo');
    const token = await Setting.get('github_token');
    const workflow = await Setting.get('github_workflow') || 'video-edit.yml';

    if (!repo || !token) return;

    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=10`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'VideoCreatorWorker',
        },
    });

    if (!res.ok) return;

    const data = await res.json() as { workflow_runs?: Array<{ run_number: number; status: string; conclusion?: string; created_at: string }> };
    const runs = data.workflow_runs || [];

    // Sort runs oldest first so we match videos to their correct runs in order
    runs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const consumedRunNumbers = new Set<number>();

    for (const video of buildingVideos) {
        try {
            // Extract trigger time from build_log
            const triggerMatch = video.build_log?.match(/TRIGGERED:(.+)/);
            const triggerTime = triggerMatch ? new Date(triggerMatch[1]).getTime() : 0;

            // Find completed run created after this video's trigger time, not yet consumed
            const completedRun = runs.find(r =>
                r.status === 'completed' &&
                r.conclusion &&
                new Date(r.created_at).getTime() >= triggerTime &&
                !consumedRunNumbers.has(r.run_number)
            );

            if (!completedRun) continue;

            consumedRunNumbers.add(completedRun.run_number);

            if (completedRun.conclusion === 'success') {
                const outputUrl = `https://github.com/${repo}/releases/download/video-${completedRun.run_number}/output.mp4`;

                await InstagramVideo.update(video.id, {
                    status: VideoStatus.WAIT_FOR_PUBLISH,
                    output_url: outputUrl,
                    build_log: 'ویدیو آماده انتشار',
                    updated_at: nowTehran(),
                });
                console.log(`[Cron] Ready for publish: ${video.shortcode}`);
            } else if (completedRun.conclusion === 'failure') {
                await InstagramVideo.update(video.id, {
                    status: VideoStatus.FAILED,
                    build_log: `ساخت ناموفق: ${completedRun.conclusion}`,
                    updated_at: nowTehran(),
                });
                console.log(`[Cron] Failed: ${video.shortcode}`);
            }
        } catch (e: any) {
            console.error(`[Cron] Error checking ${video.shortcode}:`, e?.message);
        }
    }
}

// --- Check Schedule for Publishing ---

async function checkScheduleForPublish(db: D1Database, hour: number, minute: number, dayOfWeek: string) {
    Schedule.use(db);
    const allSchedules = await Schedule.all<ScheduleRow>();

    for (const schedule of allSchedules) {
        if (!schedule.is_active) continue;

        const activeDays = Schedule.getActiveDays(schedule);
        if (!activeDays.includes(dayOfWeek)) continue;

        const timeSlots = Schedule.getTimeSlots(schedule);
        const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

        if (!timeSlots.includes(currentTime)) continue;

        console.log(`[Cron] Schedule match for ${schedule.social_account_id} at ${currentTime}`);

        // Find a video ready for publish for this social account
        InstagramVideo.use(db);
        const videos = await InstagramVideo.where<InstagramVideoRow>('social_account_id', schedule.social_account_id);
        const readyVideo = videos.find(v => v.status === VideoStatus.WAIT_FOR_PUBLISH && v.output_url);

        if (!readyVideo) {
            console.log(`[Cron] No ready video for ${schedule.social_account_id}`);
            // Notify admin
            await notifyAdmin(db, schedule.social_account_id, `پست آماده انتشار برای پیج وجود ندارد.`);
            continue;
        }

        // Publish the video
        console.log(`[Cron] Publishing video: ${readyVideo.shortcode}`);

        // Find Zernio API key
        ZernioAccount.use(db);
        const zernioAccounts = await ZernioAccount.all<ZernioAccountRow>();
        if (zernioAccounts.length === 0) {
            console.log(`[Cron] No Zernio account found`);
            continue;
        }

        const apiKey = zernioAccounts[0].api_key;

        // Render caption using template
        const rawCaption = readyVideo.user_caption || readyVideo.original_caption || '';
        ZernioSocialAccount.use(db);
        const socialAccount = await ZernioSocialAccount.findByAccountId(readyVideo.social_account_id);
        const finalCaption = ZernioSocialAccount.renderCaption(socialAccount?.caption_template ?? null, rawCaption);

        // Publish via Zernio
        try {
            const publishRes = await fetch('https://zernio.com/api/v1/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    content: finalCaption,
                    mediaItems: [{ url: readyVideo.output_url, type: 'video' }],
                    platforms: [
                        { platform: 'instagram', accountId: schedule.social_account_id.replace('sa_', '') },
                    ],
                    publishNow: true,
                }),
            });

            const publishData = await publishRes.json() as { success?: boolean; data?: { post?: { id: string } } };

            if (publishData.success && publishData.data?.post?.id) {
                await InstagramVideo.update(readyVideo.id, {
                    status: VideoStatus.PUBLISHED,
                    published_post_id: publishData.data.post.id,
                    published_at: nowTehran(),
                    updated_at: nowTehran(),
                });
                console.log(`[Cron] Published: ${readyVideo.shortcode} -> ${publishData.data.post.id}`);
                await notifyAdmin(db, schedule.social_account_id, `ویدیو ${readyVideo.shortcode} با موفقیت منتشر شد.`);
            } else {
                throw new Error('Publish failed');
            }
        } catch (e: any) {
            console.error(`[Cron] Publish error:`, e?.message);
            await notifyAdmin(db, schedule.social_account_id, `خطا در انتشار ویدیو ${readyVideo.shortcode}: ${e?.message}`);
        }
    }
}

// --- Check Zernio Publish Status ---

async function checkZernioPublishStatus(db: D1Database) {
    InstagramVideo.use(db);
    const pendingVideos = await InstagramVideo.findPublishedWithoutPostId();

    if (pendingVideos.length === 0) return;

    ZernioAccount.use(db);
    const zernioAccounts = await ZernioAccount.all<ZernioAccountRow>();
    if (zernioAccounts.length === 0) return;

    const apiKey = zernioAccounts[0].api_key;

    for (const video of pendingVideos) {
        try {
            // This is a placeholder - in real implementation, you'd check the post status
            // For now, we'll skip this as the publish already sets the post ID
        } catch (e: any) {
            console.error(`[Cron] Error checking post status:`, e?.message);
        }
    }
}

// --- Notify Admin ---

async function notifyAdmin(db: D1Database, socialAccountId: string, message: string) {
    try {
        // Find admin users for this social account
        PageAdmin.use(db);
        const admins = await PageAdmin.findBySocialAccount(socialAccountId);

        if (admins.length === 0) return;

        // Find Zernio API key
        ZernioAccount.use(db);
        const zernioAccounts = await ZernioAccount.all<ZernioAccountRow>();
        if (zernioAccounts.length === 0) return;

        const apiKey = zernioAccounts[0].api_key;

        // Get conversations for this social account
        const socialAccountIdClean = socialAccountId.replace('sa_', '');
        const convRes = await fetch(`https://zernio.com/api/v1/inbox/conversations?accountId=${socialAccountIdClean}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'VideoCreatorWorker',
            },
        });

        if (!convRes.ok) return;

        const convData = await convRes.json() as { conversations?: Array<{ id: string; participantId: string }> };
        const conversations = convData.conversations || [];

        // Send message to each admin
        for (const admin of admins) {
            const conversation = conversations.find(c => c.participantId === admin.user_id);
            if (!conversation) continue;

            await fetch(`https://zernio.com/api/v1/inbox/conversations/${conversation.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'User-Agent': 'VideoCreatorWorker',
                },
                body: JSON.stringify({
                    accountId: socialAccountIdClean,
                    message,
                }),
            });
        }
    } catch (e: any) {
        console.error(`[Cron] Notify error:`, e?.message);
    }
}
