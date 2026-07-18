import { useState, useEffect } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button, Drawer } from 'antd';
import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { navItems } from '../nav';
import { useAuth } from '../context/AuthContext';

const { Sider, Header, Content } = AntLayout;

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile;
}

export function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const isMobile = useIsMobile();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Auto-collapse sidebar on mobile
    useEffect(() => {
        if (isMobile) setCollapsed(true);
    }, [isMobile]);

    // Close drawer on route change
    useEffect(() => {
        setDrawerOpen(false);
    }, [location.pathname]);

    const menuItems = navItems.map(({ path, label, icon: Icon }) => ({
        key: path,
        icon: <Icon />,
        label,
    }));

    const handleMenuClick = ({ key }: { key: string }) => {
        navigate(key);
        if (isMobile) setDrawerOpen(false);
    };

    const siderStyle = isMobile
        ? { position: 'absolute' as const, zIndex: 1000, height: '100vh' }
        : { borderInlineEnd: '1px solid #eef0f3' };

    const menuContent = (
        <>
            <div
                style={{
                    height: 48,
                    margin: 16,
                    fontWeight: 600,
                    fontSize: 16,
                    color: '#4f46e5',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                }}
            >
                پنل مدیریت
            </div>
            <Menu
                theme="light"
                mode="inline"
                selectedKeys={[location.pathname]}
                items={menuItems}
                onClick={handleMenuClick}
            />
        </>
    );

    return (
        <AntLayout style={{ minHeight: '100vh' }}>
            {/* Desktop sidebar */}
            {!isMobile && (
                <Sider
                    collapsible
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    collapsedWidth={0}
                    trigger={null}
                    theme="light"
                    style={siderStyle}
                >
                    {menuContent}
                </Sider>
            )}

            {/* Mobile drawer */}
            {isMobile && (
                <Drawer
                    placement="right"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    width={260}
                    styles={{ body: { padding: 0 }, header: { display: 'none' } }}
                    closable={false}
                >
                    {menuContent}
                </Drawer>
            )}

            <AntLayout>
                <Header
                    style={{
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 12px 0 20px',
                        borderBottom: '1px solid #eef0f3',
                        position: 'sticky',
                        top: 0,
                        zIndex: 999,
                        height: 56,
                        lineHeight: '56px',
                    }}
                >
                    <Button
                        type="text"
                        icon={collapsed || isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => {
                            if (isMobile) setDrawerOpen(true);
                            else setCollapsed(!collapsed);
                        }}
                        style={{ fontSize: 18 }}
                    />

                    <Dropdown
                        menu={{
                            items: [
                                { key: 'logout', label: 'خروج', icon: <LogoutOutlined />, onClick: logout },
                            ],
                        }}
                    >
                        <Avatar style={{ cursor: 'pointer', backgroundColor: '#4f46e5' }}>
                            {user?.email?.[0]?.toUpperCase()}
                        </Avatar>
                    </Dropdown>
                </Header>

                <Content style={{ margin: isMobile ? 12 : 20 }}>
                    <Outlet />
                </Content>
            </AntLayout>
        </AntLayout>
    );
}
