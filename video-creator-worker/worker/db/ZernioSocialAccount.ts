import { Model } from './Model';

export interface ZernioSocialAccountRow {
    id: string;
    account_id: string;
    platform: string;
    username: string | null;
    display_name: string | null;
    profile_image: string | null;
    status: string;
    admin_key: string | null;
    raw_data: string | null;
    synced_at: string;
    created_at?: string;
    updated_at?: string;
}

export class ZernioSocialAccount extends Model<ZernioSocialAccountRow> {
    protected static table = 'zernio_social_accounts';

    static async findByAccountId(account_id: string) {
        return this.findBy<ZernioSocialAccountRow>('account_id', account_id);
    }

    static async upsertSocialAccount(data: {
        account_id: string;
        platform: string;
        username?: string;
        display_name?: string;
        profile_image?: string;
        status?: string;
        raw_data?: string;
    }) {
        const existing = await this.findByAccountId(data.account_id);
        if (existing) {
            await this.db
                .prepare(`UPDATE ${this.table} SET platform = ?, username = ?, display_name = ?, profile_image = ?, status = ?, raw_data = ?, synced_at = datetime('now'), updated_at = datetime('now') WHERE account_id = ?`)
                .bind(data.platform, data.username ?? null, data.display_name ?? null, data.profile_image ?? null, data.status ?? 'active', data.raw_data ?? null, data.account_id)
                .run();
        } else {
            await this.create({
                id: `sa_${data.account_id}`,
                ...data,
                status: data.status ?? 'active',
                raw_data: data.raw_data ?? null,
                synced_at: new Date().toISOString(),
            });
        }
    }

    static async deleteByAccountId(account_id: string) {
        await this.db.prepare(`DELETE FROM ${this.table} WHERE account_id = ?`).bind(account_id).run();
    }
}
