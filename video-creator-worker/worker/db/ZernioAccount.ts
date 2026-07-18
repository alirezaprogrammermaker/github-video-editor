import { Model } from './Model';

export interface ZernioAccountRow {
    id: string;
    user_id: string;
    name: string;
    api_key: string;
    created_at?: string;
    updated_at?: string;
}

export class ZernioAccount extends Model<ZernioAccountRow> {
    protected static table = 'zernio_accounts';

    static async updateApiKey(id: string, name: string, api_key: string) {
        await this.db
            .prepare(`UPDATE ${this.table} SET name = ?, api_key = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(name, api_key, id)
            .run();
    }

    static async findByUserId(user_id: string) {
        return this.where<ZernioAccountRow>('user_id', user_id);
    }

    static async findByApiKey(api_key: string) {
        return this.findBy<ZernioAccountRow>('api_key', api_key);
    }
}
