import { useEffect, useState } from 'react';
import { Table, Button, Popconfirm, Tag, Select, Descriptions, Modal, message } from 'antd';
import { DeleteOutlined, StopOutlined } from '@ant-design/icons';
import { PageHeader } from '../components/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface Session {
    id: number;
    telegram_user_id: number;
    chat_id: number;
    username: string | null;
    first_name: string | null;
    flow: string;
    step: string;
    data: string;
    status: string;
    created_at: string;
    updated_at: string;
}

const statusColors: Record<string, string> = {
    active: 'processing',
    completed: 'success',
    cancelled: 'error',
};

const statusLabels: Record<string, string> = {
    active: 'فعال',
    completed: 'تکمیل شده',
    cancelled: 'لغو شده',
};

const statusOptions = [
    { value: '', label: 'همه' },
    { value: 'active', label: 'فعال' },
    { value: 'completed', label: 'تکمیل شده' },
    { value: 'cancelled', label: 'لغو شده' },
];

export function TelegramUserSessions() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [detail, setDetail] = useState<Session | null>(null);

    async function fetchSessions(status?: string) {
        setLoading(true);
        try {
            const url = status
                ? `/api/dashboard/telegram-sessions?status=${status}`
                : '/api/dashboard/telegram-sessions';
            const res = await fetch(url, { credentials: 'include' });
            setSessions(await res.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchSessions();
    }, []);

    function handleFilterChange(value: string) {
        setFilter(value);
        fetchSessions(value || undefined);
    }

    async function handleDelete(id: number) {
        await fetch(`/api/dashboard/telegram-sessions/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        message.success('حذف شد');
        setSessions((prev) => prev.filter((s) => s.id !== id));
    }

    async function handleCancel(id: number) {
        await fetch(`/api/dashboard/telegram-sessions/${id}/cancel`, {
            method: 'PUT',
            credentials: 'include',
        });
        message.success('نشست لغو شد');
        setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'cancelled' } : s)));
    }

    function parseData(data: string): Record<string, any> {
        try {
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    const columns: ColumnsType<Session> = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: 'Chat ID', dataIndex: 'chat_id' },
        { title: 'نام کاربری', dataIndex: 'username', render: (v) => v ?? '-' },
        { title: 'نام', dataIndex: 'first_name', render: (v) => v ?? '-' },
        { title: 'فロー', dataIndex: 'flow' },
        { title: 'مرحله', dataIndex: 'step', render: (v) => v || '-' },
        {
            title: 'وضعیت',
            dataIndex: 'status',
            render: (status) => (
                <Tag color={statusColors[status] ?? 'default'}>{statusLabels[status] ?? status}</Tag>
            ),
        },
        { title: 'تاریخ ایجاد', dataIndex: 'created_at' },
        {
            title: '',
            width: 100,
            render: (_, record) => (
                <>
                    {record.status === 'active' && (
                        <Popconfirm title="لغو شود؟" onConfirm={() => handleCancel(record.id)}>
                            <Button type="text" icon={<StopOutlined />} />
                        </Popconfirm>
                    )}
                    <Popconfirm title="حذف شود؟" onConfirm={() => handleDelete(record.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </>
            ),
        },
    ];

    return (
        <div>
            <PageHeader
                title="نشست‌های تلگرام"
                extra={
                    <Select
                        value={filter}
                        onChange={handleFilterChange}
                        options={statusOptions}
                        style={{ width: 140 }}
                    />
                }
            />
            <Table
                dataSource={sessions}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 700 }}
                size="small"
                onRow={(record) => ({
                    onClick: () => setDetail(record),
                    style: { cursor: 'pointer' },
                })}
            />
            <Modal
                title={`نشست #${detail?.id}`}
                open={!!detail}
                onCancel={() => setDetail(null)}
                footer={null}
            >
                {detail && (
                    <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="Chat ID">{detail.chat_id}</Descriptions.Item>
                        <Descriptions.Item label="نام کاربری">{detail.username ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="نام">{detail.first_name ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="فロー">{detail.flow}</Descriptions.Item>
                        <Descriptions.Item label="مرحله">{detail.step || '-'}</Descriptions.Item>
                        <Descriptions.Item label="وضعیت">
                            <Tag color={statusColors[detail.status]}>{statusLabels[detail.status]}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="داده‌ها">
                            <pre style={{ margin: 0, fontSize: 12, direction: 'ltr', textAlign: 'left' }}>
                                {JSON.stringify(parseData(detail.data), null, 2)}
                            </pre>
                        </Descriptions.Item>
                        <Descriptions.Item label="تاریخ ایجاد">{detail.created_at}</Descriptions.Item>
                        <Descriptions.Item label="آخرین بروزرسانی">{detail.updated_at}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
}
