import { Model } from './Model';

export interface InstagramDmSessionRow {
    id: string;
    social_account_id: string;
    user_id: string;
    username: string | null;
    display_name: string | null;
    step: string;
    session_data: string | null;
    last_message_at: string;
    created_at?: string;
    updated_at?: string;
}

export class InstagramDmSession extends Model<InstagramDmSessionRow> {
    protected static table = 'instagram_dm_sessions';

    static async findOrCreate(data: {
        social_account_id: string;
        user_id: string;
        username?: string;
        display_name?: string;
    }): Promise<InstagramDmSessionRow> {
        const existing = await this.rawFirst<InstagramDmSessionRow>(
            `SELECT * FROM ${this.table} WHERE social_account_id = ? AND user_id = ?`,
            data.social_account_id,
            data.user_id,
        );

        if (existing) {
            // Update last_message_at and user info
            await this.db
                .prepare(`UPDATE ${this.table} SET last_message_at = datetime('now'), updated_at = datetime('now'), username = ?, display_name = ? WHERE id = ?`)
                .bind(data.username ?? existing.username, data.display_name ?? existing.display_name, existing.id)
                .run();
            return existing;
        }

        const id = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await this.create({
            id,
            ...data,
            username: data.username ?? null,
            display_name: data.display_name ?? null,
            step: 'idle',
            session_data: null,
            last_message_at: new Date().toISOString(),
        });

        return (await this.find(id)) as InstagramDmSessionRow;
    }

    static async updateStep(id: string, step: string, sessionData?: Record<string, any>) {
        const updates: Record<string, any> = {
            step,
            updated_at: new Date().toISOString(),
        };
        if (sessionData !== undefined) {
            updates.session_data = JSON.stringify(sessionData);
        }
        await this.update(id, updates);
    }

    static async resetStep(id: string) {
        await this.updateStep(id, 'idle', undefined);
    }
}
