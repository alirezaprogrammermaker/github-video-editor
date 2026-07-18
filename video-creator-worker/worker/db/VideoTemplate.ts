import { Model } from './Model';

export interface TemplateField {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select';
    options?: string[];
    placeholder?: string;
}

export interface VideoTemplateRow {
    id: string;
    name: string;
    description: string | null;
    fields: string;
    created_at?: string;
    updated_at?: string;
}

export class VideoTemplate extends Model<VideoTemplateRow> {
    protected static table = 'video_templates';

    static getFields(template: VideoTemplateRow): TemplateField[] {
        try {
            return JSON.parse(template.fields);
        } catch {
            return [];
        }
    }

    static async createTemplate(data: {
        name: string;
        description?: string;
        fields: TemplateField[];
    }) {
        const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        return this.create({
            id,
            name: data.name,
            description: data.description ?? null,
            fields: JSON.stringify(data.fields),
        });
    }
}
