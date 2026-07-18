import { Model } from './Model';

export interface PageAdminRow {
    id: string;
    social_account_id: string;
    user_id: string;
    username: string | null;
    display_name: string | null;
    role: string;
    added_by: string;
    created_at?: string;
}

export class PageAdmin extends Model<PageAdminRow> {
    protected static table = 'zernio_page_admins';

    static async findBySocialAccount(social_account_id: string) {
        return this.where<PageAdminRow>('social_account_id', social_account_id);
    }

    static async findByUserId(user_id: string) {
        return this.where<PageAdminRow>('user_id', user_id);
    }

    static async findBySocialAccountAndUser(social_account_id: string, user_id: string) {
        return this.rawFirst<PageAdminRow>(
            `SELECT * FROM ${this.table} WHERE social_account_id = ? AND user_id = ?`,
            social_account_id,
            user_id,
        );
    }

    static async upsertAdmin(data: {
        social_account_id: string;
        user_id: string;
        username?: string;
        display_name?: string;
        role?: string;
        added_by?: string;
    }) {
        const existing = await this.findBySocialAccountAndUser(data.social_account_id, data.user_id);
        if (existing) {
            // Update if needed
            if (data.username && data.username !== existing.username) {
                await this.update(existing.id, { username: data.username, display_name: data.display_name ?? null });
            }
            return existing;
        }
        return this.create({
            id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            social_account_id: data.social_account_id,
            user_id: data.user_id,
            username: data.username ?? null,
            display_name: data.display_name ?? null,
            role: data.role || 'admin',
            added_by: data.added_by || 'manual',
        });
    }

    static async deleteBySocialAccountAndUser(social_account_id: string, user_id: string) {
        await this.raw(
            `DELETE FROM ${this.table} WHERE social_account_id = ? AND user_id = ?`,
            social_account_id,
            user_id,
        );
    }
}
