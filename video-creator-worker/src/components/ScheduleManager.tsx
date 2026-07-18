import { useEffect, useState } from 'react';
import { Switch, TimePicker, Checkbox, Button, Space, Typography, Card, Tag, message, Spin } from 'antd';
import { SaveOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Schedule {
    time_slots: string[];
    active_days: string[];
    is_active: boolean;
}

interface Props {
    socialAccountId: string;
}

// Cloudflare cron: 1=Sunday, 2=Monday, ..., 7=Saturday
const dayNames: Record<string, string> = {
    '1': 'یکشنبه',
    '2': 'دوشنبه',
    '3': 'سه‌شنبه',
    '4': 'چهارشنبه',
    '5': 'پنجشنبه',
    '6': 'جمعه',
    '7': 'شنبه',
};

export function ScheduleManager({ socialAccountId }: Props) {
    const [schedule, setSchedule] = useState<Schedule>({
        time_slots: [],
        active_days: ['1', '2', '3', '4', '5', '6', '7'],
        is_active: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    async function fetchSchedule() {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard/schedules/${socialAccountId}`, { credentials: 'include' });
            const data = await res.json();
            // Normalize days to Cloudflare format (1-7)
            if (data.active_days) {
                data.active_days = data.active_days.map((d: string) => {
                    if (d === '0') return '1'; // Sunday
                    return d;
                });
            }
            setSchedule(data);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchSchedule();
    }, [socialAccountId]);

    function addTimeSlot(time: dayjs.Dayjs | null) {
        if (!time) return;
        const timeStr = time.format('HH:mm');
        if (schedule.time_slots.includes(timeStr)) {
            message.warning('این ساعت قبلا اضافه شده');
            return;
        }
        setSchedule(prev => ({
            ...prev,
            time_slots: [...prev.time_slots, timeStr].sort(),
        }));
    }

    function removeTimeSlot(time: string) {
        setSchedule(prev => ({
            ...prev,
            time_slots: prev.time_slots.filter(t => t !== time),
        }));
    }

    function toggleDay(day: string) {
        setSchedule(prev => ({
            ...prev,
            active_days: prev.active_days.includes(day)
                ? prev.active_days.filter(d => d !== day)
                : [...prev.active_days, day],
        }));
    }

    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch(`/api/dashboard/schedules/${socialAccountId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(schedule),
            });
            const data = await res.json();
            if (!res.ok) return message.error(data.error);
            message.success('زمانبندی ذخیره شد');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <Spin size="small" />;

    return (
        <Card size="small" title={<Space><ClockCircleOutlined /> زمانبندی انتشار</Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text>فعال‌سازی زمانبندی</Text>
                    <Switch
                        checked={schedule.is_active}
                        onChange={(checked) => setSchedule(prev => ({ ...prev, is_active: checked }))}
                        checkedChildren="فعال"
                        unCheckedChildren="غیرفعال"
                    />
                </div>

                <div>
                    <Text strong style={{ fontSize: 12 }}>ساعت‌های انتشار:</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {schedule.time_slots.map(time => (
                            <Tag
                                key={time}
                                closable
                                onClose={() => removeTimeSlot(time)}
                                color="blue"
                                style={{ cursor: 'pointer' }}
                            >
                                {time}
                            </Tag>
                        ))}
                    </div>
                    <TimePicker
                        format="HH:mm"
                        placeholder="افزودن ساعت"
                        onChange={addTimeSlot}
                        style={{ marginTop: 8, width: 120 }}
                        size="small"
                    />
                </div>

                <div>
                    <Text strong style={{ fontSize: 12 }}>روزهای فعال:</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {Object.entries(dayNames).map(([day, name]) => (
                            <Checkbox
                                key={day}
                                checked={schedule.active_days.includes(day)}
                                onChange={() => toggleDay(day)}
                            >
                                {name}
                            </Checkbox>
                        ))}
                    </div>
                </div>

                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    size="small"
                >
                    ذخیره زمانبندی
                </Button>
            </Space>
        </Card>
    );
}
