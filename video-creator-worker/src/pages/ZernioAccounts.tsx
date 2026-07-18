import { useEffect, useState } from 'react';
import { Table, Button, Input, Popconfirm, Form, message, Modal, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons';
import { PageHeader } from '../components/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface ZernioAccount {
    id: string;
    name: string;
    api_key: string;
    created_at: string;
    updated_at: string;
}

export function ZernioAccounts() {
    const [accounts, setAccounts] = useState<ZernioAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editing, setEditing] = useState<ZernioAccount | null>(null);
    const [form] = Form.useForm();
    const [submitLoading, setSubmitLoading] = useState(false);

    async function fetchAccounts() {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/zernio-accounts', { credentials: 'include' });
            setAccounts(await res.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAccounts();
    }, []);

    async function handleSubmit() {
        try {
            const values = await form.validateFields();
            setSubmitLoading(true);
            const url = editing
                ? `/api/dashboard/zernio-accounts/${editing.id}`
                : '/api/dashboard/zernio-accounts';
            const method = editing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: values.name, api_key: values.api_key }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success(editing ? 'اکانت بروزرسانی شد' : 'اکانت اضافه شد');
            setModalVisible(false);
            setEditing(null);
            form.resetFields();
            fetchAccounts();
        } catch {
            // validation error
        } finally {
            setSubmitLoading(false);
        }
    }

    async function handleDelete(id: string) {
        const res = await fetch(`/api/dashboard/zernio-accounts/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) return message.error(data.error);
        message.success('حذف شد');
        setAccounts((prev) => prev.filter((a) => a.id !== id));
    }

    function openEdit(record: ZernioAccount) {
        setEditing(record);
        form.setFieldsValue({ name: record.name, api_key: '' });
        setModalVisible(true);
    }

    function openCreate() {
        setEditing(null);
        form.resetFields();
        setModalVisible(true);
    }

    const columns: ColumnsType<ZernioAccount> = [
        {
            title: 'نام',
            dataIndex: 'name',
            width: 200,
        },
        {
            title: 'کلید API',
            dataIndex: 'api_key',
            width: 250,
            render: (v) => <Tag icon={<KeyOutlined />} color="blue">{v}</Tag>,
        },
        {
            title: 'تاریخ ایجاد',
            dataIndex: 'created_at',
            width: 180,
        },
        {
            title: '',
            width: 100,
            render: (_, record) => (
                <>
                    <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
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
                title="اکانت‌های Zernio"
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                        اکانت جدید
                    </Button>
                }
            />

            <Table
                dataSource={accounts}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={false}
                scroll={{ x: 500 }}
                size="small"
            />

            <Modal
                title={editing ? 'ویرایش اکانت' : 'افزودن اکانت جدید'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setEditing(null);
                    form.resetFields();
                }}
                onOk={handleSubmit}
                okText={editing ? 'ذخیره' : 'افزودن'}
                cancelText="لغو"
                confirmLoading={submitLoading}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="نام اکانت" rules={[{ required: true, message: 'نام الزامی است' }]}>
                        <Input placeholder="مثلاً: اکانت اصلی" />
                    </Form.Item>
                    <Form.Item
                        name="api_key"
                        label="کلید API"
                        rules={editing ? [] : [{ required: true, message: 'کلید API الزامی است' }]}
                    >
                        <Input.Password placeholder={editing ? 'برای حفظ کلید قبلی خالی بگذارید' : 'کلید API زرنیو'} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
