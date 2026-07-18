import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { User } from '../db/User';
import { Session } from '../db/Session';
import { Setting } from '../db/Setting';
import { hashPassword, verifyPassword } from '../hash';
import type { Bindings } from '../types';

const auth = new Hono<{ Bindings: Bindings }>();

auth.post('/signup', async (c) => {
    try {
        const { email, password } = await c.req.json();
        if (!email || !password || password.length < 8) {
            return c.json({ error: 'ایمیل و رمز (حداقل ۸ کاراکتر) الزامی است' }, 400);
        }

        Setting.use(c.env.DB);
        const regDisabled = await Setting.get('registration_disabled');
        if (regDisabled === 'true') {
            return c.json({ error: 'ثبت نام غیرفعال است' }, 403);
        }

        User.use(c.env.DB);
        Session.use(c.env.DB);

        const normalizedEmail = email.toLowerCase().trim();
        if (await User.findBy('email', normalizedEmail)) {
            return c.json({ error: 'این ایمیل قبلا ثبت شده' }, 400);
        }

        const userId = crypto.randomUUID();
        await User.create({
            id: userId,
            email: normalizedEmail,
            password_hash: await hashPassword(password),
            role: 'user',
        });

        const sessionId = crypto.randomUUID();
        await Session.create({
            id: sessionId,
            user_id: userId,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        setCookie(c, 'session', sessionId, {
            httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 60 * 60 * 24 * 7,
        });
        return c.json({ ok: true });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطای سرور' }, 500);
    }
});

auth.post('/login', async (c) => {
    try {
        const { email, password } = await c.req.json();
        User.use(c.env.DB);
        Session.use(c.env.DB);

        const normalizedEmail = email?.toLowerCase().trim();
        const user = await User.findBy<{ id: string; password_hash: string; role: string }>('email', normalizedEmail);
        if (!user || !(await verifyPassword(password, user.password_hash))) {
            return c.json({ error: 'ایمیل یا رمز اشتباه است' }, 401);
        }

        const sessionId = crypto.randomUUID();
        await Session.create({
            id: sessionId,
            user_id: user.id,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        setCookie(c, 'session', sessionId, {
            httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 60 * 60 * 24 * 7,
        });
        return c.json({ ok: true, role: user.role });
    } catch (e: any) {
        return c.json({ error: e?.message || 'خطای سرور' }, 500);
    }
});

auth.post('/logout', async (c) => {
    const sessionId = getCookie(c, 'session');
    if (sessionId) {
        Session.use(c.env.DB);
        await Session.delete(sessionId);
    }
    deleteCookie(c, 'session', { path: '/' });
    return c.json({ ok: true });
});

export default auth;