import { Model } from './Model';

export interface TelegramUserRow {
    id: number;
    chat_id: number;
    username: string | null;
    first_name: string | null;
    role: string;
    blocked: number;
    block_reason: string | null;
    blocked_at: string | null;
    block_duration_minutes: number | null;
    created_at: string;
    updated_at: string;
}

export class TelegramUser extends Model<TelegramUserRow> {
    protected static table = 'telegram_users';

    static async findByChatId(this: any, chatId: number): Promise<TelegramUserRow | null> {
        return this.findBy('chat_id', chatId);
    }

    static async deleteByChatId(this: any, chatId: number): Promise<void> {
        const row = await this.findBy('chat_id', chatId);
        if (row) await this.delete(row.id);
    }

    static async updateRoleByChatId(this: any, chatId: number, role: string): Promise<void> {
        await this.raw(
            `UPDATE ${this.table} SET role = ?, updated_at = datetime('now') WHERE chat_id = ?`,
            role,
            chatId,
        );
    }

    static async blockByChatId(this: any, chatId: number, reason?: string, durationMinutes?: number): Promise<void> {
        const blockedAt = new Date().toISOString();
        await this.raw(
            `UPDATE ${this.table} SET blocked = 1, block_reason = ?, blocked_at = ?, block_duration_minutes = ?, updated_at = datetime('now') WHERE chat_id = ?`,
            reason || null,
            blockedAt,
            durationMinutes || null,
            chatId,
        );
    }

    static async unblockByChatId(this: any, chatId: number): Promise<void> {
        await this.raw(
            `UPDATE ${this.table} SET blocked = 0, block_reason = NULL, blocked_at = NULL, block_duration_minutes = NULL, updated_at = datetime('now') WHERE chat_id = ?`,
            chatId,
        );
    }

    static async isBlocked(this: any, chatId: number): Promise<boolean> {
        const user = await this.findBy('chat_id', chatId) as any;
        if (!user || user.blocked !== 1) return false;

        // Check if block has expired
        if (user.blocked_at && user.block_duration_minutes) {
            const blockedAt = new Date(user.blocked_at).getTime();
            const expiresAt = blockedAt + (user.block_duration_minutes * 60 * 1000);
            if (Date.now() > expiresAt) {
                // Auto-unblock
                await this.unblockByChatId(chatId);
                return false;
            }
        }
        return true;
    }

    static async getBlockInfo(this: any, chatId: number): Promise<{ blocked: boolean; reason: string | null; expires_at: string | null } | null> {
        const user = await this.findBy('chat_id', chatId) as any;
        if (!user) return null;
        return {
            blocked: user.blocked === 1,
            reason: user.block_reason,
            expires_at: user.blocked_at && user.block_duration_minutes
                ? new Date(new Date(user.blocked_at).getTime() + user.block_duration_minutes * 60 * 1000).toISOString()
                : null,
        };
    }

    static async autoUnblockExpired(this: any): Promise<number> {
        const result = await this.raw(
            `UPDATE ${this.table} 
             SET blocked = 0, block_reason = NULL, blocked_at = NULL, block_duration_minutes = NULL, updated_at = datetime('now')
             WHERE blocked = 1 AND block_duration_minutes IS NOT NULL AND blocked_at IS NOT NULL
             AND datetime(blocked_at, '+' || block_duration_minutes || ' minutes') < datetime('now')`
        );
        return (result as any)?.changes ?? 0;
    }

    static async getStats(this: any): Promise<{
        total: number;
        today: number;
        yesterday: number;
        thisWeek: number;
        thisMonth: number;
    }> {
        const total = await this.raw('SELECT COUNT(*) as count FROM telegram_users');
        const today = await this.raw(
            "SELECT COUNT(*) as count FROM telegram_users WHERE date(created_at) = date('now')"
        );
        const yesterday = await this.raw(
            "SELECT COUNT(*) as count FROM telegram_users WHERE date(created_at) = date('now', '-1 day')"
        );
        const thisWeek = await this.raw(
            "SELECT COUNT(*) as count FROM telegram_users WHERE created_at >= datetime('now', '-7 days')"
        );
        const thisMonth = await this.raw(
            "SELECT COUNT(*) as count FROM telegram_users WHERE created_at >= datetime('now', '-30 days')"
        );

        return {
            total: (total[0] as any)?.count ?? 0,
            today: (today[0] as any)?.count ?? 0,
            yesterday: (yesterday[0] as any)?.count ?? 0,
            thisWeek: (thisWeek[0] as any)?.count ?? 0,
            thisMonth: (thisMonth[0] as any)?.count ?? 0,
        };
    }

    static async getDailyStats(this: any, days: number = 30): Promise<{ date: string; count: number }[]> {
        return this.raw(
            `SELECT date(created_at) as date, COUNT(*) as count 
             FROM telegram_users 
             WHERE created_at >= datetime('now', '-${days} days')
             GROUP BY date(created_at)
             ORDER BY date ASC`
        );
    }
}
