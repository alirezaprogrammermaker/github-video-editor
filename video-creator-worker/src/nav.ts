import type { ComponentType } from 'react';
import { DashboardOutlined, TeamOutlined, SettingOutlined, MessageOutlined, WechatOutlined, QuestionCircleOutlined, RobotOutlined, ApiOutlined, GlobalOutlined, VideoCameraOutlined } from '@ant-design/icons';

export type NavItem = {
    path: string;
    label: string;
    icon: ComponentType;
};

export const navItems: NavItem[] = [
    { path: '/', label: 'داشبورد', icon: DashboardOutlined },
    { path: '/telegram-users', label: 'کاربران تلگرام', icon: TeamOutlined },
    { path: '/telegram-sessions', label: 'نشست‌های تلگرام', icon: MessageOutlined },
    { path: '/bot-channels', label: 'کانال‌های ربات', icon: WechatOutlined },
    { path: '/bot-helps', label: 'راهنمای ربات', icon: QuestionCircleOutlined },
    { path: '/ai-settings', label: 'هوش مصنوعی', icon: RobotOutlined },
    { path: '/zernio-accounts', label: 'اکانت‌های زرنیو', icon: ApiOutlined },
    { path: '/zernio-social-accounts', label: 'حساب‌های شبکه اجتماعی', icon: GlobalOutlined },
    { path: '/videos', label: 'ویدیوها', icon: VideoCameraOutlined },
    { path: '/settings', label: 'تنظیمات', icon: SettingOutlined },
];
