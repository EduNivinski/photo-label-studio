-- Grant permissions to service_role for private schema access
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA private TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA private TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA private TO service_role;

-- Set default privileges for future objects in private schema
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT ALL ON FUNCTIONS TO service_role;