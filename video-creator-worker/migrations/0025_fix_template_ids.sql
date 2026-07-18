-- Fix template IDs: remove tpl_ prefix to match workflow expectations
UPDATE video_templates SET id = 'default' WHERE id = 'tpl_default';
UPDATE instagram_videos SET template_id = 'default' WHERE template_id = 'tpl_default';
