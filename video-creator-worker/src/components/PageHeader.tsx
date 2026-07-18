import { Flex, Typography } from 'antd';

const { Title } = Typography;

interface PageHeaderProps {
    title: string;
    extra?: React.ReactNode;
}

export function PageHeader({ title, extra }: PageHeaderProps) {
    return (
        <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>{title}</Title>
            {extra && <Flex gap={8} wrap="wrap">{extra}</Flex>}
        </Flex>
    );
}
