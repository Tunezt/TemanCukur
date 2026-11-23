-- Newer Supabase projects no longer grant table access to API roles automatically.
-- The backend talks to Supabase with the service_role key, so grant only that role.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
