import { Model } from './Model';

export interface BotChannelRow {
    id: number;
    channel_id: number;
    channel_username: string;
    channel_title: string;
    is_mandatory: number;
    created_at: string;
}

export class BotChannel extends Model<BotChannelRow> {
    protected static table = 'bot_channels';

    static async findMandatory(this: any): Promise<BotChannelRow[]> {
        return this.where('is_mandatory', 1);
    }
}
