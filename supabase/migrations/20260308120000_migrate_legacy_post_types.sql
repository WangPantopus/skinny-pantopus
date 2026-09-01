-- Migrate legacy v1.0 post types to v1.1 equivalents
UPDATE "Post" SET post_type = 'ask_local' WHERE post_type = 'question';
UPDATE "Post" SET post_type = 'alert' WHERE post_type = 'safety_alert';
UPDATE "Post" SET post_type = 'deal' WHERE post_type = 'deals_promos';
