import { Hono } from 'hono';
import authRoutes from './routes/auth';
import telegramBot from './routes/telegram';
import dashboardRoutes from './routes/dashboard';
import aiRoutes from './routes/ai';
import webhookRoutes from './routes/webhook';
import videoRoutes from './routes/videos';
import { InstagramVideo } from './db/InstagramVideo';
import { ZernioSocialAccount } from './db/ZernioSocialAccount';
import { nowTehran } from './timezone';
import { VideoStatus } from './constants/video-status';
import { handleScheduledEvent } from './cron';
import type { Bindings, Variables } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const LANGUAGE_NAMES: Record<string, string> = {
    fa: 'Persian/Farsi',
    en: 'English',
    ar: 'Arabic',
    tr: 'Turkish',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ru: 'Russian',
    hi: 'Hindi',
    ur: 'Urdu',
};

// --- Analyze Callback (PUBLIC - receives analysis results) ---
app.post('/api/callback/analyze', async (c) => {
    try {
        const body = await c.req.json<{
            shortcode?: string;
            frames?: string[];
            audio?: string;
            audio_duration?: number;
        }>();

        console.log('[App] Analyze callback received:', { shortcode: body.shortcode, framesCount: body.frames?.length, audioDuration: body.audio_duration });

        if (!body.shortcode) {
            return c.json({ error: 'shortcode is required' }, 400);
        }

        InstagramVideo.use(c.env.DB);
        const video = await InstagramVideo.findByShortcode(body.shortcode);
        if (!video) return c.json({ error: 'ویدیو یافت نشد' }, 404);

        // Get social account language
        ZernioSocialAccount.use(c.env.DB);
        const socialAccount = await ZernioSocialAccount.findByAccountId(video.social_account_id);
        const language = socialAccount?.language || 'fa';
        const languageName = LANGUAGE_NAMES[language] || 'Persian/Farsi';

        // Step 1: Transcribe audio with Whisper
        let transcription = '';
        if (body.audio) {
            try {
                const audioBytes = Uint8Array.from(atob(body.audio), ch => ch.charCodeAt(0));
                const whisperResult = await c.env.AI.run('@cf/openai/whisper', {
                    audio: [...audioBytes],
                }) as { text?: string };
                transcription = whisperResult.text || '';
                console.log('[App] Whisper transcription:', transcription.slice(0, 100));
            } catch (e: any) {
                console.error('[App] Whisper error:', e?.message);
            }
        }

        // Step 2: Analyze frames with Vision model
        let frameDescriptions: string[] = [];
        if (body.frames && body.frames.length > 0) {
            for (let i = 0; i < body.frames.length; i++) {
                try {
                    const visionResult = await c.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
                        messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Analyze this video frame in detail. Describe: 1) What is happening 2) Objects and people visible 3) Mood and atmosphere 4) Any text visible. Be concise but specific. Reply in the same language as the video content.' },
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${body.frames[i]}` } },
                            ],
                        }],
                        max_tokens: 200,
                    }) as { response?: string };
                    frameDescriptions.push(`Frame ${i + 1}: ${visionResult.response || 'No description'}`);
                } catch (e: any) {
                    console.error(`[App] Vision error for frame ${i + 1}:`, e?.message);
                    frameDescriptions.push(`Frame ${i + 1}: Analysis failed`);
                }
            }
            console.log('[App] Frame descriptions:', frameDescriptions.length);
        }

        // Step 3: Generate final content
        const analysisContext = `
Video Analysis:
- Transcription: ${transcription || 'No speech detected'}
- Frame descriptions: ${frameDescriptions.join('\n')}
- Audio duration: ${body.audio_duration || 'unknown'} seconds
        `.trim();

        let aiResult = { title: '', caption: '', hashtags: '' };
        try {
            const generateResult = await c.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
                messages: [
                    {
                        role: 'system',
                        content: `You are a social media content creator. Generate ALL content in ${languageName} language.

Based on the video analysis below, generate:
1. TITLE: A catchy title (max 10 words) in ${languageName}
2. CAPTION: An engaging caption (2-3 sentences, include emojis) in ${languageName}
3. HASHTAGS: 10-15 relevant and trending Instagram hashtags in ${languageName}

Format your response exactly like this:
TITLE: [your title]
CAPTION: [your caption]
HASHTAGS: [hashtags separated by spaces]`,
                    },
                    {
                        role: 'user',
                        content: analysisContext,
                    },
                ],
                max_tokens: 500,
            }) as { response?: string };

            // Parse the response
            const response = generateResult.response || '';
            const titleMatch = response.match(/TITLE:\s*(.+)/i);
            const captionMatch = response.match(/CAPTION:\s*(.+)/i);
            const hashtagsMatch = response.match(/HASHTAGS:\s*(.+)/i);

            aiResult = {
                title: titleMatch?.[1]?.trim() || '',
                caption: captionMatch?.[1]?.trim() || '',
                hashtags: hashtagsMatch?.[1]?.trim() || '',
            };
        } catch (e: any) {
            console.error('[App] Generate error:', e?.message);
        }

        // Step 4: Save to database and auto-fill video fields
        await InstagramVideo.updateAiAnalysis(video.id, {
            ai_analysis: analysisContext,
            ai_title: aiResult.title,
            ai_caption: aiResult.caption,
            ai_hashtags: aiResult.hashtags,
        });

        // Auto-fill video fields from AI results
        const watermark = socialAccount?.username ? `@${socialAccount.username}` : null;
        await InstagramVideo.update(video.id, {
            user_caption: aiResult.caption || video.user_caption,
            text_on_video: aiResult.title || video.text_on_video,
            watermark: watermark || video.watermark,
            updated_at: nowTehran(),
        });

        console.log(`[App] Analysis complete for ${body.shortcode}:`, { ...aiResult, language, watermark });

        return c.json({ ok: true, ...aiResult });
    } catch (e: any) {
        console.error('[App] Analyze callback error:', e?.message);
        return c.json({ error: e?.message || 'خطا در پردازش تحلیل' }, 500);
    }
});

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
