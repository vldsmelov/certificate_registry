create schema if not exists auth;

drop table if exists schema_migrations;

create table schema_migrations (
  version bigint primary key,
  inserted_at timestamp not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'auth' and t.typname = 'factor_type'
  ) then
    create type auth.factor_type as enum ('totp');
  end if;
end $$;
