import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Select, message, Card, Spin, Space, Typography, Divider, Tag, Modal } from 'antd';
import { SaveOutlined, ArrowRightOutlined, PlayCircleOutlined, ClearOutlined, RocketOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { VideoStatus } from '../constants/video-status';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface VideoData {
    id: string;
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
    status: string;
    created_at: string;
}

interface TemplateField {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select';
    options?: string[];
    placeholder?: string;
}

interface Template {
    id: string;
    name: string;
    description: string | null;
    fields: TemplateField[];
}

export function VideoEdit() {
    const { shortcode } = useParams<{ shortcode: string }>();
    const navigate = useNavigate();
    const [video, setVideo] = useState<VideoData | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [building, setBuilding] = useState(false);
    const [deletingRelease, setDeletingRelease] = useState(false);
    const [playerOpen, setPlayerOpen] = useState(false);
    const [playerUrl, setPlayerUrl] = useState<string>('');
    const [form] = Form.useForm();

    async function fetchVideo() {
        if (!shortcode) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/videos/${shortcode}`, { credentials: 'include' });
            if (!res.ok) {
                message.error('ویدیو یافت نشد');
                navigate('/videos');
                return;
            }
            const data = await res.json();
            setVideo(data);
        } finally {
            setLoading(false);
        }
    }

    async function fetchTemplates() {
        try {
            const res = await fetch('/api/videos/templates', { credentials: 'include' });
            const data = await res.json();
            setTemplates(data);
        } catch {}
    }

    useEffect(() => {
        fetchVideo();
        fetchTemplates();
    }, [shortcode]);

    // Set form values when video and templates are loaded
    useEffect(() => {
        if (!video || templates.length === 0) return;

        // Find the template (use video's template_id or default)
        let tpl: Template | null = null;
        if (video.template_id) {
            tpl = templates.find(t => t.id === video.template_id) || null;
        }
        if (!tpl) {
            tpl = templates.find(t => t.id === 'default') || templates[0] || null;
        }

        if (tpl) {
            setSelectedTemplate(tpl);
            // Set form values including template fields
            const formValues: Record<string, any> = {
                user_caption: video.user_caption || video.original_caption || '',
                template_id: tpl.id,
                status: video.status,
            };

            // Map video fields to template field names
            if (tpl.id === 'default') {
                formValues.static_text = video.text_on_video || '';
                formValues.marquee_text = video.animated_text || '';
                formValues.watermark_text = video.watermark || '';
            } else {
                // For custom templates, try to match by field names
                tpl.fields.forEach(f => {
                    if (f.name === 'static_text') formValues[f.name] = video.text_on_video || '';
                    else if (f.name === 'marquee_text') formValues[f.name] = video.animated_text || '';
                    else if (f.name === 'watermark_text') formValues[f.name] = video.watermark || '';
                    else formValues[f.name] = '';
                });
            }

            form.setFieldsValue(formValues);
        } else {
            form.setFieldsValue({
                user_caption: video.user_caption || video.original_caption || '',
                template_id: '',
                status: video.status,
            });
        }
    }, [video, templates]);

    function handleTemplateChange(templateId: string) {
        const tpl = templates.find(t => t.id === templateId);
        setSelectedTemplate(tpl || null);

        // Clear and set template-specific fields
        if (tpl) {
            const values: Record<string, any> = {};
            tpl.fields.forEach(f => {
                values[f.name] = '';
            });
            form.setFieldsValue(values);
        }
    }

    async function handleSave() {
        try {
            const values = await form.validateFields();
            setSaving(true);

            const templateData: Record<string, string> = {};
            if (selectedTemplate) {
                selectedTemplate.fields.forEach(f => {
                    templateData[f.name] = values[f.name] || '';
                });
            }

            const res = await fetch(`/api/videos/${shortcode}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    user_caption: values.user_caption,
                    template_id: values.template_id || null,
                    template_data: templateData,
                    status: values.status,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('ویدیو بروزرسانی شد');
            fetchVideo();
        } catch {
            // validation error
        } finally {
            setSaving(false);
        }
    }

    async function handleBuild() {
        try {
            const values = await form.validateFields();
            setBuilding(true);

            const templateData: Record<string, string> = {};
            if (selectedTemplate) {
                selectedTemplate.fields.forEach(f => {
                    templateData[f.name] = values[f.name] || '';
                });
            }

            const res = await fetch(`/api/videos/${shortcode}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    user_caption: values.user_caption,
                    template_id: values.template_id || null,
                    template_data: templateData,
                    status: VideoStatus.BUILDING,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('در حال ارسال به workflow...');
            fetchVideo();
        } catch {
            // validation error
        } finally {
            setBuilding(false);
        }
    }

    async function handleCheckStatus() {
        try {
            const res = await fetch(`/api/videos/check-workflow/${shortcode}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            if (data.status === VideoStatus.READY) {
                message.success('ویدیو آماده شد!');
            } else if (data.status === 'in_progress') {
                message.info('Workflow هنوز در حال اجراست...');
            } else if (data.status === VideoStatus.FAILED) {
                message.error('Workflow با خطا مواجه شد');
            } else {
                message.info(data.message || 'وضعیت بروزرسانی شد');
            }
            fetchVideo();
        } catch {
            message.error('خطا در بررسی وضعیت');
        }
    }

    async function handleDeleteRelease() {
        Modal.confirm({
            title: 'حذف Release و Tag',
            content: 'آیا مطمئن هستید که می‌خواهید release و tag این ویدیو را از GitHub پاک کنید؟',
            okText: 'بله، پاک شود',
            okType: 'danger',
            cancelText: 'انصراف',
            onOk: async () => {
                try {
                    setDeletingRelease(true);
                    const res = await fetch(`/api/videos/${shortcode}/delete-release`, {
                        method: 'POST',
                        credentials: 'include',
                    });
                    const data = await res.json();
                    if (!res.ok) return message.error(data.error);
                    message.success(data.message || 'Release با موفقیت حذف شد');
                    fetchVideo();
                } catch {
                    message.error('خطا در حذف release');
                } finally {
                    setDeletingRelease(false);
                }
            },
        });
    }

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    if (!video) return null;

    return (
        <div style={{ padding: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <Title level={3} style={{ margin: 0 }}>ویرایش ویدیو</Title>
                <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/videos')}>
                    بازگشت به لیست
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {/* Video Preview */}
                <Card>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Space wrap>
                            <Tag color="blue">{video.shortcode}</Tag>
                            <Tag color={
                                video.status === VideoStatus.READY ? 'green' :
                                video.status === VideoStatus.BUILDING ? 'processing' :
                                video.status === VideoStatus.READY_FOR_PUBLISH ? 'cyan' :
                                video.status === VideoStatus.FAILED ? 'red' :
                                video.status === VideoStatus.PUBLISHED ? 'purple' : 'default'
                            }>
                                {video.status === VideoStatus.READY ? 'آماده' :
                                 video.status === VideoStatus.BUILDING ? 'در حال ساخت' :
                                 video.status === VideoStatus.READY_FOR_PUBLISH ? 'آماده انتشار' :
                                 video.status === VideoStatus.FAILED ? 'ناموفق' :
                                 video.status === VideoStatus.PUBLISHED ? 'منتشر شده' : 'در انتظار'}
                            </Tag>
                        </Space>

                        <Space>
                            <Button
                                type="primary"
                                icon={<PlayCircleOutlined />}
                                onClick={() => window.open(video.proxied_url, '_blank')}
                            >
                                پخش ویدیو
                            </Button>
                            {video.output_url && (
                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    onClick={() => { setPlayerUrl(video.output_url!); setPlayerOpen(true); }}
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                >
                                    پخش ویدیوی ساخته شده
                                </Button>
                            )}
                        </Space>

                        <div>
                            <Text type="secondary">کپشن اصلی:</Text>
                            <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0 }}>
                                {video.original_caption || 'بدون کپشن'}
                            </Paragraph>
                        </div>

                        {video.build_log && (
                            <div>
                                <Text type="secondary">لاگ ساخت:</Text>
                                <Paragraph ellipsis={{ rows: 1, expandable: true }} style={{ margin: 0, fontSize: 12 }}>
                                    {video.build_log}
                                </Paragraph>
                            </div>
                        )}
                    </Space>
                </Card>

                {/* Edit Form */}
                <Card>
                    <Form form={form} layout="vertical">
                        <Form.Item name="user_caption" label={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>کپشن پست</span>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ClearOutlined />}
                                    onClick={() => form.setFieldValue('user_caption', '')}
                                >
                                    پاک کردن
                                </Button>
                            </div>
                        }>
                            <TextArea
                                placeholder="کپشن مورد نظر را وارد کنید"
                                autoSize={{ minRows: 4, maxRows: 8 }}
                            />
                        </Form.Item>

                        <Form.Item name="template_id" label="قالب ویدیو">
                            <Select
                                placeholder="انتخاب قالب"
                                allowClear
                                onChange={handleTemplateChange}
                                options={templates.map(t => ({
                                    label: t.name,
                                    value: t.id,
                                }))}
                            />
                        </Form.Item>

                        {/* Template-specific fields */}
                        {selectedTemplate && selectedTemplate.fields.map(field => (
                            <Form.Item key={field.name} name={field.name} label={field.label}>
                                {field.type === 'textarea' ? (
                                    <TextArea
                                        placeholder={field.placeholder}
                                        autoSize={{ minRows: 2, maxRows: 4 }}
                                    />
                                ) : field.type === 'select' ? (
                                    <Select
                                        placeholder={field.placeholder}
                                        options={field.options?.map(o => ({ label: o, value: o }))}
                                    />
                                ) : (
                                    <Input placeholder={field.placeholder} />
                                )}
                            </Form.Item>
                        ))}

                        <Form.Item name="status" label="وضعیت">
                            <Select
                                options={[
                                    { label: 'در انتظار', value: VideoStatus.PENDING },
                                    { label: 'آماده', value: VideoStatus.READY },
                                    { label: 'منتشر شده', value: VideoStatus.PUBLISHED },
                                ]}
                            />
                        </Form.Item>

                        <Divider />

                        <Space wrap>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleSave}
                                loading={saving}
                            >
                                ذخیره تغییرات
                            </Button>
                            <Button
                                type="primary"
                                icon={<RocketOutlined />}
                                onClick={handleBuild}
                                loading={building}
                                disabled={video.status === VideoStatus.BUILDING}
                                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                            >
                                {video.status === VideoStatus.BUILDING ? 'در حال ساخت...' : 'ساخت ویدیو'}
                            </Button>
                            {video.status === VideoStatus.BUILDING && (
                                <Button
                                    icon={<ReloadOutlined />}
                                    onClick={handleCheckStatus}
                                >
                                    بروزرسانی وضعیت
                                </Button>
                            )}
                            {video.proxied_url && (
                                <Button
                                    icon={<PlayCircleOutlined />}
                                    onClick={() => window.open(video.proxied_url, '_blank')}
                                >
                                    پیش‌نمایش
                                </Button>
                            )}
                            {video.output_url && (
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={handleDeleteRelease}
                                    loading={deletingRelease}
                                >
                                    حذف Release
                                </Button>
                            )}
                        </Space>
                    </Form>
                </Card>
            </div>

            <Modal
                open={playerOpen}
                title="پخش ویدیو"
                footer={null}
                onCancel={() => setPlayerOpen(false)}
                width={720}
                destroyOnClose
            >
                {playerUrl && (
                    <video
                        controls
                        autoPlay
                        style={{ width: '100%', borderRadius: 8 }}
                        src={playerUrl}
                    />
                )}
            </Modal>
        </div>
    );
}
