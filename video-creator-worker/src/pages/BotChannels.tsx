import { useEffect, useState } from 'react';
import { Table, Button, Input, Switch, Popconfirm, Form, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '../components/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface BotChannel {
    id: number;
    channel_id: number;
    channel_username: string;
    channel_title: string;
    is_mandatory: number;
    created_at: string;
}

export function BotChannels() {
    const [channels, setChannels] = useState<BotChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [form] = Form.useForm();

    async function fetchChannels() {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/bot-channels', { credentials: 'include' });
            setChannels(await res.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchChannels();
    }, []);

    async function handleAdd() {
        try {
            const values = await form.validateFields();
            setAdding(true);
            const res = await fetch('/api/dashboard/bot-channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ channel_username: values.channel_username }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('کانال اضافه شد');
            form.resetFields();
            fetchChannels();
        } catch {
            // validation error
        } finally {
            setAdding(false);
        }
    }

    async function handleToggleMandatory(id: number, checked: boolean) {
        const res = await fetch(`/api/dashboard/bot-channels/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ is_mandatory: checked }),
        });
        const data = await res.json();
        if (!res.ok) {
            message.error(data.error);
            return;
        }
        setChannels((prev) =>
            prev.map((ch) => (ch.id === id ? { ...ch, is_mandatory: checked ? 1 : 0 } : ch)),
        );
    }

    async function handleDelete(id: number) {
        await fetch(`/api/dashboard/bot-channels/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        message.success('حذف شد');
        setChannels((prev) => prev.filter((ch) => ch.id !== id));
    }

    const columns: ColumnsType<BotChannel> = [
        { title: 'نام کانال', dataIndex: 'channel_title' },
        { title: 'نام کاربری', dataIndex: 'channel_username', render: (v) => `@${v}` },
        {
            title: 'الزامی',
            dataIndex: 'is_mandatory',
            width: 80,
            render: (val, record) => (
                <Switch
                    checked={val === 1}
                    size="small"
                    onChange={(checked) => handleToggleMandatory(record.id, checked)}
                />
            ),
        },
        {
            title: '',
            width: 40,
            render: (_, record) => (
                <Popconfirm title="حذف شود؟" onConfirm={() => handleDelete(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            ),
        },
    ];

    return (
        <div>
            <PageHeader
                title="کانال‌های ربات"
                extra={
                    <>
                        <Form form={form} layout="inline" style={{ flex: '1 1 250px' }}>
                            <Form.Item name="channel_username" rules={[{ required: true, message: 'نام کاربری الزامی' }]} style={{ flex: '1 1 200px', margin: 0 }}>
                                <Input placeholder="@channel_username" onPressEnter={handleAdd} />
                            </Form.Item>
                        </Form>
                        <Button type="primary" icon={<PlusOutlined />} loading={adding} onClick={handleAdd}>
                            افزودن
                        </Button>
                    </>
                }
            />

            <Table
                dataSource={channels}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={false}
                scroll={{ x: 400 }}
                size="small"
            />
        </div>
    );
}
