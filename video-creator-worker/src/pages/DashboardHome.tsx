import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin } from 'antd';
import { TeamOutlined, CalendarOutlined, TrophyOutlined } from '@ant-design/icons';
import { Line, Column } from '@ant-design/charts';
import { PageHeader } from '../components/PageHeader';

interface Stats {
    total: number;
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
}

interface DailyStat {
    date: string;
    count: number;
}

export function DashboardHome() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(true);
    const [days, setDays] = useState(30);

    async function fetchStats() {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
            setStats(await res.json());
        } finally {
            setLoading(false);
        }
    }

    async function fetchDailyStats() {
        setChartLoading(true);
        try {
            const res = await fetch(`/api/dashboard/stats/daily?days=${days}`, { credentials: 'include' });
            const data = await res.json();
            setDailyStats(data.map((d: DailyStat) => ({
                date: d.date,
                count: d.count,
            })));
        } finally {
            setChartLoading(false);
        }
    }

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchDailyStats();
    }, [days]);

    const lineConfig = {
        data: dailyStats,
        xField: 'date',
        yField: 'count',
        smooth: true,
        point: {
            size: 3,
            shape: 'circle',
        },
        color: '#4f46e5',
        area: {
            color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                stops: [
                    { offset: 0, color: 'rgba(79, 70, 229, 0.3)' },
                    { offset: 1, color: 'rgba(79, 70, 229, 0.05)' },
                ],
            },
        },
        xAxis: {
            label: {
                autoRotate: true,
            },
        },
        yAxis: {
            min: 0,
        },
        animation: true,
    };

    const columnConfig = {
        data: dailyStats.slice(-14),
        xField: 'date',
        yField: 'count',
        color: '#4f46e5',
        columnWidthRatio: 0.6,
        label: {
            position: 'top' as const,
            style: {
                fill: '#666',
                fontSize: 10,
            },
        },
        xAxis: {
            label: {
                autoRotate: true,
            },
        },
        yAxis: {
            min: 0,
        },
        animation: true,
    };

    const dayFilter = [7, 14, 30, 90].map((d) => (
        <a
            key={d}
            onClick={() => setDays(d)}
            style={{
                color: days === d ? '#4f46e5' : '#666',
                fontWeight: days === d ? 'bold' : 'normal',
                cursor: 'pointer',
            }}
        >
            {d} روز
        </a>
    ));

    const emptyChart = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
            داده‌ای موجود نیست
        </div>
    );

    return (
        <div>
            <PageHeader title="داشبورد آمار" extra={dayFilter} />

            <Spin spinning={loading}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ borderRadius: 12 }}>
                            <Statistic
                                title="کل کاربران"
                                value={stats?.total ?? 0}
                                prefix={<TeamOutlined style={{ color: '#4f46e5' }} />}
                                valueStyle={{ color: '#4f46e5', fontSize: 32, fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ borderRadius: 12 }}>
                            <Statistic
                                title="امروز"
                                value={stats?.today ?? 0}
                                prefix={<CalendarOutlined style={{ color: '#10b981' }} />}
                                valueStyle={{ color: '#10b981', fontSize: 32, fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ borderRadius: 12 }}>
                            <Statistic
                                title="دیروز"
                                value={stats?.yesterday ?? 0}
                                prefix={<CalendarOutlined style={{ color: '#f59e0b' }} />}
                                valueStyle={{ color: '#f59e0b', fontSize: 32, fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card bordered={false} style={{ borderRadius: 12 }}>
                            <Statistic
                                title="این ماه"
                                value={stats?.thisMonth ?? 0}
                                prefix={<TrophyOutlined style={{ color: '#ef4444' }} />}
                                valueStyle={{ color: '#ef4444', fontSize: 32, fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                </Row>
            </Spin>

            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col xs={24} lg={16}>
                    <Card
                        title="روند ثبت‌نام کاربران"
                        bordered={false}
                        style={{ borderRadius: 12 }}
                        extra={<div style={{ display: 'flex', gap: 8 }}>{dayFilter}</div>}
                    >
                        <Spin spinning={chartLoading}>
                            <div style={{ height: 350 }}>
                                {dailyStats.length > 0 ? (
                                    <Line {...lineConfig} />
                                ) : (
                                    emptyChart
                                )}
                            </div>
                        </Spin>
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card
                        title="ثبت‌نام روزانه (۱۴ روز اخیر)"
                        bordered={false}
                        style={{ borderRadius: 12 }}
                    >
                        <Spin spinning={chartLoading}>
                            <div style={{ height: 350 }}>
                                {dailyStats.length > 0 ? (
                                    <Column {...columnConfig} />
                                ) : (
                                    emptyChart
                                )}
                            </div>
                        </Spin>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
