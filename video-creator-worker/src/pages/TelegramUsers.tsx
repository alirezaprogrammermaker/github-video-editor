import { useEffect, useState, useMemo } from 'react';
import { Table, Button, Popconfirm, Select, Tag, message, Space, Modal, Input, InputNumber, Form, Radio } from 'antd';
import { DeleteOutlined, StopOutlined, CheckCircleOutlined, SendOutlined, SearchOutlined } from '@ant-design/icons';
import { PageHeader } from '../components/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface TelegramUser {
    id: number;
    chat_id: number;
    username: string | null;
    first_name: string | null;
    role: string;
    blocked: number;
    block_reason: string | null;
    blocked_at: string | null;
    block_duration_minutes: number | null;
    created_at: string;
}

const roleOptions = [
    { value: 'user', label: 'کاربر' },
    { value: 'admin', label: 'ادمین' },
];

export function TelegramUsers() {
    const [users, setUsers] = useState<TelegramUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [blockModalVisible, setBlockModalVisible] = useState(false);
    const [messageModalVisible, setMessageModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<TelegramUser | null>(null);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [blockForm] = Form.useForm();
    const [messageForm] = Form.useForm();

    async function fetchUsers() {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/telegram-users', { credentials: 'include' });
            setUsers(await res.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        if (!searchText.trim()) return users;
        const search = searchText.toLowerCase();
        return users.filter((u) =>
            String(u.chat_id).includes(search) ||
            (u.username && u.username.toLowerCase().includes(search)) ||
            (u.first_name && u.first_name.toLowerCase().includes(search))
        );
    }, [users, searchText]);

    async function handleDelete(chatId: number) {
        await fetch(`/api/dashboard/telegram-users/${chatId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        message.success('حذف شد');
        setUsers((prev) => prev.filter((u) => u.chat_id !== chatId));
    }

    async function handleRoleChange(chatId: number, role: string) {
        const res = await fetch(`/api/dashboard/telegram-users/${chatId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role }),
        });
        const data = await res.json();
        if (!res.ok) return message.error(data.error);
        message.success('نقش بروزرسانی شد');
        setUsers((prev) => prev.map((u) => (u.chat_id === chatId ? { ...u, role } : u)));
    }

    async function handleBlock() {
        if (!selectedUser) return;
        try {
            const values = await blockForm.validateFields();
            const res = await fetch(`/api/dashboard/telegram-users/${selectedUser.chat_id}/block`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    reason: values.reason || null,
                    duration_minutes: values.duration_minutes || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('کاربر مسدود شد');
            setUsers((prev) => prev.map((u) =>
                u.chat_id === selectedUser.chat_id
                    ? { ...u, blocked: 1, block_reason: values.reason, block_duration_minutes: values.duration_minutes }
                    : u
            ));
            setBlockModalVisible(false);
            blockForm.resetFields();
        } catch {
            // validation error
        }
    }

    async function handleUnblock(chatId: number) {
        const res = await fetch(`/api/dashboard/telegram-users/${chatId}/unblock`, {
            method: 'PUT',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) return message.error(data.error);
        message.success('کاربر رفع مسدودیت شد');
        setUsers((prev) => prev.map((u) =>
            u.chat_id === chatId
                ? { ...u, blocked: 0, block_reason: null, block_duration_minutes: null }
                : u
        ));
    }

    async function handleSendMessage() {
        if (!selectedUser) return;
        try {
            const values = await messageForm.validateFields();
            setSendingMessage(true);
            const res = await fetch(`/api/dashboard/telegram-users/${selectedUser.chat_id}/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    text: values.text,
                    parse_mode: values.parse_mode || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('پیام ارسال شد');
            setMessageModalVisible(false);
            messageForm.resetFields();
        } catch {
            // validation error
        } finally {
            setSendingMessage(false);
        }
    }

    function openBlockModal(user: TelegramUser) {
        setSelectedUser(user);
        setBlockModalVisible(true);
    }

    function openMessageModal(user: TelegramUser) {
        setSelectedUser(user);
        setMessageModalVisible(true);
    }

    function formatDuration(minutes: number | null): string {
        if (!minutes) return 'دائمی';
        if (minutes < 60) return `${minutes} دقیقه`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours < 24) return `${hours} ساعت${mins ? ` و ${mins} دقیقه` : ''}`;
        const days = Math.floor(hours / 24);
        const remainHours = hours % 24;
        return `${days} روز${remainHours ? ` و ${remainHours} ساعت` : ''}`;
    }

    const columns: ColumnsType<TelegramUser> = [
        { title: 'Chat ID', dataIndex: 'chat_id' },
        { title: 'نام کاربری', dataIndex: 'username', render: (v) => v ?? '-' },
        { title: 'نام', dataIndex: 'first_name', responsive: ['md'], render: (v) => v ?? '-' },
        {
            title: 'وضعیت',
            dataIndex: 'blocked',
            width: 120,
            render: (blocked, record) => {
                if (!blocked) return <Tag color="green">فعال</Tag>;
                return (
                    <div>
                        <Tag color="red">مسدود</Tag>
                        {record.block_duration_minutes && (
                            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                {formatDuration(record.block_duration_minutes)}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'علت مسدودیت',
            dataIndex: 'block_reason',
            width: 200,
            responsive: ['lg'],
            render: (v) => v ?? '-',
        },
        {
            title: 'نقش',
            dataIndex: 'role',
            render: (role, record) => (
                <Select
                    value={role}
                    style={{ width: 100 }}
                    options={roleOptions}
                    onChange={(value) => handleRoleChange(record.chat_id, value)}
                />
            ),
        },
        { title: 'تاریخ عضویت', dataIndex: 'created_at', responsive: ['lg'] },
        {
            title: '',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Button
                        type="text"
                        icon={<SendOutlined />}
                        onClick={() => openMessageModal(record)}
                        title="ارسال پیام"
                    />
                    {record.blocked ? (
                        <Button
                            type="text"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleUnblock(record.chat_id)}
                            title="رفع مسدودیت"
                        />
                    ) : (
                        <Button
                            type="text"
                            danger
                            icon={<StopOutlined />}
                            onClick={() => openBlockModal(record)}
                            title="مسدود کردن"
                        />
                    )}
                    <Popconfirm title="حذف شود؟" onConfirm={() => handleDelete(record.chat_id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <PageHeader
                title="کاربران تلگرام"
                extra={
                    <Input
                        placeholder="جستجو..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ maxWidth: 350, flex: '1 1 200px' }}
                        allowClear
                    />
                }
            />
            <Table
                dataSource={filteredUsers}
                columns={columns}
                rowKey="chat_id"
                loading={loading}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 600 }}
                size="small"
            />

            <Modal
                title="مسدود کردن کاربر"
                open={blockModalVisible}
                onCancel={() => {
                    setBlockModalVisible(false);
                    blockForm.resetFields();
                }}
                onOk={handleBlock}
                okText="مسدود کردن"
                cancelText="لغو"
                okButtonProps={{ danger: true }}
            >
                <Form form={blockForm} layout="vertical">
                    <Form.Item name="reason" label="علت مسدودیت">
                        <Input.TextArea placeholder="علت مسدود کردن کاربر..." rows={3} />
                    </Form.Item>
                    <Form.Item name="duration_minutes" label="مدت زمان مسدودیت (دقیقه)">
                        <InputNumber
                            placeholder="خالی = دائمی"
                            min={1}
                            style={{ width: '100%' }}
                            addonAfter="دقیقه"
                        />
                    </Form.Item>
                    <div style={{ color: '#999', fontSize: 12 }}>
                        اگر مدت زمان خالی باشد، کاربر دائمی مسدود می‌شود.
                    </div>
                </Form>
            </Modal>

            <Modal
                title={
                    <div>
                        ارسال پیام به {selectedUser?.first_name || selectedUser?.username || selectedUser?.chat_id}
                    </div>
                }
                open={messageModalVisible}
                onCancel={() => {
                    setMessageModalVisible(false);
                    messageForm.resetFields();
                }}
                onOk={handleSendMessage}
                okText="ارسال"
                cancelText="لغو"
                confirmLoading={sendingMessage}
            >
                <Form form={messageForm} layout="vertical">
                    <Form.Item name="parse_mode" label="فرمت پیام">
                        <Radio.Group>
                            <Radio.Button value="">متن ساده</Radio.Button>
                            <Radio.Button value="HTML">HTML</Radio.Button>
                            <Radio.Button value="Markdown">Markdown</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item name="text" label="متن پیام" rules={[{ required: true, message: 'متن پیام الزامی است' }]}>
                        <Input.TextArea placeholder="متن پیام را بنویسید..." rows={6} />
                    </Form.Item>
                    <div style={{ color: '#999', fontSize: 12 }}>
                        {`مثال HTML: <b>بولد</b> • <i>ایتالیک</i> • <a href="https://example.com">لینک</a>`}
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
