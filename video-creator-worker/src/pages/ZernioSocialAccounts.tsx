import { useEffect, useState } from 'react';
import { Table, Button, Select, Popconfirm, Form, message, Modal, Tag, Avatar, Space, Input, List, Typography, Divider } from 'antd';
import { DeleteOutlined, SyncOutlined, EditOutlined, UserAddOutlined, CrownOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ScheduleManager } from '../components/ScheduleManager';

const { Text } = Typography;
const { TextArea } = Input;

interface ZernioAccount {
    id: string;
    name: string;
    api_key: string;
}

interface SocialAccount {
    id: string;
    account_id: string;
    platform: string;
    username: string | null;
    display_name: string | null;
    profile_image: string | null;
    status: string;
    admin_key: string | null;
    caption_template: string | null;
    synced_at: string;
}

interface PageAdmin {
    id: string;
    social_account_id: string;
    user_id: string;
    username: string | null;
    display_name: string | null;
    role: string;
    added_by: string;
    created_at: string;
}

const platformColors: Record<string, string> = {
    twitter: '#1DA1F2',
    instagram: '#E4405F',
    linkedin: '#0A66C2',
    facebook: '#1877F2',
    tiktok: '#000000',
    youtube: '#FF0000',
    pinterest: '#BD081C',
    telegram: '#0088cc',
};

const roleLabels: Record<string, string> = {
    owner: 'مالک',
    admin: 'ادمین',
};

const addedByLabels: Record<string, string> = {
    manual: 'دستی',
    auto_dm: 'خودکار (دایرکت)',
    system: 'سیستم',
};

export function ZernioSocialAccounts() {
    const [zernioAccounts, setZernioAccounts] = useState<ZernioAccount[]>([]);
    const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
    const [selectedZernio, setSelectedZernio] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncLoading, setSyncLoading] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editing, setEditing] = useState<SocialAccount | null>(null);
    const [editForm] = Form.useForm();
    const [editLoading, setEditLoading] = useState(false);

    // Admin management
    const [admins, setAdmins] = useState<PageAdmin[]>([]);
    const [adminsLoading, setAdminsLoading] = useState(false);
    const [addAdminModalVisible, setAddAdminModalVisible] = useState(false);
    const [addAdminForm] = Form.useForm();
    const [addAdminLoading, setAddAdminLoading] = useState(false);

    async function fetchZernioAccounts() {
        try {
            const res = await fetch('/api/dashboard/zernio-accounts', { credentials: 'include' });
            const data = await res.json();
            setZernioAccounts(data);
        } catch {}
    }

    async function fetchSocialAccounts(zernioAccountId?: string) {
        setLoading(true);
        try {
            const url = zernioAccountId
                ? `/api/dashboard/zernio-social-accounts/by-zernio/${zernioAccountId}`
                : '/api/dashboard/zernio-social-accounts';
            const res = await fetch(url, { credentials: 'include' });
            setSocialAccounts(await res.json());
        } finally {
            setLoading(false);
        }
    }

    async function fetchAdmins(socialAccountId: string) {
        setAdminsLoading(true);
        try {
            const res = await fetch(`/api/dashboard/page-admins/${socialAccountId}`, { credentials: 'include' });
            setAdmins(await res.json());
        } finally {
            setAdminsLoading(false);
        }
    }

    useEffect(() => {
        fetchZernioAccounts();
        fetchSocialAccounts();
    }, []);

    useEffect(() => {
        if (selectedZernio) {
            fetchSocialAccounts(selectedZernio);
        } else {
            fetchSocialAccounts();
        }
    }, [selectedZernio]);

    useEffect(() => {
        if (editing?.id) {
            fetchAdmins(editing.id);
        }
    }, [editing]);

    async function handleSync() {
        if (!selectedZernio) return message.error('ابتدا یک اکانت زرنیو انتخاب کنید');
        setSyncLoading(true);
        try {
            const res = await fetch(`/api/dashboard/zernio-social-accounts/sync/${selectedZernio}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success(`${data.synced} حساب بروزرسانی شد`);
            fetchSocialAccounts(selectedZernio);
        } finally {
            setSyncLoading(false);
        }
    }

    function openEdit(record: SocialAccount) {
        setEditing(record);
        editForm.setFieldsValue({
            username: record.username,
            display_name: record.display_name,
            status: record.status,
            admin_key: record.admin_key,
            caption_template: record.caption_template || '{caption}',
        });
        setEditModalVisible(true);
    }

    async function handleEditSubmit() {
        if (!editing) return;
        try {
            const values = await editForm.validateFields();
            setEditLoading(true);
            const res = await fetch(`/api/dashboard/zernio-social-accounts/${editing.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('حساب بروزرسانی شد');
            setEditModalVisible(false);
            setEditing(null);
            fetchSocialAccounts(selectedZernio || undefined);
        } catch {
            // validation error
        } finally {
            setEditLoading(false);
        }
    }

    async function handleAddAdmin() {
        if (!editing) return;
        try {
            const values = await addAdminForm.validateFields();
            setAddAdminLoading(true);
            const res = await fetch('/api/dashboard/page-admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    social_account_id: editing.id,
                    user_id: values.user_id,
                    username: values.username,
                    display_name: values.display_name,
                }),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('ادمین اضافه شد');
            setAddAdminModalVisible(false);
            addAdminForm.resetFields();
            fetchAdmins(editing.id);
        } catch {
            // validation error
        } finally {
            setAddAdminLoading(false);
        }
    }

    async function handleDeleteAdmin(id: string) {
        if (!editing) return;
        const res = await fetch(`/api/dashboard/page-admins/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) return message.error(data.error);
        message.success('ادمین حذف شد');
        fetchAdmins(editing.id);
    }

    async function handleDelete(id: string) {
        const res = await fetch(`/api/dashboard/zernio-social-accounts/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) return message.error(data.error);
        message.success('حذف شد');
        setSocialAccounts((prev) => prev.filter((a) => a.id !== id));
    }

    const columns: ColumnsType<SocialAccount> = [
        {
            title: 'پلتفرم',
            dataIndex: 'platform',
            width: 150,
            render: (platform: string) => (
                <Tag color={platformColors[platform] || '#999'}>
                    {platform.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: 'حساب',
            render: (_, record) => (
                <Space>
                    {record.profile_image && <Avatar src={record.profile_image} size="small" />}
                    <div>
                        <div style={{ fontWeight: 500 }}>{record.display_name || record.username || '-'}</div>
                        {record.username && <div style={{ fontSize: 12, color: '#999' }}>@{record.username}</div>}
                    </div>
                </Space>
            ),
        },
        {
            title: 'شناسه',
            dataIndex: 'account_id',
            width: 200,
            ellipsis: true,
        },
        {
            title: 'وضعیت',
            dataIndex: 'status',
            width: 100,
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : status === 'expired' ? 'orange' : 'red'}>
                    {status === 'active' ? 'فعال' : status === 'expired' ? 'منقضی' : status}
                </Tag>
            ),
        },
        {
            title: 'آخرین بروزرسانی',
            dataIndex: 'synced_at',
            width: 180,
        },
        {
            title: '',
            width: 80,
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
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 8,
            }}>
                <h2 style={{ margin: 0 }}>حساب‌های شبکه اجتماعی</h2>
                <Space wrap>
                    <Select
                        placeholder="فیلتر بر اساس اکانت زرنیو"
                        style={{ minWidth: 200, flex: '1 1 200px' }}
                        allowClear
                        value={selectedZernio}
                        onChange={(v) => setSelectedZernio(v || null)}
                        options={zernioAccounts.map(a => ({ label: a.name, value: a.id }))}
                    />
                    <Button
                        type="primary"
                        icon={<SyncOutlined spin={syncLoading} />}
                        onClick={handleSync}
                        loading={syncLoading}
                        disabled={!selectedZernio}
                    >
                        بروزرسانی از زرنیو
                    </Button>
                </Space>
            </div>

            <Table
                dataSource={socialAccounts}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={false}
                scroll={{ x: 600 }}
                size="small"
            />

            {/* Edit Modal */}
            <Modal
                title="ویرایش حساب"
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false);
                    setEditing(null);
                }}
                onOk={handleEditSubmit}
                okText="ذخیره"
                cancelText="لغو"
                confirmLoading={editLoading}
                width={700}
            >
                <Form form={editForm} layout="vertical">
                    <Form.Item name="username" label="نام کاربری">
                        <Input placeholder="نام کاربری" />
                    </Form.Item>
                    <Form.Item name="display_name" label="نام نمایشی">
                        <Input placeholder="نام نمایشی" />
                    </Form.Item>
                    <Form.Item name="status" label="وضعیت">
                        <Select
                            options={[
                                { label: 'فعال', value: 'active' },
                                { label: 'منقضی', value: 'expired' },
                                { label: 'غیرفعال', value: 'inactive' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="admin_key" label="کلید ادمین" tooltip="کاربران با ارسال این کلید در دایرکت، ادمین پیج می‌شوند">
                        <Input placeholder="مثال: admin123" />
                    </Form.Item>
                    <Form.Item
                        name="caption_template"
                        label="قالب کپشن"
                        tooltip="از {caption} برای جایگذاری کپشن اصلی استفاده کنید. مثال: پیج ما را فالو کنید {caption} #hot"
                    >
                        <TextArea
                            placeholder="پیج ما را فالو کنید {caption} #hot"
                            autoSize={{ minRows: 2, maxRows: 4 }}
                        />
                    </Form.Item>
                </Form>

                <Divider>لیست ادمین‌ها</Divider>

                <div style={{ marginBottom: 12 }}>
                    <Button
                        type="primary"
                        size="small"
                        icon={<UserAddOutlined />}
                        onClick={() => setAddAdminModalVisible(true)}
                    >
                        افزودن ادمین
                    </Button>
                </div>

                <List
                    loading={adminsLoading}
                    dataSource={admins}
                    locale={{ emptyText: 'ادمینی وجود ندارد' }}
                    renderItem={(admin) => (
                        <List.Item
                            actions={[
                                admin.role !== 'owner' && (
                                    <Popconfirm
                                        title="حذف شود؟"
                                        onConfirm={() => handleDeleteAdmin(admin.id)}
                                    >
                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                ),
                            ].filter(Boolean)}
                        >
                            <List.Item.Meta
                                avatar={
                                    admin.role === 'owner'
                                        ? <CrownOutlined style={{ fontSize: 20, color: '#faad14' }} />
                                        : <UserOutlined style={{ fontSize: 20 }} />
                                }
                                title={
                                    <Space>
                                        <span>{admin.display_name || admin.username || admin.user_id}</span>
                                        <Tag color={admin.role === 'owner' ? 'gold' : 'blue'}>
                                            {roleLabels[admin.role] || admin.role}
                                        </Tag>
                                    </Space>
                                }
                                description={
                                    <Space direction="vertical" size={0}>
                                        {admin.username && <Text type="secondary">@{admin.username}</Text>}
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            اضافه شده توسط: {addedByLabels[admin.added_by] || admin.added_by}
                                        </Text>
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />

                <Divider>زمانبندی انتشار</Divider>
                {editing && <ScheduleManager socialAccountId={editing.id} />}
            </Modal>

            {/* Add Admin Modal */}
            <Modal
                title="افزودن ادمین جدید"
                open={addAdminModalVisible}
                onCancel={() => {
                    setAddAdminModalVisible(false);
                    addAdminForm.resetFields();
                }}
                onOk={handleAddAdmin}
                okText="افزودن"
                cancelText="لغو"
                confirmLoading={addAdminLoading}
            >
                <Form form={addAdminForm} layout="vertical">
                    <Form.Item
                        name="user_id"
                        label="شناسه کاربر"
                        rules={[{ required: true, message: 'شناسه کاربر الزامی است' }]}
                    >
                        <Input placeholder="شناسه کاربر در شبکه اجتماعی" />
                    </Form.Item>
                    <Form.Item name="username" label="نام کاربری">
                        <Input placeholder="نام کاربری (اختیاری)" />
                    </Form.Item>
                    <Form.Item name="display_name" label="نام نمایشی">
                        <Input placeholder="نام نمایشی (اختیاری)" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
