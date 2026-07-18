import { Hono } from 'hono';
import { Api } from 'grammy';
import { TelegramUser } from '../db/TelegramUser';
import { TelegramUserSession } from '../db/TelegramUserSession';
import { BotChannel } from '../db/BotChannel';
import { BotHelp } from '../db/BotHelp';
import { Setting } from '../db/Setting';
import { AiSetting, AiUsageLog } from '../db/AiSetting';
import { AiDatabaseAccess } from '../db/AiDatabaseAccess';
import { ZernioAccount, type ZernioAccountRow } from '../db/ZernioAccount';
import { ZernioSocialAccount } from '../db/ZernioSocialAccount';
import { PageAdmin } from '../db/PageAdmin';
import { Schedule } from '../db/Schedule';
import { requireAuth } from '../middleware';
import type { Bindings, Variables } from '../types';

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

dashboard.use('*', requireAuth);

dashboard.get('/me', (c) => {
    return c.json(c.get('user'));
});

// --- Telegram Users ---

dashboard.get('/telegram-users', async (c) => {
    TelegramUser.use(c.env.DB);
    const users = await TelegramUser.all();
    return c.json(users);
});

dashboard.delete('/telegram-users/:chatId', async (c) => {
    TelegramUser.use(c.env.DB);
    const chatId = Number(c.req.param('chatId'));
    const user = await TelegramUser.findByChatId(chatId);
    if (!user) return c.json({ error: 'کاربر یافت نشد' }, 404);
    await TelegramUser.deleteByChatId(chatId);
    return c.json({ ok: true });
});

dashboard.put('/telegram-users/:chatId/role', async (c) => {
    const { role } = await c.req.json<{ role: string }>();
    if (role !== 'admin' && role !== 'user') {
        return c.json({ error: 'نقش نامعتبر است' }, 400);
    }
    TelegramUser.use(c.env.DB);
    const chatId = Number(c.req.param('chatId'));
    await TelegramUser.updateRoleByChatId(chatId, role);
    return c.json({ ok: true });
});

dashboard.put('/telegram-users/:chatId/block', async (c) => {
    const chatId = Number(c.req.param('chatId'));
    const { reason, duration_minutes } = await c.req.json<{ reason?: string; duration_minutes?: number }>();
    TelegramUser.use(c.env.DB);
    const user = await TelegramUser.findByChatId(chatId);
    if (!user) return c.json({ error: 'کاربر یافت نشد' }, 404);
    await TelegramUser.blockByChatId(chatId, reason, duration_minutes);
    return c.json({ ok: true });
});

dashboard.put('/telegram-users/:chatId/unblock', async (c) => {
    const chatId = Number(c.req.param('chatId'));
    TelegramUser.use(c.env.DB);
    const user = await TelegramUser.findByChatId(chatId);
    if (!user) return c.json({ error: 'کاربر یافت نشد' }, 404);
    await TelegramUser.unblockByChatId(chatId);
    return c.json({ ok: true });
});

dashboard.post('/telegram-users/:chatId/send-message', async (c) => {
    const chatId = Number(c.req.param('chatId'));
    const { text, parse_mode } = await c.req.json<{ text: string; parse_mode?: string }>();

    if (!text || text.trim().length === 0) {
        return c.json({ error: 'متن پیام الزامی است' }, 400);
    }

    TelegramUser.use(c.env.DB);
    const user = await TelegramUser.findByChatId(chatId);
    if (!user) return c.json({ error: 'کاربر یافت نشد' }, 404);

    Setting.use(c.env.DB);
    const token = await Setting.get('telegram_token');
    if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

    const api = new Api(token);
    try {
        const options: Record<string, any> = {};
        if (parse_mode) options.parse_mode = parse_mode;
        await api.sendMessage(chatId, text, options);
        return c.json({ ok: true });
    } catch (error: any) {
        return c.json({ error: error?.message || 'خطا در ارسال پیام' }, 500);
    }
});

dashboard.get('/stats', async (c) => {
    TelegramUser.use(c.env.DB);
    const stats = await TelegramUser.getStats();
    return c.json(stats);
});

dashboard.get('/stats/daily', async (c) => {
    const days = Number(c.req.query('days')) || 30;
    TelegramUser.use(c.env.DB);
    const daily = await TelegramUser.getDailyStats(days);
    return c.json(daily);
});

// --- Telegram User Sessions ---

dashboard.get('/telegram-sessions', async (c) => {
    TelegramUserSession.use(c.env.DB);
    const status = c.req.query('status');
    const sessions = status
        ? await TelegramUserSession.findByStatusWithUser(status)
        : await TelegramUserSession.allWithUser();
    return c.json(sessions);
});

dashboard.delete('/telegram-sessions/:id', async (c) => {
    TelegramUserSession.use(c.env.DB);
    const id = Number(c.req.param('id'));
    const session = await TelegramUserSession.find<{ id: number }>(String(id));
    if (!session) return c.json({ error: 'نشست یافت نشد' }, 404);
    await TelegramUserSession.delete(String(id));
    return c.json({ ok: true });
});

dashboard.put('/telegram-sessions/:id/cancel', async (c) => {
    TelegramUserSession.use(c.env.DB);
    const id = Number(c.req.param('id'));
    await TelegramUserSession.cancel(id);
    return c.json({ ok: true });
});

// --- Settings ---

dashboard.get('/settings', async (c) => {
    try {
        Setting.use(c.env.DB);
        const keys = [
            'telegram_token', 'telegram_bot_info', 'registration_disabled',
            'bot_name', 'bot_short_description', 'bot_description', 'bot_commands',
        ];
        const values = await Promise.all(keys.map((k) => Setting.get(k)));
        const map = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
        return c.json({
            token: map.telegram_token,
            botInfo: map.telegram_bot_info ? JSON.parse(map.telegram_bot_info) : null,
            registrationDisabled: map.registration_disabled === 'true',
            botName: map.bot_name ?? '',
            botShortDescription: map.bot_short_description ?? '',
            botDescription: map.bot_description ?? '',
            botCommands: map.bot_commands ? JSON.parse(map.bot_commands) : [],
        });
    } catch (e) {
        return c.json({ error: 'خطا در دریافت تنظیمات' }, 500);
    }
});

dashboard.put('/settings/token', async (c) => {
    try {
        const { token } = await c.req.json<{ token: string }>();
        if (!token) return c.json({ error: 'توکن الزامی است' }, 400);

        Setting.use(c.env.DB);

        const api = new Api(token);
        const botInfo = await api.getMe();

        await Setting.set('telegram_token', token);
        await Setting.set('telegram_bot_info', JSON.stringify(botInfo));

        return c.json({ ok: true, botInfo });
    } catch (e: any) {
        const msg = e?.response?.description || e?.message || 'خطای ناشناخته';
        return c.json({ error: msg }, 400);
    }
});

dashboard.post('/settings/webhook/set', async (c) => {
    try {
        const { url: webhookUrl } = await c.req.json<{ url: string }>();
        if (!webhookUrl) return c.json({ error: 'آدرس وب‌هوک الزامی است' }, 400);

        const cleanUrl = webhookUrl.trim();
        if (!cleanUrl.startsWith('https://')) {
            return c.json({ error: 'آدرس وب‌هوک باید با https:// شروع شود' }, 400);
        }

        Setting.use(c.env.DB);
        const token = await Setting.get('telegram_token');
        if (!token) return c.json({ error: 'ابتدا توکن را تنظیم کنید' }, 400);

        const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: cleanUrl }),
        });
        const result = await res.json() as { ok: boolean; description?: string };

        if (!result.ok) {
            return c.json({ error: result.description || 'خطا در تنظیم وب‌هوک', sent_url: cleanUrl }, 400);
        }

        return c.json({ ok: true, url: cleanUrl });
    } catch (e: any) {
        const msg = e?.message || 'خطا در تنظیم وب‌هوک';
        return c.json({ error: msg }, 500);
    }
});

dashboard.post('/settings/webhook/delete', async (c) => {
    try {
        Setting.use(c.env.DB);
        const token = await Setting.get('telegram_token');
        if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

        const api = new Api(token);
        const result = await api.deleteWebhook();

        return c.json({ ok: result });
    } catch (e: any) {
        const msg = e?.response?.description || e?.message || 'خطا در حذف وب‌هوک';
        return c.json({ error: msg }, 500);
    }
});

dashboard.put('/settings/registration', async (c) => {
    try {
        const { disabled } = await c.req.json<{ disabled: boolean }>();
        Setting.use(c.env.DB);
        await Setting.set('registration_disabled', String(disabled));
        return c.json({ ok: true, registrationDisabled: disabled });
    } catch (e) {
        return c.json({ error: 'خطا در بروزرسانی تنظیمات' }, 500);
    }
});

dashboard.get('/settings/webhook/info', async (c) => {
    try {
        Setting.use(c.env.DB);
        const token = await Setting.get('telegram_token');
        if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

        const api = new Api(token);
        const info = await api.getWebhookInfo();

        return c.json(info);
    } catch (e: any) {
        const msg = e?.response?.description || e?.message || 'خطا در دریافت اطلاعات وب‌هوک';
        return c.json({ error: msg }, 500);
    }
});

// --- Bot Settings (setMyName, setMyShortDescription, setMyDescription, setMyCommands) ---

async function getTelegramToken(c: any): Promise<string | null> {
    Setting.use(c.env.DB);
    return Setting.get('telegram_token');
}

dashboard.put('/settings/bot-name', async (c) => {
    try {
        const token = await getTelegramToken(c);
        if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

        const { name } = await c.req.json<{ name: string }>();
        const res = await fetch(`https://api.telegram.org/bot${token}/setMyName`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        const result = await res.json() as { ok: boolean; description?: string };
        if (!result.ok) return c.json({ error: result.description }, 400);

        Setting.use(c.env.DB);
        await Setting.set('bot_name', name);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در تنظیم نام' }, 500);
    }
});

dashboard.put('/settings/bot-short-description', async (c) => {
    try {
        const token = await getTelegramToken(c);
        if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

        const { shortDescription } = await c.req.json<{ shortDescription: string }>();
        const res = await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ short_description: shortDescription }),
        });
        const result = await res.json() as { ok: boolean; description?: string };
        if (!result.ok) return c.json({ error: result.description }, 400);

        Setting.use(c.env.DB);
        await Setting.set('bot_short_description', shortDescription);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در تنظیم توضیح کوتاه' }, 500);
    }
});

dashboard.put('/settings/bot-description', async (c) => {
    try {
        const token = await getTelegramToken(c);
        if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

        const { description } = await c.req.json<{ description: string }>();
        const res = await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description }),
        });
        const result = await res.json() as { ok: boolean; description?: string };
        if (!result.ok) return c.json({ error: result.description }, 400);

        Setting.use(c.env.DB);
        await Setting.set('bot_description', description);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در تنظیم توضیحات' }, 500);
    }
});

dashboard.put('/settings/bot-commands', async (c) => {
    try {
        const token = await getTelegramToken(c);
        if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

        const { commands } = await c.req.json<{ commands: { command: string; description: string }[] }>();
        const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commands }),
        });
        const result = await res.json() as { ok: boolean; description?: string };
        if (!result.ok) return c.json({ error: result.description }, 400);

        Setting.use(c.env.DB);
        await Setting.set('bot_commands', JSON.stringify(commands));
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در تنظیم دستورات' }, 500);
    }
});

// --- Bot Channels ---

dashboard.get('/bot-channels', async (c) => {
    BotChannel.use(c.env.DB);
    const channels = await BotChannel.all();
    return c.json(channels);
});

dashboard.post('/bot-channels', async (c) => {
    try {
        const { channel_username } = await c.req.json<{ channel_username: string }>();
        if (!channel_username) return c.json({ error: 'نام کاربری کانال الزامی است' }, 400);

        const cleanUsername = channel_username.replace('@', '').trim();

        Setting.use(c.env.DB);
        const token = await Setting.get('telegram_token');
        if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

        const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: `@${cleanUsername}` }),
        });
        const result = await res.json() as { ok: boolean; description?: string; result: any };
        if (!result.ok) return c.json({ error: result.description || 'کانال یافت نشد' }, 400);

        const chat = result.result;
        if (chat.type !== 'channel' && chat.type !== 'supergroup') {
            return c.json({ error: 'فقط کانال یا سوپرگروپ مجاز است' }, 400);
        }
        BotChannel.use(c.env.DB);
        const existing = await BotChannel.findBy<{ id: number }>('channel_id', chat.id);
        if (existing) return c.json({ error: 'این کانال قبلا اضافه شده' }, 400);

        const channel = await BotChannel.create({
            channel_id: chat.id,
            channel_username: cleanUsername,
            channel_title: chat.title || cleanUsername,
            is_mandatory: 0,
        });
        return c.json({ ok: true, channel });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در افزودن کانال' }, 500);
    }
});

dashboard.put('/bot-channels/:id', async (c) => {
    try {
        const id = Number(c.req.param('id'));
        const { is_mandatory } = await c.req.json<{ is_mandatory: boolean }>();

        BotChannel.use(c.env.DB);
        const channel = await BotChannel.findBy<{ id: number; channel_username: string; channel_title: string }>('id', id);
        if (!channel) return c.json({ error: 'کانال یافت نشد' }, 404);

        // اگر فعال‌سازی عضویت الزامی است، بررسی کن بات مدیر کانال باشد
        if (is_mandatory) {
            Setting.use(c.env.DB);
            const token = await Setting.get('telegram_token');
            if (!token) return c.json({ error: 'توکن تنظیم نشده' }, 400);

            const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
            const me = await meRes.json() as { ok: boolean; result: { id: number } };
            if (!me.ok) return c.json({ error: 'خطا در دریافت اطلاعات بات' }, 500);

            const memberRes = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: `@${channel.channel_username}`, user_id: me.result.id }),
            });
            const memberResult = await memberRes.json() as { ok: boolean; result: { status: string }; description?: string };

            if (!memberResult.ok) {
                return c.json({ error: `بات در کانال @${channel.channel_username} عضو نیست. ابتدا بات را به کانال اضافه کنید.` }, 400);
            }

            const isAdmin = ['administrator', 'creator', 'owner'].includes(memberResult.result.status);
            if (!isAdmin) {
                return c.json({ error: `بات باید مدیر کانال @${channel.channel_username} باشد. سطح دسترسی فعلی: ${memberResult.result.status}` }, 400);
            }
        }

        await BotChannel.raw(
            `UPDATE bot_channels SET is_mandatory = ? WHERE id = ?`,
            is_mandatory ? 1 : 0,
            id,
        );
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی' }, 500);
    }
});

dashboard.delete('/bot-channels/:id', async (c) => {
    try {
        const id = Number(c.req.param('id'));
        BotChannel.use(c.env.DB);
        await BotChannel.delete(String(id));
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در حذف' }, 500);
    }
});

// --- Bot Helps ---

dashboard.get('/bot-helps', async (c) => {
    BotHelp.use(c.env.DB);
    const helps = await BotHelp.all();
    helps.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
    return c.json(helps);
});

dashboard.post('/bot-helps', async (c) => {
    try {
        const { name, description, sort_order } = await c.req.json<{ name: string; description: string; sort_order?: number }>();
        if (!name || !description) {
            return c.json({ error: 'نام و توضیحات الزامی است' }, 400);
        }
        BotHelp.use(c.env.DB);
        const row = await BotHelp.create({
            name,
            description,
            sort_order: sort_order ?? 0,
        });
        return c.json({ ok: true, help: row });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در ایجاد' }, 500);
    }
});

dashboard.put('/bot-helps/:id', async (c) => {
    try {
        const id = Number(c.req.param('id'));
        const { name, description, sort_order } = await c.req.json<{ name?: string; description?: string; sort_order?: number }>();
        BotHelp.use(c.env.DB);
        const existing = await BotHelp.find(String(id));
        if (!existing) return c.json({ error: 'راهنما یافت نشد' }, 404);

        const updates: Record<string, any> = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (sort_order !== undefined) updates.sort_order = sort_order;

        if (Object.keys(updates).length > 0) {
            await BotHelp.update(String(id), updates);
        }
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی' }, 500);
    }
});

dashboard.delete('/bot-helps/:id', async (c) => {
    try {
        const id = Number(c.req.param('id'));
        BotHelp.use(c.env.DB);
        await BotHelp.delete(String(id));
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در حذف' }, 500);
    }
});

// --- AI Settings ---

dashboard.get('/ai-settings', async (c) => {
    try {
        AiSetting.use(c.env.DB);
        const adminSettings = await AiSetting.getAdminSettings();
        const userSettings = await AiSetting.getUserSettings();
        return c.json({ admin: adminSettings, user: userSettings });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت تنظیمات هوش مصنوعی' }, 500);
    }
});

dashboard.put('/ai-settings/admin', async (c) => {
    try {
        const body = await c.req.json<Record<string, string>>();
        AiSetting.use(c.env.DB);
        for (const [key, value] of Object.entries(body)) {
            await AiSetting.set(`ai_admin_${key}`, value);
        }
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی تنظیمات مدیر' }, 500);
    }
});

dashboard.put('/ai-settings/user', async (c) => {
    try {
        const body = await c.req.json<Record<string, string>>();
        AiSetting.use(c.env.DB);
        for (const [key, value] of Object.entries(body)) {
            await AiSetting.set(`ai_user_${key}`, value);
        }
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی تنظیمات کاربر' }, 500);
    }
});

dashboard.get('/ai-usage', async (c) => {
    try {
        AiUsageLog.use(c.env.DB);
        const stats = await AiUsageLog.getStats();
        return c.json(stats);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت آمار' }, 500);
    }
});

dashboard.post('/ai-chat', async (c) => {
    try {
        const { message, role } = await c.req.json<{ message: string; role?: string }>();

        if (!message || message.trim().length === 0) {
            return c.json({ error: 'پیام الزامی است' }, 400);
        }

        const userRole = role || 'admin';

        AiSetting.use(c.env.DB);
        const settings = userRole === 'admin'
            ? await AiSetting.getAdminSettings()
            : await AiSetting.getUserSettings();

        if (settings.enabled !== 'true') {
            return c.json({ error: 'هوش مصنوعی برای این نقش غیرفعال است' }, 403);
        }

        const dailyLimit = parseInt(settings.daily_limit || '0', 10);
        if (dailyLimit > 0) {
            AiUsageLog.use(c.env.DB);
            const todayUsage = await AiUsageLog.getTodayUsage(userRole);
            if (todayUsage.totalRequests >= dailyLimit) {
                return c.json({ error: `سقف استفاده روزانه (${dailyLimit} درخواست) رسیده است` }, 429);
            }
        }

        const model = settings.model || '@cf/meta/llama-4-scout-17b-16e-instruct';
        const systemPrompt = settings.system_prompt || 'شما یک دستیار مفید هستید.';
        const maxTokens = parseInt(settings.max_tokens || '512', 10);
        const temperature = parseFloat(settings.temperature || '0.7');

        // Get rules from telegram_bot_helps table
        let rulesContext = '';
        try {
            BotHelp.use(c.env.DB);
            const helps = await BotHelp.all<{ name: string; description: string }>();
            if (helps.length > 0) {
                rulesContext = '\n\nقوانین و راهنمای ربات:\n';
                for (const h of helps) {
                    rulesContext += `\n${h.name}:\n${h.description}\n`;
                }
            }
        } catch {}

        const fullSystemPrompt = systemPrompt + rulesContext;

        const response = await c.env.AI.run(model, {
            messages: [
                { role: 'system', content: fullSystemPrompt },
                { role: 'user', content: message },
            ],
            max_tokens: maxTokens,
            temperature,
        });

        const responseText = (response as any).response || '';

        AiUsageLog.use(c.env.DB);
        await AiUsageLog.logUsage(userRole, null, maxTokens);

        return c.json({ response: responseText });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در پردازش درخواست هوش مصنوعی' }, 500);
    }
});

// --- AI Database Access ---

dashboard.get('/ai-db/schema', async (c) => {
    try {
        const role = c.req.query('role') || 'admin';
        const dbAccess = new AiDatabaseAccess(c.env.DB, role);
        const schema = await dbAccess.getTableSchema();
        return c.json(schema);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت اسکیما' }, 500);
    }
});

dashboard.get('/ai-db/summary', async (c) => {
    try {
        const role = c.req.query('role') || 'admin';
        const dbAccess = new AiDatabaseAccess(c.env.DB, role);
        const summary = await dbAccess.getSummary();
        return c.json(summary);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت خلاصه' }, 500);
    }
});

dashboard.post('/ai-db/query', async (c) => {
    try {
        const { table, columns, where, params, limit, offset, orderBy, role } = await c.req.json<{
            table: string;
            columns?: string[];
            where?: string;
            params?: any[];
            limit?: number;
            offset?: number;
            orderBy?: string;
            role?: string;
        }>();

        if (!table) {
            return c.json({ error: 'نام جدول الزامی است' }, 400);
        }

        const userRole = role || 'admin';
        const dbAccess = new AiDatabaseAccess(c.env.DB, userRole);
        const result = await dbAccess.queryTable(table, {
            columns,
            where,
            params,
            limit,
            offset,
            orderBy,
        });

        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در اجرای کوئری' }, 500);
    }
});

// --- Zernio Accounts ---

dashboard.get('/zernio-accounts', async (c) => {
    try {
        const user = c.get('user');
        ZernioAccount.use(c.env.DB);
        const accounts = await ZernioAccount.findByUserId(user.id);
        return c.json(accounts.map(a => ({ ...a, api_key: a.api_key.slice(0, 8) + '...' + a.api_key.slice(-4) })));
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت اکانت‌ها' }, 500);
    }
});

dashboard.post('/zernio-accounts', async (c) => {
    try {
        const user = c.get('user');
        const { name, api_key } = await c.req.json<{ name: string; api_key: string }>();
        if (!name || !api_key) return c.json({ error: 'نام و کلید API الزامی است' }, 400);

        ZernioAccount.use(c.env.DB);
        const id = `za_${Date.now()}`;
        const account = await ZernioAccount.create({ id, user_id: user.id, name, api_key });
        return c.json({ ok: true, account });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در ایجاد اکانت' }, 500);
    }
});

dashboard.put('/zernio-accounts/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { name, api_key } = await c.req.json<{ name: string; api_key: string }>();
        if (!name || !api_key) return c.json({ error: 'نام و کلید API الزامی است' }, 400);

        ZernioAccount.use(c.env.DB);
        const existing = await ZernioAccount.find(id);
        if (!existing) return c.json({ error: 'اکانت یافت نشد' }, 404);

        await ZernioAccount.updateApiKey(id, name, api_key);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی اکانت' }, 500);
    }
});

dashboard.delete('/zernio-accounts/:id', async (c) => {
    try {
        const id = c.req.param('id');
        ZernioAccount.use(c.env.DB);
        const existing = await ZernioAccount.find(id);
        if (!existing) return c.json({ error: 'اکانت یافت نشد' }, 404);
        await ZernioAccount.delete(id);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در حذف اکانت' }, 500);
    }
});

// --- Zernio Social Accounts ---

dashboard.get('/zernio-social-accounts', async (c) => {
    try {
        ZernioSocialAccount.use(c.env.DB);
        const accounts = await ZernioSocialAccount.all();
        return c.json(accounts);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت حساب‌های شبکه اجتماعی' }, 500);
    }
});

dashboard.get('/zernio-social-accounts/by-zernio/:zernioAccountId', async (c) => {
    try {
        const zernioAccountId = c.req.param('zernioAccountId');
        ZernioSocialAccount.use(c.env.DB);
        const accounts = await ZernioSocialAccount.where('account_id', zernioAccountId);
        return c.json(accounts);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت حساب‌ها' }, 500);
    }
});

dashboard.post('/zernio-social-accounts/sync/:zernioAccountId', async (c) => {
    try {
        const zernioAccountId = c.req.param('zernioAccountId');
        ZernioAccount.use(c.env.DB);
        const zernioAccount = await ZernioAccount.find<ZernioAccountRow>(zernioAccountId);
        if (!zernioAccount) return c.json({ error: 'اکانت زرنیو یافت نشد' }, 404);

        const res = await fetch('https://zernio.com/api/v1/accounts', {
            headers: { 'Authorization': `Bearer ${zernioAccount.api_key}` },
        });

        if (!res.ok) {
            return c.json({ error: 'خطا در اتصال به Zernio API', status: res.status }, 502);
        }

        const data = await res.json() as { accounts?: Array<{ _id: string; platform: string; username?: string; displayName?: string; profilePicture?: string; isActive?: boolean; platformStatus?: string }> };
        const accounts = data.accounts || [];

        ZernioSocialAccount.use(c.env.DB);
        for (const acc of accounts) {
            const status = acc.isActive ? 'active' : (acc.platformStatus || 'inactive');
            await ZernioSocialAccount.upsertSocialAccount({
                account_id: acc._id,
                platform: acc.platform,
                username: acc.username,
                display_name: acc.displayName,
                profile_image: acc.profilePicture,
                status,
                raw_data: JSON.stringify(acc),
            });
        }

        return c.json({ ok: true, synced: accounts.length });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی حساب‌ها' }, 500);
    }
});

dashboard.put('/zernio-social-accounts/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { username, display_name, status, admin_key } = await c.req.json<{ username?: string; display_name?: string; status?: string; admin_key?: string }>();

        ZernioSocialAccount.use(c.env.DB);
        const existing = await ZernioSocialAccount.find(id);
        if (!existing) return c.json({ error: 'حساب یافت نشد' }, 404);

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (username !== undefined) updates.username = username;
        if (display_name !== undefined) updates.display_name = display_name;
        if (status !== undefined) updates.status = status;
        if (admin_key !== undefined) updates.admin_key = admin_key || null;

        await ZernioSocialAccount.update(id, updates);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی حساب' }, 500);
    }
});

dashboard.delete('/zernio-social-accounts/:id', async (c) => {
    try {
        const id = c.req.param('id');
        ZernioSocialAccount.use(c.env.DB);
        await ZernioSocialAccount.delete(id);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در حذف حساب' }, 500);
    }
});

// --- Page Admins ---

dashboard.get('/page-admins/:socialAccountId', async (c) => {
    try {
        const socialAccountId = c.req.param('socialAccountId');
        PageAdmin.use(c.env.DB);
        const admins = await PageAdmin.findBySocialAccount(socialAccountId);
        return c.json(admins);
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت ادمین‌ها' }, 500);
    }
});

dashboard.post('/page-admins', async (c) => {
    try {
        const { social_account_id, user_id, username, display_name } = await c.req.json<{
            social_account_id: string;
            user_id: string;
            username?: string;
            display_name?: string;
        }>();
        if (!social_account_id || !user_id) {
            return c.json({ error: 'شناسه حساب و شناسه کاربر الزامی است' }, 400);
        }

        PageAdmin.use(c.env.DB);
        const admin = await PageAdmin.upsertAdmin({
            social_account_id,
            user_id,
            username,
            display_name,
            added_by: 'manual',
        });
        return c.json({ ok: true, admin });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در افزودن ادمین' }, 500);
    }
});

dashboard.delete('/page-admins/:id', async (c) => {
    try {
        const id = c.req.param('id');
        PageAdmin.use(c.env.DB);
        await PageAdmin.delete(id);
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در حذف ادمین' }, 500);
    }
});

// --- GitHub Workflow Settings ---

dashboard.get('/github-settings', async (c) => {
    try {
        Setting.use(c.env.DB);
        const repo = await Setting.get('github_repo');
        const token = await Setting.get('github_token');
        const workflow = await Setting.get('github_workflow');
        const branch = await Setting.get('github_branch');
        return c.json({
            repo: repo || '',
            token: token ? token.slice(0, 8) + '...' + token.slice(-4) : '',
            hasToken: !!token,
            workflow: workflow || 'video-edit.yml',
            branch: branch || 'main',
        });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت تنظیمات GitHub' }, 500);
    }
});

dashboard.put('/github-settings', async (c) => {
    try {
        const { repo, token, workflow, branch } = await c.req.json<{
            repo?: string;
            token?: string;
            workflow?: string;
            branch?: string;
        }>();

        Setting.use(c.env.DB);
        if (repo !== undefined) await Setting.set('github_repo', repo);
        if (token !== undefined && token.trim()) await Setting.set('github_token', token);
        if (workflow !== undefined) await Setting.set('github_workflow', workflow);
        if (branch !== undefined) await Setting.set('github_branch', branch);

        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی تنظیمات GitHub' }, 500);
    }
});

// --- Social Account Schedules ---

dashboard.get('/schedules/:socialAccountId', async (c) => {
    try {
        const socialAccountId = c.req.param('socialAccountId');
        Schedule.use(c.env.DB);
        const schedule = await Schedule.findBySocialAccount(socialAccountId);
        if (!schedule) {
            return c.json({
                time_slots: [],
                active_days: ['1', '2', '3', '4', '5', '6', '7'],
                is_active: false,
            });
        }
        return c.json({
            ...schedule,
            time_slots: Schedule.getTimeSlots(schedule),
            active_days: Schedule.getActiveDays(schedule),
        });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در دریافت زمانبندی' }, 500);
    }
});

dashboard.put('/schedules/:socialAccountId', async (c) => {
    try {
        const socialAccountId = c.req.param('socialAccountId');
        const { time_slots, active_days, is_active } = await c.req.json<{
            time_slots: string[];
            active_days: string[];
            is_active: boolean;
        }>();

        Schedule.use(c.env.DB);
        await Schedule.upsertSchedule({
            social_account_id: socialAccountId,
            time_slots: time_slots || [],
            active_days: active_days || ['1', '2', '3', '4', '5', '6', '7'],
            is_active,
        });

        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطا در بروزرسانی زمانبندی' }, 500);
    }
});

export default dashboard;
