import { ConfigProvider } from 'antd';
import faIR from 'antd/locale/fa_IR';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { DashboardHome } from './pages/DashboardHome';
import { TelegramUsers } from './pages/TelegramUsers';
import { TelegramUserSessions } from './pages/TelegramUserSessions';
import { BotChannels } from './pages/BotChannels';
import { BotHelps } from './pages/BotHelps';
import { AISettings } from './pages/AISettings';
import { ZernioAccounts } from './pages/ZernioAccounts';
import { ZernioSocialAccounts } from './pages/ZernioSocialAccounts';
import { Videos } from './pages/Videos';
import { VideoEdit } from './pages/VideoEdit';
import { Settings } from './pages/Settings';

export default function App() {
    return (
        <ConfigProvider
            direction="rtl"
            locale={faIR}
            theme={{
                token: {
                    colorPrimary: '#4f46e5',
                    fontFamily: "'Vazirmatn', 'Inter', sans-serif",
                    borderRadius: 8,
                    colorBgLayout: '#f5f6fa',
                },
            }}
        >
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />

                        <Route
                            element={
                                <ProtectedRoute>
                                    <Layout />
                                </ProtectedRoute>
                            }
                        >
                            <Route path="/" element={<DashboardHome />} />
                            <Route path="/telegram-users" element={<TelegramUsers />} />
                            <Route path="/telegram-sessions" element={<TelegramUserSessions />} />
                            <Route path="/bot-channels" element={<BotChannels />} />
                            <Route path="/bot-helps" element={<BotHelps />} />
                            <Route path="/ai-settings" element={<AISettings />} />
                            <Route path="/zernio-accounts" element={<ZernioAccounts />} />
                            <Route path="/zernio-social-accounts" element={<ZernioSocialAccounts />} />
                            <Route path="/videos" element={<Videos />} />
                            <Route path="/videos/edit/:shortcode" element={<VideoEdit />} />
                            <Route path="/settings" element={<Settings />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ConfigProvider>
    );
}
