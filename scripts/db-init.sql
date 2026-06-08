-- Dev/prod database + role initialisation. Drops and recreates the database
-- on every run -- dev data is always throwaway. Schema is applied separately
-- by `make db-migrate` (see api/internal/migrations).
-- Passwords are set by db-init.ps1 / db-init.sh after this file runs.
-- Do not run this file directly; use: scripts/db-init.ps1 / db-init.sh

-- Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'yurnik_admin') THEN
        CREATE ROLE yurnik_admin WITH LOGIN PASSWORD 'placeholder';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'yurnik_api') THEN
        CREATE ROLE yurnik_api WITH LOGIN PASSWORD 'placeholder';
    END IF;
END
$$;

-- Database -- drop and recreate so this script always starts from a clean slate.
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = 'yurnik' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS yurnik;
CREATE DATABASE yurnik OWNER yurnik_admin;

-- Connect to the dev database for the rest
\connect yurnik

-- Transfer schema ownership while still running as superuser, before SET ROLE.
ALTER SCHEMA public OWNER TO yurnik_admin;

SET ROLE yurnik_admin;

-- yurnik_api gets DML only -- no DDL
GRANT CONNECT ON DATABASE yurnik TO yurnik_api;
GRANT USAGE ON SCHEMA public TO yurnik_api;

-- Apply to any tables created in the future by yurnik_admin (i.e. by migrations)
ALTER DEFAULT PRIVILEGES FOR ROLE yurnik_admin IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yurnik_api;

ALTER DEFAULT PRIVILEGES FOR ROLE yurnik_admin IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO yurnik_api;

RESET ROLE;
