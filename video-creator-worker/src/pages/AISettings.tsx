import { useEffect, useState } from 'react';
import {
    Card, Input, Button, Typography, Space, Switch, Select, InputNumber,
    message, Row, Col, Table, Spin, Tag,
} from 'antd';
import {
    SaveOutlined, RobotOutlined, SendOutlined, BarChartOutlined,
    DatabaseOutlined, SafetyOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { TextArea } = Input;

interface AiSettings {
    enabled: string;
    system_prompt: string;
    model: string;
    max_tokens: string;
    temperature: string;
    daily_limit: string;
    allowed_tables: string;
}

interface AiUsageStat {
    user_role: string;
    date: string;
    total_tokens: number;
    total_requests: number;
}

interface AllSettings {
    admin: AiSettings;
    user: AiSettings;
}

const AI_MODELS = [
    { value: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (پیشنهادی)' },
    { value: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B (بالاترین کیفیت)' },
    { value: '@cf/mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1 24B' },
    { value: '@cf/meta/llama-3.2-3b-instruct', label: 'Llama 3.2 3B (سبک و سریع)' },
    { value: '@cf/qwen/qwen3-30b-a3b-fp8', label: 'Qwen3 30B' },
    { value: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 32B' },
];

const AVAILABLE_TABLES = [
    { value: 'users', label: 'کاربران سیستم (users)' },
    { value: 'sessions', label: 'نشست‌ها (sessions)' },
    { value: 'settings', label: 'تنظیمات (settings)' },
    { value: 'telegram_users', label: 'کاربران تلگرام (telegram_users)' },
    { value: 'telegram_user_sessions', label: 'نشست‌های تلگرام (telegram_user_sessions)' },
    { value: 'bot_channels', label: 'کانال‌های ربات (bot_channels)' },
    { value: 'telegram_bot_helps', label: 'راهنمای ربات (telegram_bot_helps)' },
    { value: 'ai_settings', label: 'تنظیمات هوش مصنوعی (ai_settings)' },
    { value: 'ai_role_settings', label: 'تنظیمات نقش AI (ai_role_settings)' },
    { value: 'ai_usage_log', label: 'لاگ استفاده AI (ai_usage_log)' },
];

function SettingsPanel({
    title,
    icon,
    roleKey,
    settings,
    onSave,
}: {
    title: string;
    icon: React.ReactNode;
    roleKey: 'admin' | 'user';
    settings: AiSettings;
    onSave: (role: 'admin' | 'user', values: Record<string, string>) => Promise<void>;
}) {
    const [local, setLocal] = useState<AiSettings>(settings);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLocal(settings);
    }, [settings]);

    const update = (key: keyof AiSettings, value: string) => {
        setLocal((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(roleKey, local as unknown as Record<string, string>);
            message.success(`${title} ذخیره شد`);
        } catch {
            message.error('خطا در ذخیره‌سازی');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card
            title={
                <Space>
                    {icon}
                    <span>{title}</span>
                </Space>
            }
            extra={
                <Switch
                    checked={local.enabled === 'true'}
                    onChange={(checked) => update('enabled', checked ? 'true' : 'false')}
                    checkedChildren="فعال"
                    unCheckedChildren="غیرفعال"
                />
            }
        >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                    <Text strong>پرامپت سیستم (System Prompt):</Text>
                    <TextArea
                        rows={4}
                        value={local.system_prompt}
                        onChange={(e) => update('system_prompt', e.target.value)}
                        placeholder="پرامپت سیستم هوش مصنوعی را وارد کنید..."
                        style={{ marginTop: 8 }}
                    />
                </div>

                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Text strong>مدل هوش مصنوعی:</Text>
                        <Select
                            value={local.model}
                            onChange={(value) => update('model', value)}
                            options={AI_MODELS}
                            style={{ width: '100%', marginTop: 8 }}
                        />
                    </Col>
                    <Col xs={12} md={6}>
                        <Text strong>حداکثر توکن:</Text>
                        <InputNumber
                            value={parseInt(local.max_tokens || '512', 10)}
                            onChange={(value) => update('max_tokens', String(value || 512))}
                            min={64}
                            max={4096}
                            style={{ width: '100%', marginTop: 8 }}
                        />
                    </Col>
                    <Col xs={12} md={6}>
                        <Text strong>دما (Temperature):</Text>
                        <InputNumber
                            value={parseFloat(local.temperature || '0.7')}
                            onChange={(value) => update('temperature', String(value || 0.7))}
                            min={0}
                            max={2}
                            step={0.1}
                            style={{ width: '100%', marginTop: 8 }}
                        />
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Text strong>محدودیت روزانه (درخواست):</Text>
                        <InputNumber
                            value={parseInt(local.daily_limit || '0', 10)}
                            onChange={(value) => update('daily_limit', String(value || 0))}
                            min={0}
                            max={10000}
                            style={{ width: '100%', marginTop: 8 }}
                            addonAfter="درخواست/روز"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>0 = بدون محدودیت</Text>
                    </Col>
                    <Col xs={24} md={12}>
                        <Text strong>جدول‌های مجاز دیتابیس:</Text>
                        <Select
                            mode="multiple"
                            value={local.allowed_tables ? JSON.parse(local.allowed_tables) : []}
                            onChange={(values) => update('allowed_tables', JSON.stringify(values))}
                            options={AVAILABLE_TABLES}
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="جدول‌های مجاز را انتخاب کنید"
                            maxTagCount="responsive"
                        />
                    </Col>
                </Row>

                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSave}
                    block
                >
                    ذخیره تنظیمات {title}
                </Button>
            </Space>
        </Card>
    );
}

export function AISettings() {
    const [allSettings, setAllSettings] = useState<AllSettings>({
        admin: {
            enabled: 'true',
            system_prompt: '',
            model: '@cf/meta/llama-4-scout-17b-16e-instruct',
            max_tokens: '1024',
            temperature: '0.7',
            daily_limit: '100',
            allowed_tables: '[]',
        },
        user: {
            enabled: 'true',
            system_prompt: '',
            model: '@cf/meta/llama-4-scout-17b-16e-instruct',
            max_tokens: '512',
            temperature: '0.7',
            daily_limit: '20',
            allowed_tables: '[]',
        },
    });
    const [loading, setLoading] = useState(true);
    const [usageStats, setUsageStats] = useState<AiUsageStat[]>([]);
    const [testMessage, setTestMessage] = useState('');
    const [testResponse, setTestResponse] = useState('');
    const [testLoading, setTestLoading] = useState(false);
    const [testRole, setTestRole] = useState<'admin' | 'user'>('admin');

    useEffect(() => {
        fetchSettings();
        fetchUsageStats();
    }, []);

    async function fetchSettings() {
        setLoading(true);
        try {
            const res = await fetch('/api/ai/settings', { credentials: 'include' });
            const data = await res.json();
            if (data.admin || data.user) {
                setAllSettings({
                    admin: {
                        enabled: data.admin?.enabled ?? 'true',
                        system_prompt: data.admin?.system_prompt ?? '',
                        model: data.admin?.model ?? '@cf/meta/llama-3.1-8b-instruct',
                        max_tokens: data.admin?.max_tokens ?? '1024',
                        temperature: data.admin?.temperature ?? '0.7',
                        daily_limit: data.admin?.daily_limit ?? '100',
                        allowed_tables: data.admin?.allowed_tables ?? '[]',
                    },
                    user: {
                        enabled: data.user?.enabled ?? 'true',
                        system_prompt: data.user?.system_prompt ?? '',
                        model: data.user?.model ?? '@cf/meta/llama-3.1-8b-instruct',
                        max_tokens: data.user?.max_tokens ?? '512',
                        temperature: data.user?.temperature ?? '0.7',
                        daily_limit: data.user?.daily_limit ?? '20',
                        allowed_tables: data.user?.allowed_tables ?? '[]',
                    },
                });
            }
        } catch {
            message.error('خطا در دریافت تنظیمات');
        } finally {
            setLoading(false);
        }
    }

    async function fetchUsageStats() {
        try {
            const res = await fetch('/api/ai/usage', { credentials: 'include' });
            const data = await res.json();
            setUsageStats(data);
        } catch {}
    }

    async function handleSaveSettings(role: 'admin' | 'user', values: Record<string, string>) {
        const res = await fetch(`/api/ai/settings/${role}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(values),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        fetchSettings();
        fetchUsageStats();
    }

    async function handleTestChat() {
        if (!testMessage.trim()) return message.error('پیام را وارد کنید');
        setTestLoading(true);
        setTestResponse('');
        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: testMessage, role: testRole }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            setTestResponse(data.response);
        } catch {
            message.error('خطا در ارتباط با هوش مصنوعی');
        } finally {
            setTestLoading(false);
        }
    }

    const usageColumns: ColumnsType<AiUsageStat> = [
        {
            title: 'نقش',
            dataIndex: 'user_role',
            render: (v) => <Tag color={v === 'admin' ? 'purple' : 'blue'}>{v === 'admin' ? 'مدیر' : 'کاربر'}</Tag>,
        },
        { title: 'تاریخ', dataIndex: 'date' },
        { title: 'درخواست‌ها', dataIndex: 'total_requests' },
        { title: 'توکن مصرف شده', dataIndex: 'total_tokens', render: (v) => v?.toLocaleString() },
    ];

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ marginBottom: 24 }}>
                <Space>
                    <RobotOutlined />
                    <span>تنظیمات هوش مصنوعی</span>
                </Space>
            </h2>

            <Row gutter={[24, 24]}>
                {/* Admin AI Settings */}
                <Col xs={24} lg={12}>
                    <SettingsPanel
                        title="هوش مصنوعی مدیر"
                        icon={<SafetyOutlined style={{ color: '#722ed1' }} />}
                        roleKey="admin"
                        settings={allSettings.admin}
                        onSave={handleSaveSettings}
                    />
                </Col>

                {/* User AI Settings */}
                <Col xs={24} lg={12}>
                    <SettingsPanel
                        title="هوش مصنوعی کاربر"
                        icon={<ThunderboltOutlined style={{ color: '#1677ff' }} />}
                        roleKey="user"
                        settings={allSettings.user}
                        onSave={handleSaveSettings}
                    />
                </Col>

                {/* Test Chat */}
                <Col xs={24}>
                    <Card
                        title={
                            <Space>
                                <SendOutlined />
                                <span>تست هوش مصنوعی</span>
                            </Space>
                        }
                    >
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Space>
                                <Text strong>آزمایش با نقش:</Text>
                                <Select
                                    value={testRole}
                                    onChange={setTestRole}
                                    options={[
                                        { value: 'admin', label: 'مدیر' },
                                        { value: 'user', label: 'کاربر' },
                                    ]}
                                    style={{ width: 120 }}
                                />
                            </Space>
                            <Space.Compact style={{ width: '100%' }}>
                                <TextArea
                                    rows={2}
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    placeholder="پیام خود را برای تست وارد کنید..."
                                    onPressEnter={(e) => {
                                        if (!e.shiftKey) {
                                            e.preventDefault();
                                            handleTestChat();
                                        }
                                    }}
                                />
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    loading={testLoading}
                                    onClick={handleTestChat}
                                >
                                    ارسال
                                </Button>
                            </Space.Compact>
                            {testResponse && (
                                <Card size="small" style={{ background: '#f6f8fa', marginTop: 8 }}>
                                    <Text style={{ whiteSpace: 'pre-wrap' }}>{testResponse}</Text>
                                </Card>
                            )}
                        </Space>
                    </Card>
                </Col>

                {/* Usage Stats */}
                <Col xs={24}>
                    <Card
                        title={
                            <Space>
                                <BarChartOutlined />
                                <span>آمار استفاده (۳۰ روز اخیر)</span>
                            </Space>
                        }
                    >
                        {usageStats.length > 0 ? (
                            <Table
                                dataSource={usageStats}
                                columns={usageColumns}
                                rowKey={(r) => `${r.user_role}-${r.date}`}
                                pagination={{ pageSize: 10 }}
                                size="small"
                            />
                        ) : (
                            <Text type="secondary">هنوز آماری ثبت نشده است.</Text>
                        )}
                    </Card>
                </Col>

                {/* Available Tables Info */}
                <Col xs={24}>
                    <Card
                        title={
                            <Space>
                                <DatabaseOutlined />
                                <span>جدول‌های قابل دسترسی برای هوش مصنوعی</span>
                            </Space>
                        }
                    >
                        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                            جدول‌هایی که هوش مصنوعی می‌تواند به آن‌ها دسترسی داشته باشد را برای هر نقش تنظیم کنید.
                            هوش مصنوعی فقط می‌تواند از داده‌های جدول‌های مجاز برای پاسخگویی استفاده کند.
                        </Text>
                        <Row gutter={[16, 16]}>
                            {AVAILABLE_TABLES.map((t) => (
                                <Col key={t.value} xs={24} sm={12} md={8}>
                                    <Tag icon={<DatabaseOutlined />} color="default" style={{ padding: '4px 12px' }}>
                                        {t.label}
                                    </Tag>
                                </Col>
                            ))}
                        </Row>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
