import { Hono } from 'hono';
import { Bot, Api, webhookCallback, InlineKeyboard, Keyboard } from 'grammy';
import { TelegramUser } from '../db/TelegramUser';
import { BotChannel } from '../db/BotChannel';
import { BotHelp } from '../db/BotHelp';
import { Setting } from '../db/Setting';
import { AiSetting, AiUsageLog } from '../db/AiSetting';
import { AiDatabaseAccess } from '../db/AiDatabaseAccess';
import type { Bindings } from '../types';

const telegram = new Hono<{ Bindings: Bindings }>();

const MEMBER_STATUSES = ['member', 'administrator', 'owner', 'creator'];

// Anti-spam: store last message timestamps per user
const spamCache = new Map<number, number[]>();
const SPAM_WINDOW = 5000; // 5 seconds
const SPAM_LIMIT = 5; // max messages per window

function isSpamming(userId: number): boolean {
    const now = Date.now();
    const timestamps = spamCache.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < SPAM_WINDOW);
    if (recent.length >= SPAM_LIMIT) {
        return true;
    }
    recent.push(now);
    spamCache.set(userId, recent);
    return false;
}

function helpKeyboard() {
    return new Keyboard()
        .text('راهنما')
        .text('هوش مصنوعی')
        .resized()
        .persistent();
}

function aiKeyboard() {
    return new Keyboard()
        .text('سوال از هوش مصنوعی')
        .text('راهنما')
        .resized()
        .persistent();
}

async function checkMembership(
    api: Api,
    userId: number,
    channels: { channel_id: number; channel_username: string }[]
): Promise<number[]> {
    const unjoined: number[] = [];

    for (const ch of channels) {
        try {
            const member = await api.getChatMember(`@${ch.channel_username}`, userId);
            if (!MEMBER_STATUSES.includes(member.status)) {
                unjoined.push(ch.channel_id);
            }
        } catch {
            unjoined.push(ch.channel_id);
        }
    }

    return unjoined;
}

telegram.post('/webhook', async (c) => {
    try {
        Setting.use(c.env.DB);
        const token = await Setting.get('telegram_token');
        if (!token) return c.text('no token', 400);

        const bot = new Bot(token);
        const api = new Api(token);

        bot.on('message', async (ctx) => {
            try {
                const userId = ctx.from?.id;
                if (!userId) return;

                // Check if user is blocked
                TelegramUser.use(c.env.DB);
                if (await TelegramUser.isBlocked(userId)) {
                    const blockInfo = await TelegramUser.getBlockInfo(userId);
                    if (blockInfo?.reason) {
                        await ctx.reply(`⛔ شما مسدود شده‌ید.\nعلت: ${blockInfo.reason}`);
                    }
                    return; // silently ignore blocked users
                }

                // Anti-spam check
                if (isSpamming(userId)) {
                    await ctx.reply('⚠️ لطفاً صبر کنید. پیام‌های شما خیلی سریع است.');
                    return;
                }

                const text = ctx.message.text;

                // /start - register user
                if (text?.startsWith('/start')) {
                    TelegramUser.use(c.env.DB);
                    const { id: chat_id, username, first_name } = ctx.message.from;

                    const existing = await TelegramUser.findBy<{ id: number }>('chat_id', chat_id);
                    if (!existing) {
                        await TelegramUser.create({
                            chat_id,
                            username: username ?? null,
                            first_name: first_name ?? null,
                        });
                    }

                    // check mandatory channels
                    BotChannel.use(c.env.DB);
                    const mandatory = await BotChannel.findMandatory();

                    if (mandatory.length > 0) {
                        const unjoinedIds = await checkMembership(api, userId, mandatory);
                        if (unjoinedIds.length > 0) {
                            const unjoined = mandatory.filter((ch) => unjoinedIds.includes(ch.channel_id));
                            const kb = new InlineKeyboard();
                            for (const ch of unjoined) {
                                kb.url(`📢 ${ch.channel_title || ch.channel_username}`, `https://t.me/${ch.channel_username}`).row();
                            }
                            await ctx.reply(
                                '❌ لطفاً ابتدا در کانال‌های زیر عضو شوید:\n\nپس از عضویت، مجدداً /start را ارسال کنید.',
                                { reply_markup: kb }
                            );
                            return;
                        }
                    }

                    await ctx.reply(`👋 سلام ${first_name || 'کاربر عزیز'}! خوش آمدید.`, {
                        reply_markup: helpKeyboard(),
                    });
                    return;
                }

                // mandatory channel check for other messages
                BotChannel.use(c.env.DB);
                const mandatory = await BotChannel.findMandatory();
                if (mandatory.length > 0) {
                    const unjoinedIds = await checkMembership(api, userId, mandatory);
                    if (unjoinedIds.length > 0) {
                        const unjoined = mandatory.filter((ch) => unjoinedIds.includes(ch.channel_id));
                        const kb = new InlineKeyboard();
                        for (const ch of unjoined) {
                            kb.url(`📢 ${ch.channel_title || ch.channel_username}`, `https://t.me/${ch.channel_username}`).row();
                        }
                        await ctx.reply(
                            '❌ لطفاً ابتدا در کانال‌های زیر عضو شوید:\n\nپس از عضویت، مجدداً هر پیامی ارسال کنید.',
                            { reply_markup: kb }
                        );
                        return;
                    }
                }

                // راهنما - show help items
                if (text === 'راهنما') {
                    BotHelp.use(c.env.DB);
                    const helps = await BotHelp.all<{ id: number; name: string; description: string; sort_order: number }>();
                    helps.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
                    if (helps.length === 0) {
                        await ctx.reply('راهنمایی موجود نیست.', { reply_markup: helpKeyboard() });
                        return;
                    }
                    const kb = new InlineKeyboard();
                    for (const h of helps) {
                        kb.text(h.name, `help_${h.id}`).row();
                    }
                    await ctx.reply('یک راهنما انتخاب کنید:', { reply_markup: kb });
                    return;
                }

                // هوش مصنوعی - AI menu
                if (text === 'هوش مصنوعی') {
                    await ctx.reply(
                        '🤖 هوش مصنوعی\n\nبا ارسال هر پیام، هوش مصنوعی به شما پاسخ می‌دهد.\nاز دکمه‌های زیر استفاده کنید:',
                        { reply_markup: aiKeyboard() }
                    );
                    return;
                }

                // سوال از هوش مصنوعی - enter AI chat mode
                if (text === 'سوال از هوش مصنوعی') {
                    await ctx.reply(
                        '💬 در حالت چت هوش مصنوعی هستید.\nهر پیامی بفرستید، هوش مصنوعی پاسخ می‌دهد.\nبرای خروج، /start را ارسال کنید.',
                        { reply_markup: aiKeyboard() }
                    );
                    return;
                }

                // AI Chat - process message through AI
                try {
                    AiSetting.use(c.env.DB);
                    const aiEnabled = await AiSetting.get('ai_user_enabled');

                    if (aiEnabled === 'true') {
                        // Check daily limit
                        const dailyLimitStr = await AiSetting.get('ai_user_daily_limit');
                        const dailyLimit = parseInt(dailyLimitStr || '0', 10);

                        if (dailyLimit > 0) {
                            AiUsageLog.use(c.env.DB);
                            const todayUsage = await AiUsageLog.getTodayUsageByChatId(userId);
                            if (todayUsage.totalRequests >= dailyLimit) {
                                await ctx.reply(
                                    `⚠️ سقف استفاده روزانه شما (${dailyLimit} درخواست) تمام شده است.\nفردا دوباره تلاش کنید.`,
                                    { reply_markup: helpKeyboard() }
                                );
                                return;
                            }
                        }

                        const model = (await AiSetting.get('ai_user_model')) || '@cf/meta/llama-4-scout-17b-16e-instruct';
                        const systemPrompt = (await AiSetting.get('ai_user_system_prompt')) || 'شما یک دستیار مفید هستید.';
                        const maxTokens = parseInt((await AiSetting.get('ai_user_max_tokens')) || '512', 10);
                        const temperature = parseFloat((await AiSetting.get('ai_user_temperature')) || '0.7');

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

                        const aiResponse = await c.env.AI.run(model, {
                            messages: [
                                { role: 'system', content: fullSystemPrompt },
                                { role: 'user', content: text },
                            ],
                            max_tokens: maxTokens,
                            temperature,
                        });

                        const responseText = (aiResponse as any).response || 'پاسخی دریافت نشد.';

                        // Log usage
                        AiUsageLog.use(c.env.DB);
                        await AiUsageLog.logUsage('user', userId, maxTokens);

                        await ctx.reply(responseText, { reply_markup: aiKeyboard() });
                        return;
                    }
                } catch (aiError) {
                    console.error('AI error:', aiError);
                    // Fall through to default reply
                }

                // default reply
                if (text) {
                    await ctx.reply(`✅ پیام شما دریافت شد.`, { reply_markup: helpKeyboard() });
                }
            } catch (error: any) {
                console.error('Error in message handler:', error);
                try {
                    await ctx.reply('❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.');
                } catch {}
            }
        });

        bot.on('callback_query:data', async (ctx) => {
            try {
                const data = ctx.callbackQuery.data;
                if (data?.startsWith('help_')) {
                    const id = Number(data.slice(5));
                    BotHelp.use(c.env.DB);
                    const help = await BotHelp.find<{ id: number; name: string; description: string }>(String(id));
                    if (help) {
                        await ctx.reply(help.description, { parse_mode: 'HTML' });
                    } else {
                        await ctx.reply('راهنما یافت نشد.');
                    }
                    await ctx.answerCallbackQuery();
                }
            } catch (error: any) {
                console.error('Error in callback handler:', error);
            }
        });

        const callback = webhookCallback(bot, 'cloudflare-mod');
        return await callback(c.req.raw);
    } catch (error: any) {
        return c.text(`Webhook error: ${error.message}`, 500);
    }
});

export default telegram;
