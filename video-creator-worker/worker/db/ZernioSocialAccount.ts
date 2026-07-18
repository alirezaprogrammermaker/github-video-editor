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
    caption_template: string | null;
    language: string | null;
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
        caption_template?: string;
        language?: string;
        raw_data?: string;
    }) {
        const existing = await this.findByAccountId(data.account_id);
        if (existing) {
            await this.updateWhere(
                { account_id: data.account_id },
                {
                    platform: data.platform,
                    username: data.username ?? null,
                    display_name: data.display_name ?? null,
                    profile_image: data.profile_image ?? null,
                    status: data.status ?? 'active',
                    caption_template: data.caption_template ?? existing.caption_template,
                    language: data.language ?? existing.language,
                    raw_data: data.raw_data ?? null,
                    synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }
            );
        } else {
            await this.create({
                id: `sa_${data.account_id}`,
                ...data,
                status: data.status ?? 'active',
                caption_template: data.caption_template ?? '{caption}',
                language: data.language ?? 'fa',
                raw_data: data.raw_data ?? null,
                synced_at: new Date().toISOString(),
            });
        }
    }

    static async deleteByAccountId(account_id: string) {
        await this.deleteWhere({ account_id });
    }

    static renderCaption(template: string | null, caption: string): string {
        if (!template) return caption;
        return template.replace(/\{caption\}/g, caption);
    }
}
