import { useEffect, useState } from 'react';
import { Table, Button, Input, InputNumber, Popconfirm, Form, message, Modal } from 'antd';
import { DeleteOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface BotHelp {
    id: number;
    name: string;
    description: string;
    sort_order: number;
    created_at: string;
}

export function BotHelps() {
    const [helps, setHelps] = useState<BotHelp[]>([]);
    const [loading, setLoading] = useState(true);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editing, setEditing] = useState<BotHelp | null>(null);
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();
    const [createLoading, setCreateLoading] = useState(false);
    const [editLoading, setEditLoading] = useState(false);

    async function fetchHelps() {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/bot-helps', { credentials: 'include' });
            setHelps(await res.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchHelps();
    }, []);

    async function handleCreate() {
        try {
            const values = await createForm.validateFields();
            setCreateLoading(true);
            const res = await fetch('/api/dashboard/bot-helps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: values.name,
                    description: values.description,
                    sort_order: values.sort_order ?? 0,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('راهنما اضافه شد');
            setCreateModalVisible(false);
            createForm.resetFields();
            fetchHelps();
        } catch {
            // validation error
        } finally {
            setCreateLoading(false);
        }
    }

    async function handleEdit() {
        if (!editing) return;
        try {
            const values = await editForm.validateFields();
            setEditLoading(true);
            const res = await fetch(`/api/dashboard/bot-helps/${editing.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: values.name,
                    description: values.description,
                    sort_order: values.sort_order ?? 0,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('راهنما بروزرسانی شد');
            setEditing(null);
            fetchHelps();
        } catch {
            // validation error
        } finally {
            setEditLoading(false);
        }
    }

    async function handleDelete(id: number) {
        await fetch(`/api/dashboard/bot-helps/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        message.success('حذف شد');
        setHelps((prev) => prev.filter((h) => h.id !== id));
    }

    const columns: ColumnsType<BotHelp> = [
        { title: 'نام', dataIndex: 'name', width: 200 },
        {
            title: 'توضیحات',
            dataIndex: 'description',
            ellipsis: true,
            render: (v) => (
                <span style={{ whiteSpace: 'pre-wrap' }}>{v}</span>
            ),
        },
        { title: 'ترتیب', dataIndex: 'sort_order', width: 80 },
        {
            title: '',
            width: 80,
            render: (_, record) => (
                <>
                    <Button type="text" icon={<EditOutlined />} onClick={() => {
                        editForm.setFieldsValue({
                            name: record.name,
                            description: record.description,
                            sort_order: record.sort_order,
                        });
                        setEditing(record);
                    }} />
                    <Popconfirm title="حذف شود؟" onConfirm={() => handleDelete(record.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </>
            ),
        },
    ];

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 8,
            }}>
                <h2 style={{ margin: 0 }}>راهنمای ربات</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    راهنمای جدید
                </Button>
            </div>

            <Table
                dataSource={helps}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={false}
                scroll={{ x: 400 }}
                size="small"
            />

            <Modal
                title="ایجاد راهنمای جدید"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false);
                    createForm.resetFields();
                }}
                onOk={handleCreate}
                okText="ایجاد"
                cancelText="لغو"
                confirmLoading={createLoading}
            >
                <Form form={createForm} layout="vertical">
                    <Form.Item name="name" label="نام راهنما" rules={[{ required: true, message: 'نام الزامی' }]}>
                        <Input placeholder="نام راهنما" />
                    </Form.Item>
                    <Form.Item name="description" label="توضیحات" rules={[{ required: true, message: 'توضیحات الزامی' }]}>
                        <Input.TextArea placeholder="توضیحات (پشتیبانی از فرمت HTML تلگرام)" autoSize={{ minRows: 4, maxRows: 10 }} />
                    </Form.Item>
                    <Form.Item name="sort_order" label="ترتیب نمایش" initialValue={0}>
                        <InputNumber placeholder="ترتیب" min={0} style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="ویرایش راهنما"
                open={!!editing}
                onCancel={() => setEditing(null)}
                onOk={handleEdit}
                okText="ذخیره"
                cancelText="لغو"
                confirmLoading={editLoading}
            >
                <Form form={editForm} layout="vertical">
                    <Form.Item name="name" label="نام راهنما" rules={[{ required: true, message: 'نام الزامی' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="توضیحات" rules={[{ required: true, message: 'توضیحات الزامی' }]}>
                        <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} />
                    </Form.Item>
                    <Form.Item name="sort_order" label="ترتیب نمایش">
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
