import { Model } from './Model';

export interface SessionRow {
    id: string;
    user_id: string;
    expires_at: string;
    created_at?: string;
}

export class Session extends Model<SessionRow> {
    protected static table = 'sessions';

    // متد اختصاصی این مدل — چون JOIN لازم داره
    static async findValid(sessionId: string) {
        return this.rawFirst<{ id: string; user_id: string; email: string; role: string }>(
            `SELECT s.id, s.user_id, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
            sessionId
        );
    }
}