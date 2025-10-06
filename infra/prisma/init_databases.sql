-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create temporal user first (if it doesn't exist) with CREATEDB permission
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'temporal') THEN
      CREATE USER temporal WITH PASSWORD 'temporal' CREATEDB;
   END IF;
END
$$;

-- Create temporal database and grant ownership
CREATE DATABASE temporal OWNER temporal;

-- Connect to temporal database and set up permissions
\c temporal;
GRANT ALL ON SCHEMA public TO temporal;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO temporal;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO temporal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO temporal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO temporal;