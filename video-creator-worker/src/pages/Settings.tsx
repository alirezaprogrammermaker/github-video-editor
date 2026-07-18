import { useEffect, useState } from 'react';
import {
    Card, Input, Button, Typography, Space, Tag, Descriptions, Switch,
    Table, message, Row, Col,
} from 'antd';
import {
    SaveOutlined, LinkOutlined, DeleteOutlined, InfoCircleOutlined,
    PlusOutlined, MinusCircleOutlined, GithubOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { TextArea } = Input;

interface BotCommand {
    command: string;
    description: string;
}

export function Settings() {
    const defaultWebhookUrl = `${window.location.origin}/api/telegram/webhook`;
    const [token, setToken] = useState('');
    const [webhookUrl, setWebhookUrl] = useState(defaultWebhookUrl);
    const [botInfo, setBotInfo] = useState<Record<string, any> | null>(null);
    const [webhookInfo, setWebhookInfo] = useState<Record<string, any> | null>(null);
    const [registrationDisabled, setRegistrationDisabled] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);

    const [botName, setBotName] = useState('');
    const [botShortDesc, setBotShortDesc] = useState('');
    const [botDesc, setBotDesc] = useState('');
    const [botCommands, setBotCommands] = useState<BotCommand[]>([]);
    const [newCmd, setNewCmd] = useState('');
    const [newCmdDesc, setNewCmdDesc] = useState('');

    // GitHub settings
    const [githubRepo, setGithubRepo] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [githubWorkflow, setGithubWorkflow] = useState('video-edit.yml');
    const [githubBranch, setGithubBranch] = useState('main');
    const [githubHasToken, setGithubHasToken] = useState(false);

    useEffect(() => {
        fetch('/api/dashboard/settings', { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
                if (data.token) setToken(data.token);
                if (data.botInfo) setBotInfo(data.botInfo);
                if (data.registrationDisabled) setRegistrationDisabled(data.registrationDisabled);
                if (data.botName) setBotName(data.botName);
                if (data.botShortDescription) setBotShortDesc(data.botShortDescription);
                if (data.botDescription) setBotDesc(data.botDescription);
                if (data.botCommands) setBotCommands(data.botCommands);
            });

        fetch('/api/dashboard/github-settings', { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
                if (data.repo) setGithubRepo(data.repo);
                if (data.hasToken) setGithubHasToken(true);
                if (data.workflow) setGithubWorkflow(data.workflow);
                if (data.branch) setGithubBranch(data.branch);
            });
    }, []);

    async function apiPut(endpoint: string, body: Record<string, any>, successMsg: string, loadingKey: string) {
        setLoading(loadingKey);
        try {
            const res = await fetch(`/api/dashboard/settings/${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success(successMsg);
        } catch {
            message.error('خطای شبکه');
        } finally {
            setLoading(null);
        }
    }

    async function saveToken() {
        if (!token.trim()) return;
        setLoading('token');
        try {
            const res = await fetch('/api/dashboard/settings/token', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success(`بات ${data.botInfo.first_name} ذخیره شد`);
            setBotInfo(data.botInfo);
        } finally {
            setLoading(null);
        }
    }

    async function setWebhook() {
        if (!webhookUrl.trim()) return message.error('آدرس وب‌هوک را وارد کنید');
        setLoading('webhook');
        try {
            const res = await fetch('/api/dashboard/settings/webhook/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ url: webhookUrl }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('وب‌هوک تنظیم شد');
        } catch {
            message.error('خطای شبکه');
        } finally {
            setLoading(null);
        }
    }

    async function deleteWebhook() {
        setLoading('webhook');
        try {
            const res = await fetch('/api/dashboard/settings/webhook/delete', {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('وب‌هوک حذف شد');
            setWebhookInfo(null);
        } catch {
            message.error('خطای شبکه');
        } finally {
            setLoading(null);
        }
    }

    async function fetchWebhookInfo() {
        setLoading('info');
        try {
            const res = await fetch('/api/dashboard/settings/webhook/info', { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            setWebhookInfo(data);
        } catch {
            message.error('خطای شبکه');
        } finally {
            setLoading(null);
        }
    }

    async function toggleRegistration(checked: boolean) {
        setLoading('registration');
        try {
            const res = await fetch('/api/dashboard/settings/registration', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ disabled: checked }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            setRegistrationDisabled(data.registrationDisabled);
            message.success(data.registrationDisabled ? 'ثبت نام غیرفعال شد' : 'ثبت نام فعال شد');
        } finally {
            setLoading(null);
        }
    }

    function addCommand() {
        if (!newCmd.trim() || !newCmdDesc.trim()) return message.error('فیلدها را پر کنید');
        setBotCommands((prev) => [...prev, { command: newCmd.trim(), description: newCmdDesc.trim() }]);
        setNewCmd('');
        setNewCmdDesc('');
    }

    async function saveGithubSettings() {
        setLoading('github');
        try {
            const res = await fetch('/api/dashboard/github-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    repo: githubRepo,
                    token: githubToken || undefined,
                    workflow: githubWorkflow,
                    branch: githubBranch,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('تنظیمات GitHub ذخیره شد');
            if (githubToken) setGithubHasToken(true);
        } catch {
            message.error('خطای شبکه');
        } finally {
            setLoading(null);
        }
    }

    function removeCommand(index: number) {
        setBotCommands((prev) => prev.filter((_, i) => i !== index));
    }

    const commandColumns: ColumnsType<BotCommand> = [
        { title: 'دستور', dataIndex: 'command', render: (v) => `/${v}` },
        { title: 'توضیحات', dataIndex: 'description' },
        {
            title: '',
            width: 40,
            render: (_, __, index) => (
                <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeCommand(index)} />
            ),
        },
    ];

    return (
        <div>
            <h2 style={{ marginBottom: 24 }}>تنظیمات</h2>

            <Row gutter={[24, 24]}>
                {/* Left Column */}
                <Col xs={24} lg={12}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {/* Token */}
                        <Card title="توکن ربات تلگرام">
                            <Space.Compact style={{ width: '100%' }}>
                                <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="توکن ربات را وارد کنید" />
                                <Button type="primary" icon={<SaveOutlined />} loading={loading === 'token'} onClick={saveToken}>
                                    ذخیره
                                </Button>
                            </Space.Compact>
                            {botInfo && (
                                <Descriptions size="small" column={1} style={{ marginTop: 12 }}>
                                    <Descriptions.Item label="نام">{botInfo.first_name}</Descriptions.Item>
                                    <Descriptions.Item label="نام کاربری">@{botInfo.username}</Descriptions.Item>
                                    <Descriptions.Item label="ID">{botInfo.id}</Descriptions.Item>
                                </Descriptions>
                            )}
                        </Card>

                        {/* Bot Name */}
                        <Card title="نام ربات">
                            <Space.Compact style={{ width: '100%' }}>
                                <Input value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="نام ربات" />
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    loading={loading === 'bot-name'}
                                    onClick={() => apiPut('bot-name', { name: botName }, 'نام ربات ذخیره شد', 'bot-name')}
                                >
                                    ذخیره
                                </Button>
                            </Space.Compact>
                        </Card>

                        {/* Short Description */}
                        <Card title="توضیح کوتاه ربات">
                            <Space.Compact style={{ width: '100%' }}>
                                <Input value={botShortDesc} onChange={(e) => setBotShortDesc(e.target.value)} placeholder="توضیح کوتاه" />
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    loading={loading === 'bot-short-desc'}
                                    onClick={() => apiPut('bot-short-description', { shortDescription: botShortDesc }, 'توضیح کوتاه ذخیره شد', 'bot-short-desc')}
                                >
                                    ذخیره
                                </Button>
                            </Space.Compact>
                        </Card>

                        {/* Description */}
                        <Card title="توضیحات ربات">
                            <Space.Compact style={{ width: '100%' }} direction="vertical">
                                <TextArea
                                    rows={3}
                                    value={botDesc}
                                    onChange={(e) => setBotDesc(e.target.value)}
                                    placeholder="توضیحات کامل ربات"
                                />
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    loading={loading === 'bot-desc'}
                                    onClick={() => apiPut('bot-description', { description: botDesc }, 'توضیحات ذخیره شد', 'bot-desc')}
                                >
                                    ذخیره
                                </Button>
                            </Space.Compact>
                        </Card>
                    </Space>
                </Col>

                {/* Right Column */}
                <Col xs={24} lg={12}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {/* Commands */}
                        <Card title="دستورات ربات">
                            {botCommands.length > 0 && (
                                <Table
                                    dataSource={botCommands}
                                    columns={commandColumns}
                                    rowKey={(_, i) => String(i)}
                                    pagination={false}
                                    size="small"
                                    style={{ marginBottom: 12 }}
                                />
                            )}
                            <Space.Compact style={{ width: '100%' }}>
                                <Input value={newCmd} onChange={(e) => setNewCmd(e.target.value)} placeholder="دستور" style={{ width: '30%' }} />
                                <Input value={newCmdDesc} onChange={(e) => setNewCmdDesc(e.target.value)} placeholder="توضیحات دستور" onPressEnter={addCommand} />
                                <Button icon={<PlusOutlined />} onClick={addCommand} />
                            </Space.Compact>
                            <div style={{ marginTop: 12 }}>
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    loading={loading === 'bot-commands'}
                                    onClick={() => apiPut('bot-commands', { commands: botCommands }, 'دستورات ذخیره شد', 'bot-commands')}
                                >
                                    ذخیره دستورات
                                </Button>
                            </div>
                        </Card>

                        {/* Webhook */}
                        <Card title="وب‌هوک">
                            <Space.Compact style={{ width: '100%' }}>
                                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/api/telegram/webhook" />
                                <Button type="primary" icon={<LinkOutlined />} loading={loading === 'webhook'} onClick={setWebhook}>
                                    تنظیم
                                </Button>
                            </Space.Compact>
                            <Space style={{ marginTop: 12 }}>
                                <Button danger icon={<DeleteOutlined />} loading={loading === 'webhook'} onClick={deleteWebhook}>
                                    حذف وب‌هوک
                                </Button>
                                <Button icon={<InfoCircleOutlined />} loading={loading === 'info'} onClick={fetchWebhookInfo}>
                                    اطلاعات
                                </Button>
                            </Space>
                            {webhookInfo && (
                                <Descriptions size="small" column={1} style={{ marginTop: 12 }}>
                                    <Descriptions.Item label="URL">
                                        <Text copyable>{webhookInfo.url || 'تنظیم نشده'}</Text>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="آخرین خطا">
                                        {webhookInfo.last_error_message ? (
                                            <Tag color="error">{webhookInfo.last_error_message}</Tag>
                                        ) : (
                                            <Tag color="success">بدون خطا</Tag>
                                        )}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Pending updates">
                                        {webhookInfo.pending_update_count ?? 0}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="SHA256">
                                        <Text code copyable>{webhookInfo.secret_token || '-'}</Text>
                                    </Descriptions.Item>
                                </Descriptions>
                            )}
                        </Card>

                        {/* Registration */}
                        <Card title="تنظیمات ثبت نام">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>غیرفعال کردن صفحه ثبت نام</span>
                                <Switch
                                    checked={registrationDisabled}
                                    loading={loading === 'registration'}
                                    onChange={toggleRegistration}
                                    checkedChildren="غیرفعال"
                                    unCheckedChildren="فعال"
                                />
                            </div>
                        </Card>

                        {/* GitHub Workflow */}
                        <Card title={<Space><GithubOutlined /> تنظیمات GitHub Workflow</Space>}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Input
                                    value={githubRepo}
                                    onChange={(e) => setGithubRepo(e.target.value)}
                                    placeholder="owner/repo (مثلا: myorg/myrepo)"
                                    addonBefore="Repo"
                                />
                                <Input.Password
                                    value={githubToken}
                                    onChange={(e) => setGithubToken(e.target.value)}
                                    placeholder={githubHasToken ? 'توکن ذخیره شده (برای تغییر وارد کنید)' : 'GitHub Token (ghp_...)'}
                                    addonBefore="Token"
                                />
                                <Input
                                    value={githubWorkflow}
                                    onChange={(e) => setGithubWorkflow(e.target.value)}
                                    placeholder="video-edit.yml"
                                    addonBefore="Workflow"
                                />
                                <Input
                                    value={githubBranch}
                                    onChange={(e) => setGithubBranch(e.target.value)}
                                    placeholder="main"
                                    addonBefore="Branch"
                                />
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    loading={loading === 'github'}
                                    onClick={saveGithubSettings}
                                >
                                    ذخیره تنظیمات GitHub
                                </Button>
                            </Space>
                        </Card>
                    </Space>
                </Col>
            </Row>
        </div>
    );
}
