import { Model } from './Model';
import { VideoStatus } from '../constants/video-status';

export interface InstagramVideoRow {
    id: string;
    social_account_id: string;
    shortcode: string;
    video_url: string;
    proxied_url: string;
    original_caption: string | null;
    user_caption: string | null;
    text_on_video: string | null;
    animated_text: string | null;
    watermark: string | null;
    template_id: string | null;
    output_url: string | null;
    build_log: string | null;
    published_post_id: string | null;
    status: string;
    scheduled_at: string | null;
    published_at: string | null;
    raw_data: string | null;
    created_at?: string;
    updated_at?: string;
}

export class InstagramVideo extends Model<InstagramVideoRow> {
    protected static table = 'instagram_videos';

    static async findByShortcode(shortcode: string) {
        return this.findBy<InstagramVideoRow>('shortcode', shortcode);
    }

    static async findBySocialAccount(social_account_id: string) {
        return this.where<InstagramVideoRow>('social_account_id', social_account_id);
    }

    static async findByStatus(status: string) {
        return this.where<InstagramVideoRow>('status', status);
    }

    static async createVideo(data: {
        social_account_id: string;
        shortcode: string;
        video_url: string;
        proxied_url: string;
        original_caption?: string;
        raw_data?: string;
    }) {
        const id = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        return this.create({
            id,
            ...data,
            original_caption: data.original_caption ?? null,
            user_caption: null,
            status: VideoStatus.PENDING,
            scheduled_at: null,
            published_at: null,
            raw_data: data.raw_data ?? null,
        });
    }

    static async updateCaption(id: string, userCaption: string) {
        await this.update(id, {
            user_caption: userCaption,
            updated_at: new Date().toISOString(),
        });
    }

    static async updateVideoFields(id: string, fields: {
        text_on_video?: string | null;
        animated_text?: string | null;
        watermark?: string | null;
    }) {
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (fields.text_on_video !== undefined) updates.text_on_video = fields.text_on_video;
        if (fields.animated_text !== undefined) updates.animated_text = fields.animated_text;
        if (fields.watermark !== undefined) updates.watermark = fields.watermark;
        await this.update(id, updates);
    }

    static async updateStatus(id: string, status: string, scheduledAt?: string) {
        const updates: Record<string, any> = {
            status,
            updated_at: new Date().toISOString(),
        };
        if (scheduledAt) updates.scheduled_at = scheduledAt;
        if (status === VideoStatus.PUBLISHED) updates.published_at = new Date().toISOString();
        await this.update(id, updates);
    }
}
