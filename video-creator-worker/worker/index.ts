import { Hono } from 'hono';
import authRoutes from './routes/auth';
import telegramBot from './routes/telegram';
import dashboardRoutes from './routes/dashboard';
import aiRoutes from './routes/ai';
import webhookRoutes from './routes/webhook';
import videoRoutes from './routes/videos';
import { InstagramVideo } from './db/InstagramVideo';
import { nowTehran } from './timezone';
import { VideoStatus } from './constants/video-status';
import { handleScheduledEvent } from './cron';
import type { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// --- Webhook Callback (PUBLIC - no auth, registered before all routes) ---
app.post('/api/callback/workflow', async (c) => {
    try {
        const body = await c.req.json<{
            shortcode?: string;
            status?: string;
            tag?: string;
            output_url?: string;
            error?: string;
            run_number?: string;
        }>();

        console.log('[App] Workflow callback received:', body);

        if (!body.shortcode) {
            return c.json({ error: 'shortcode is required' }, 400);
        }

        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(body.shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);

        if (body.status === 'success' && body.output_url) {
            await InstagramVideo.update(video.id, {
                status: VideoStatus.WAIT_FOR_PUBLISH,
                output_url: body.output_url,
                build_log: `Build completed via webhook. Tag: ${body.tag}`,
                updated_at: nowTehran(),
            });
            console.log(`[App] Video ${body.shortcode} marked as WAIT_FOR_PUBLISH via webhook`);
        } else if (body.status === 'failure') {
            await InstagramVideo.update(video.id, {
                status: VideoStatus.FAILED,
                build_log: `Build failed via webhook: ${body.error || 'unknown'}`,
                updated_at: nowTehran(),
            });
            console.log(`[App] Video ${body.shortcode} marked as FAILED via webhook`);
        }

        return c.json({ ok: true });
    } catch (e: any) {
        console.error('[App] Callback error:', e?.message);
        return c.json({ error: e?.message || 'خطا در پردازش callback' }, 500);
    }
});

app.route('/api/auth', authRoutes);
app.route('/api/telegram', telegramBot);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/ai', aiRoutes);
app.route('/api/webhook', webhookRoutes);
app.route('/api/videos', videoRoutes);

export default {
    fetch: app.fetch,
    scheduled: handleScheduledEvent,
};
