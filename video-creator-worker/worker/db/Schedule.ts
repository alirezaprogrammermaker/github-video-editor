import { Model } from './Model';

export interface ScheduleRow {
    id: string;
    social_account_id: string;
    time_slots: string;
    active_days: string;
    is_active: number;
    created_at?: string;
    updated_at?: string;
}

export class Schedule extends Model<ScheduleRow> {
    protected static table = 'social_account_schedules';

    static getTimeSlots(schedule: ScheduleRow): string[] {
        try {
            return JSON.parse(schedule.time_slots);
        } catch {
            return [];
        }
    }

    static getActiveDays(schedule: ScheduleRow): string[] {
        try {
            return JSON.parse(schedule.active_days);
        } catch {
            return ['1', '2', '3', '4', '5', '6', '0'];
        }
    }

    static async findBySocialAccount(social_account_id: string) {
        return this.findBy<ScheduleRow>('social_account_id', social_account_id);
    }

    static async upsertSchedule(data: {
        social_account_id: string;
        time_slots: string[];
        active_days: string[];
        is_active?: boolean;
    }) {
        const existing = await this.findBySocialAccount(data.social_account_id);
        const payload = {
            time_slots: JSON.stringify(data.time_slots),
            active_days: JSON.stringify(data.active_days),
            is_active: data.is_active !== false ? 1 : 0,
            updated_at: new Date().toISOString(),
        };

        if (existing) {
            await this.update(existing.id, payload);
            return existing.id;
        } else {
            const id = `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            await this.create({
                id,
                social_account_id: data.social_account_id,
                ...payload,
            });
            return id;
        }
    }
}
