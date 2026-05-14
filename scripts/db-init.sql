-- Idempotent dev database initialisation.
-- Safe to run multiple times -- creates what is missing, skips what already exists.
-- Passwords are set by db-init.ps1 after this file runs.
-- Do not run this file directly; use: scripts/db-init.ps1

-- Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agon_admin') THEN
        CREATE ROLE agon_admin WITH LOGIN PASSWORD 'placeholder';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agon_api') THEN
        CREATE ROLE agon_api WITH LOGIN PASSWORD 'placeholder';
    END IF;
END
$$;

-- Database
SELECT 'CREATE DATABASE agon_dev OWNER agon_admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agon_dev')\gexec

-- Connect to the dev database for the rest
\connect agon_dev

-- Schema ownership
ALTER SCHEMA public OWNER TO agon_admin;

-- agon_api gets DML only -- no DDL
GRANT CONNECT ON DATABASE agon_dev TO agon_api;
GRANT USAGE ON SCHEMA public TO agon_api;

-- Apply to any tables created in the future by agon_admin
ALTER DEFAULT PRIVILEGES FOR ROLE agon_admin IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agon_api;

ALTER DEFAULT PRIVILEGES FOR ROLE agon_admin IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO agon_api;
