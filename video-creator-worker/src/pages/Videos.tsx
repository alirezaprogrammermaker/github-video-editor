import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Popconfirm, message, Space, Avatar, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlayCircleOutlined, SendOutlined } from '@ant-design/icons';
import { VideoStatus } from '../constants/video-status';
import { PageHeader } from '../components/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface Video {
    id: string;
    shortcode: string;
    video_url: string;
    proxied_url: string;
    original_caption: string | null;
    user_caption: string | null;
    text_on_video: string | null;
    animated_text: string | null;
    watermark: string | null;
    status: string;
    created_at: string;
}

export function Videos() {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    async function fetchVideos() {
        setLoading(true);
        try {
            const res = await fetch('/api/videos', { credentials: 'include' });
            setVideos(await res.json());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchVideos();
    }, []);

    async function handleDelete(shortcode: string) {
        const res = await fetch(`/api/videos/${shortcode}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) return message.error(data.error);
        message.success('حذف شد');
        setVideos((prev) => prev.filter((v) => v.shortcode !== shortcode));
    }

    async function handlePublishNow(shortcode: string) {
        const res = await fetch(`/api/videos/${shortcode}/publish`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) return message.error(data.error);
        message.success('ویدیو منتشر شد');
        fetchVideos();
    }

    const columns: ColumnsType<Video> = [
        {
            title: 'ویدیو',
            width: 60,
            render: (_, record) => (
                <Avatar
                    shape="square"
                    size={48}
                    src={record.proxied_url}
                    icon={<PlayCircleOutlined />}
                />
            ),
        },
        {
            title: 'شناسه',
            dataIndex: 'shortcode',
            width: 150,
        },
        {
            title: 'کپشن',
            responsive: ['md'],
            render: (_, record) => (
                <Text ellipsis style={{ maxWidth: 300 }}>
                    {record.user_caption || record.original_caption || 'بدون کپشن'}
                </Text>
            ),
        },
        {
            title: 'وضعیت',
            dataIndex: 'status',
            width: 120,
            render: (status: string) => {
                const statusMap: Record<string, { color: string; label: string }> = {
                    [VideoStatus.PENDING]: { color: 'default', label: 'در انتظار' },
                    [VideoStatus.BUILDING]: { color: 'processing', label: 'در حال ساخت' },
                    [VideoStatus.READY_FOR_CREATE_VIDEO]: { color: 'green', label: 'آماده ساخت' },
                    [VideoStatus.WAIT_FOR_PUBLISH]: { color: 'cyan', label: 'آماده انتشار' },
                    [VideoStatus.PUBLISHED]: { color: 'purple', label: 'منتشر شده' },
                    [VideoStatus.FAILED]: { color: 'red', label: 'ناموفق' },
                };
                const s = statusMap[status] || { color: 'default', label: status };
                return <Tag color={s.color}>{s.label}</Tag>;
            },
        },
        {
            title: 'تاریخ',
            dataIndex: 'created_at',
            width: 180,
            responsive: ['lg'],
        },
        {
            title: '',
            width: 120,
            render: (_, record) => (
                <Space size={0}>
                    <Button
                        type="text"
                        icon={<PlayCircleOutlined />}
                        onClick={() => window.open(record.proxied_url, '_blank')}
                    />
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => navigate(`/videos/edit/${record.shortcode}`)}
                    />
                    {record.status === VideoStatus.WAIT_FOR_PUBLISH && (
                        <Popconfirm title="همین الان منتشر شود؟" onConfirm={() => handlePublishNow(record.shortcode)}>
                            <Button type="text" icon={<SendOutlined />} style={{ color: '#1677ff' }} />
                        </Popconfirm>
                    )}
                    <Popconfirm title="حذف شود؟" onConfirm={() => handleDelete(record.shortcode)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <PageHeader title="ویدیوها" extra={<Tag>{videos.length} ویدیو</Tag>} />

            <Table
                dataSource={videos}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 600 }}
                size="small"
            />
        </div>
    );
}
