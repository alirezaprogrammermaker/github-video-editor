import { Hono } from 'hono';
import { ZernioAccount, type ZernioAccountRow } from '../db/ZernioAccount';
import { ZernioSocialAccount, type ZernioSocialAccountRow } from '../db/ZernioSocialAccount';
import { PageAdmin } from '../db/PageAdmin';
import { InstagramDmSession } from '../db/InstagramDmSession';
import { InstagramVideo } from '../db/InstagramVideo';
import { nowTehran } from '../timezone';
import type { Bindings, Variables } from '../types';

const IG_API_BASE = 'https://ig-admin.dknow2296.workers.dev/api/raw';
const IG_PROXY_BASE = 'https://ig-proxy.dknow2296.workers.dev/?url=';

const webhook = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const webhookLogs: Array<{ id: string; event: string; payload: any; received_at: string }> = [];
const MAX_LOGS = 100;

function addLog(event: string, payload: any) {
    webhookLogs.unshift({
        id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        event,
        payload,
        received_at: nowTehran(),
    });
    if (webhookLogs.length > MAX_LOGS) webhookLogs.length = MAX_LOGS;
}

async function sendReplyWithUrlButton(apiKey: string, conversationId: string, accountId: string, message: string, buttonTitle: string, buttonUrl: string) {
    await sendTypingIndicator(apiKey, conversationId, accountId);
    try {
        const body: any = {
            accountId,
            message,
            buttons: [{
                type: 'url',
                title: buttonTitle,
                url: buttonUrl,
            }],
        };

        console.log(`[Zernio Webhook] Sending reply with button to conversation ${conversationId}`);
        const res = await fetch(`https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        const data = await res.text();
        console.log(`[Zernio Webhook] Send reply result:`, res.status, data.slice(0, 300));
        return { ok: res.ok, status: res.status, data };
    } catch (e: any) {
        console.error(`[Zernio Webhook] Send reply error:`, e?.message);
        return { ok: false, error: e?.message };
    }
}

async function sendTypingIndicator(apiKey: string, conversationId: string, accountId: string) {
    try {
        await fetch(`https://zernio.com/api/v1/inbox/conversations/${conversationId}/typing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ accountId }),
        });
    } catch {}
}

async function sendReply(apiKey: string, conversationId: string, accountId: string, message: string) {
    await sendTypingIndicator(apiKey, conversationId, accountId);
    try {
        const res = await fetch(`https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ accountId, message }),
        });
        const data = await res.text();
        console.log(`[Zernio Webhook] Send reply result:`, res.status, data.slice(0, 300));
        return { ok: res.ok, status: res.status, data };
    } catch (e: any) {
        console.error(`[Zernio Webhook] Send reply error:`, e?.message);
        return { ok: false, error: e?.message };
    }
}

async function getAdminMenuText() {
    return `به پنل مدیریت خوش آمدید! 👋\n\n` +
        `👤 پروفایل: /profile\n` +
        `📊 آمار: /stats\n` +
        `⚙️ تنظیمات: /settings\n` +
        `📝 پست جدید: /newpost\n` +
        `🔄 ریلز: ریلز را share کنید`;
}

function detectSharedPost(message: any): { isShare: boolean; isReel: boolean; link?: string } {
    const text = message?.text || '';
    const attachments = message?.attachments || [];

    // Check for reel attachment (Zernio format)
    const reelAttachment = attachments.find((a: any) =>
        a.originalType === 'ig_reel' ||
        a.type === 'ig_reel' ||
        (a.type === 'video' && a.url?.includes('/reel/'))
    );

    if (reelAttachment) {
        const link = reelAttachment.url || reelAttachment.payload?.url;
        return { isShare: true, isReel: true, link };
    }

    // Check for regular post attachment
    const postAttachment = attachments.find((a: any) =>
        a.originalType === 'ig_post' ||
        a.type === 'post_share' ||
        (a.url?.includes('/p/'))
    );

    if (postAttachment) {
        const link = postAttachment.url || postAttachment.payload?.url;
        return { isShare: true, isReel: false, link };
    }

    // Check for reel link in text
    const reelLinkMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/reels?\/([A-Za-z0-9_-]+)/i);
    if (reelLinkMatch) {
        return { isShare: true, isReel: true, link: reelLinkMatch[0] };
    }

    // Check for post link in text
    const postLinkMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/p\/([A-Za-z0-9_-]+)/i);
    if (postLinkMatch) {
        return { isShare: true, isReel: false, link: postLinkMatch[0] };
    }

    return { isShare: false, isReel: false };
}

async function findSocialAccountByZernioAccountId(db: D1Database, zernioAccountId: string): Promise<ZernioSocialAccountRow | null> {
    ZernioSocialAccount.use(db);
    const result = await db
        .prepare(`SELECT * FROM zernio_social_accounts WHERE account_id = ?`)
        .bind(zernioAccountId)
        .first();
    return (result as unknown as ZernioSocialAccountRow) || null;
}

async function isAdmin(db: D1Database, socialAccountId: string, userId: string): Promise<boolean> {
    PageAdmin.use(db);
    const admin = await PageAdmin.findBySocialAccountAndUser(socialAccountId, userId);
    return !!admin;
}

webhook.post('/zernio', async (c) => {
    try {
        const body = await c.req.json();
        const event = c.req.header('x-zernio-event') || body.event || 'unknown';

        console.log(`[Zernio Webhook] Event: ${event}`, JSON.stringify(body).slice(0, 500));

        addLog(event, body);

        const data = body.data || body.account || body.post || body.message || body;

        // --- Account events ---
        if (event === 'account.connected' || event === 'account.updated') {
            const account = data;
            const accountId = account?._id || account?.id;
            if (accountId) {
                ZernioSocialAccount.use(c.env.DB);
                await ZernioSocialAccount.upsertSocialAccount({
                    account_id: accountId,
                    platform: account.platform,
                    username: account.username,
                    display_name: account.displayName || account.display_name,
                    profile_image: account.profilePicture || account.profile_image,
                    status: account.isActive !== false ? 'active' : 'inactive',
                    raw_data: JSON.stringify(body),
                });

                PageAdmin.use(c.env.DB);
                await PageAdmin.upsertAdmin({
                    social_account_id: `sa_${accountId}`,
                    user_id: accountId,
                    username: account.username,
                    display_name: account.displayName || account.display_name,
                    role: 'owner',
                    added_by: 'system',
                });
            }
        }

        if (event === 'account.disconnected') {
            const account = data;
            const accountId = account?._id || account?.id;
            if (accountId) {
                ZernioSocialAccount.use(c.env.DB);
                const id = `sa_${accountId}`;
                await ZernioSocialAccount.update(id, {
                    status: 'disconnected',
                    updated_at: new Date().toISOString(),
                });
            }
        }

        // --- Message received ---
        if (event === 'message.received') {
            const message = body.message;
            const account = body.account;
            const conversation = body.conversation;

            if (message?.direction === 'incoming' && account?.id) {
                console.log(`[Zernio Webhook] Incoming message from ${message.sender?.username}: ${message.text}`);

                c.executionCtx.waitUntil((async () => {
                    try {
                        const socialAccount = await findSocialAccountByZernioAccountId(c.env.DB, account.id);
                        const socialAccountId = `sa_${account.id}`;

                        // Check if message is the admin key
                        if (socialAccount?.admin_key && message.text?.trim() === socialAccount.admin_key) {
                            PageAdmin.use(c.env.DB);
                            await PageAdmin.upsertAdmin({
                                social_account_id: socialAccountId,
                                user_id: message.sender.id,
                                username: message.sender.username,
                                display_name: message.sender.name,
                                role: 'admin',
                                added_by: 'admin_key',
                            });
                            console.log(`[Zernio Webhook] User ${message.sender.username} added as admin via admin key`);

                            ZernioAccount.use(c.env.DB);
                            const zernioAccounts = await ZernioAccount.all<ZernioAccountRow>();
                            if (zernioAccounts.length > 0 && conversation?.id) {
                                await sendReply(zernioAccounts[0].api_key, conversation.id, account.id, `شما با موفقیت به عنوان ادمین اضافه شدید! ✅`);
                            }
                            return;
                        }

                        // Find API key
                        ZernioAccount.use(c.env.DB);
                        const zernioAccounts = await ZernioAccount.all<ZernioAccountRow>();
                        console.log(`[Zernio Webhook] Found ${zernioAccounts.length} zernio accounts`);

                        let apiKey = '';
                        if (zernioAccounts.length > 0) {
                            apiKey = zernioAccounts[0].api_key;
                        }

                        if (!apiKey || !conversation?.id || !account?.id) {
                            console.log(`[Zernio Webhook] No API key or conversation/account ID:`, { hasApiKey: !!apiKey, conversationId: conversation?.id, accountId: account?.id });
                            return;
                        }
                        console.log(`[Zernio Webhook] Using API key:`, apiKey.slice(0, 10) + '...');

                        // Check if user is admin
                        const userIsAdmin = await isAdmin(c.env.DB, socialAccountId, message.sender.id);

                        // Create or get DM session
                        InstagramDmSession.use(c.env.DB);
                        const session = await InstagramDmSession.findOrCreate({
                            social_account_id: socialAccountId,
                            user_id: message.sender.id,
                            username: message.sender.username,
                            display_name: message.sender.name,
                        });

                        // FIRST: Check for shared posts (reel/post) - applies to ALL users
                        const sharedPost = detectSharedPost(message);
                        console.log(`[Zernio Webhook] Shared post check:`, sharedPost);
                        if (sharedPost.isShare) {
                            if (sharedPost.isReel && sharedPost.link) {
                                // Extract shortcode from URL
                                const shortcodeMatch = sharedPost.link.match(/\/reel\/([A-Za-z0-9_-]+)/i);
                                const shortcode = shortcodeMatch?.[1];
                                console.log(`[Zernio Webhook] Extracted shortcode:`, shortcode);

                                if (!shortcode) {
                                    console.log(`[Zernio Webhook] Failed to extract shortcode from:`, sharedPost.link);
                                    await sendReply(apiKey, conversation.id, account.id, `خطا: شناسه ریلز استخراج نشد.`);
                                    return;
                                }

                                // Check if video already exists
                                InstagramVideo.use(c.env.DB);
                                const existingVideo = await InstagramVideo.findByShortcode(shortcode);
                                console.log(`[Zernio Webhook] Existing video check:`, !!existingVideo);
                                if (existingVideo) {
                                    await sendReply(apiKey, conversation.id, account.id, `این ریلز قبلاً ذخیره شده است.`);
                                    return;
                                }

                                // Fetch post data from API
                                const apiUrl = `${IG_API_BASE}?action=post&shortcode=${shortcode}`;
                                console.log(`[Zernio Webhook] Fetching API:`, apiUrl);
                                const apiRes = await fetch(apiUrl);
                                const apiData = await apiRes.json() as { success: boolean; data?: any };
                                console.log(`[Zernio Webhook] API response success:`, apiData.success);

                                if (!apiData.success || !apiData.data) {
                                    console.log(`[Zernio Webhook] API failed:`, JSON.stringify(apiData).slice(0, 200));
                                    await sendReply(apiKey, conversation.id, account.id, `خطا در دریافت اطلاعات ریلز.`);
                                    return;
                                }

                                const postData = apiData.data;
                                const videoUrl = postData.video_versions?.[0]?.url;
                                const caption = postData.caption?.text || '';
                                const proxiedUrl = `${IG_PROXY_BASE}${encodeURIComponent(videoUrl)}`;

                                if (!videoUrl) {
                                    await sendReply(apiKey, conversation.id, account.id, `خطا: لینک ویدیو یافت نشد.`);
                                    return;
                                }

                                // Save video to database
                                await InstagramVideo.createVideo({
                                    social_account_id: socialAccountId,
                                    shortcode,
                                    video_url: videoUrl,
                                    proxied_url: proxiedUrl,
                                    original_caption: caption,
                                    raw_data: JSON.stringify(postData),
                                });

                                // Send confirmation with edit link as button
                                const editUrl = `https://video-creator-worker.social-panel.workers.dev/videos/edit/${shortcode}`;
                                const captionPreview = caption ? caption.slice(0, 100) + (caption.length > 100 ? '...' : '') : 'بدون کپشن';

                                await sendReplyWithUrlButton(apiKey, conversation.id, account.id,
                                    `✅ ریلز با موفقیت ذخیره شد!\n\nکپشن: ${captionPreview}`,
                                    'ویرایش پست',
                                    editUrl
                                );

                            } else {
                                await sendReply(apiKey, conversation.id, account.id, `پست شما دریافت شد.\n\nفعلاً فقط از ریلز اینستاگرام پشتیبانی می‌کنیم. 🎬\nلطفاً ریلز مورد نظرتان را ارسال کنید.`);
                            }
                            return;
                        }

                        // SECOND: Handle admin menu commands
                        if (userIsAdmin) {
                            // Admin menu handling - check quick reply payload first
                            // metadata is at root level of request body, not inside message
                            const payload = body.metadata?.quickReplyPayload || body.metadata?.postbackPayload || body.metadata?.callbackData || message.text?.trim();

                            if (payload === 'admin_profile' || payload === '/profile') {
                                const profileText = `👤 اطلاعات پروفایل شما:\n\n` +
                                    `نام: ${message.sender.name || 'نامشخص'}\n` +
                                    `نام کاربری: @${message.sender.username || 'نامشخص'}\n` +
                                    `شناسه: ${message.sender.id}\n` +
                                    `پیج: @${account.username}\n` +
                                    `نقش: ادمین`;

                                await sendReply(apiKey, conversation.id, account.id, profileText);

                            } else if (payload === 'admin_stats') {
                                await sendReply(apiKey, conversation.id, account.id, `📊 آمار پیج به زودی فعال می‌شود...`);

                            } else if (payload === 'admin_settings') {
                                await sendReply(apiKey, conversation.id, account.id, `⚙️ تنظیمات به زودی فعال می‌شود...`);

                            } else if (payload === 'admin_new_post' || payload === '/newpost') {
                                await InstagramDmSession.updateStep(session.id, 'waiting_post_content');
                                await sendReply(apiKey, conversation.id, account.id, `📝 متن پست را ارسال کنید:\n\nبرای لغو /cancel را بفرستید.`);

                            } else if (payload === '/cancel' || payload === 'cancel') {
                                await InstagramDmSession.resetStep(session.id);
                                await sendReply(apiKey, conversation.id, account.id, `عملیات لغو شد.`);

                            } else if (payload === '/menu') {
                                const replyText = `به پنل مدیریت خوش آمدید! 👋\n\n` +
                                    `👤 پروفایل: /profile\n` +
                                    `📊 آمار: /stats\n` +
                                    `⚙️ تنظیمات: /settings\n` +
                                    `📝 پست جدید: /newpost\n` +
                                    `🔄 ریلز: ریلز را share کنید`;
                                await sendReply(apiKey, conversation.id, account.id, replyText);

                            } else if (session.step === 'waiting_post_content') {
                                // Handle post content
                                await InstagramDmSession.updateStep(session.id, 'idle', { postContent: message.text });
                                await sendReply(apiKey, conversation.id, account.id, `✅ متن پست ذخیره شد:\n\n"${message.text}"\n\nبه زودی قابلیت انتشار فعال می‌شود.`);

                            } else {
                                // Unknown command - show menu
                                const replyText = `به پنل مدیریت خوش آمدید! 👋\n\n` +
                                    `👤 پروفایل: /profile\n` +
                                    `📊 آمار: /stats\n` +
                                    `⚙️ تنظیمات: /settings\n` +
                                    `📝 پست جدید: /newpost\n` +
                                    `🔄 ریلز: ریلز را share کنید`;
                                await sendReply(apiKey, conversation.id, account.id, replyText);
                            }

                        } else {
                            // Regular user - simple reply
                            await sendReply(apiKey, conversation.id, account.id, `پیام شما دریافت شد. ممنون از تماس شما! 🙏`);
                        }

                        addLog('reply.sent', {
                            conversationId: conversation.id,
                            accountId: account.id,
                            to: message.sender?.username,
                            isAdmin: userIsAdmin,
                        });
                    } catch (e: any) {
                        console.error(`[Zernio Webhook] Background reply error:`, e?.message);
                    }
                })());
            }
        }

        return c.json({ ok: true, event, received: true });
    } catch (e: any) {
        console.error('[Zernio Webhook] Error:', e?.message);
        return c.json({ ok: true, error: e?.message });
    }
});

webhook.get('/zernio/logs', (c) => {
    return c.json({ logs: webhookLogs, total: webhookLogs.length });
});

export default webhook;
