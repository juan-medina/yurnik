-- SPDX-FileCopyrightText: 2026 Juan Medina
-- SPDX-License-Identifier: MIT

ALTER TABLE users 
ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{"updates":true,"echoes":true}';
