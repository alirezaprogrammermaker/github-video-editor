INSERT OR IGNORE INTO video_templates (id, name, description, fields) VALUES (
    'default',
    'قالب پیش‌فرض',
    'قالب استاندارد با متن ثابت، متن متحرک و واترمارک',
    '[{"name":"static_text","label":"متن ثابت","type":"text","placeholder":"متن ثابت روی ویدیو"},{"name":"marquee_text","label":"متن متحرک","type":"text","placeholder":"متن متحرک"},{"name":"watermark_text","label":"واترمارک","type":"text","placeholder":"متن واترمارک"}]'
);
