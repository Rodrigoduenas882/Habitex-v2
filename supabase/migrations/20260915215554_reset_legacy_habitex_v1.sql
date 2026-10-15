drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
grant all on schema public to anon, authenticated;
comment on schema public is 'Habitex V2 application schema';