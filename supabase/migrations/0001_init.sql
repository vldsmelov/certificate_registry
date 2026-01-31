create extension if not exists "pgcrypto";

create type exam_grade as enum ('gold', 'silver', 'fail');
create type exam_status as enum ('draft', 'submitted', 'needs_fix', 'approved', 'rejected', 'failed');
create type approval_status as enum ('pending', 'approved', 'rejected');
create type validity_type as enum ('fixed_date', 'duration', 'perpetual');
create type certificate_status as enum ('issued', 'revoked', 'annulled');
create type notification_status as enum ('pending', 'sent', 'failed');

create table user_profile (
  user_id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null,
  is_active boolean not null default true
);

create table role (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table permission (
  id uuid primary key default gen_random_uuid(),
  key text not null unique
);

create table role_permission (
  role_id uuid references role(id) on delete cascade,
  permission_id uuid references permission(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_role (
  user_id uuid references user_profile(user_id) on delete cascade,
  role_id uuid references role(id) on delete cascade,
  primary key (user_id, role_id)
);

create table person (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text,
  employee_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references user_profile(user_id)
);

create table exam_type (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_validity_type validity_type not null,
  default_validity_months int,
  default_template_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exam_attempt (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references person(id) on delete cascade,
  exam_type_id uuid references exam_type(id) on delete cascade,
  attempt_no int not null,
  grade exam_grade not null,
  exam_date date not null,
  status exam_status not null default 'draft',
  signer_user_id uuid references user_profile(user_id),
  created_by uuid references user_profile(user_id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, exam_type_id, attempt_no)
);

create table approval (
  id uuid primary key default gen_random_uuid(),
  exam_attempt_id uuid references exam_attempt(id) on delete cascade,
  signer_user_id uuid references user_profile(user_id),
  status approval_status not null default 'pending',
  decided_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create table template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references user_profile(user_id)
);

create table template_version (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references template(id) on delete cascade,
  version int not null,
  is_active boolean not null default true,
  background_path text,
  config_json jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references user_profile(user_id),
  unique (template_id, version)
);

alter table exam_type
  add constraint exam_type_default_template_fk
  foreign key (default_template_version_id) references template_version(id);

create table certificate (
  id uuid primary key default gen_random_uuid(),
  exam_attempt_id uuid not null unique references exam_attempt(id) on delete cascade,
  certificate_number text not null unique,
  public_id text not null unique,
  issued_at timestamptz not null,
  validity_type validity_type not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  validity_months int,
  status certificate_status not null default 'issued',
  revoked_at timestamptz,
  revoked_by uuid references user_profile(user_id),
  revoke_reason text,
  template_version_id uuid references template_version(id),
  render_snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references user_profile(user_id)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references user_profile(user_id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create table notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload_json jsonb not null,
  status notification_status not null default 'pending',
  attempts_count int not null default 0,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table cert_seq (
  year int not null,
  exam_type_id uuid references exam_type(id) on delete cascade,
  last_value int not null default 0,
  primary key (year, exam_type_id)
);

create or replace function next_certificate_number(p_exam_type_id uuid)
returns text
language plpgsql
as $$
declare
  v_year int := extract(year from now());
  v_code text;
  v_next int;
begin
  select code into v_code from exam_type where id = p_exam_type_id;
  if v_code is null then
    raise exception 'exam_type not found';
  end if;

  insert into cert_seq (year, exam_type_id, last_value)
  values (v_year, p_exam_type_id, 0)
  on conflict (year, exam_type_id) do nothing;

  select last_value into v_next
  from cert_seq
  where year = v_year and exam_type_id = p_exam_type_id
  for update;

  v_next := v_next + 1;

  update cert_seq
  set last_value = v_next
  where year = v_year and exam_type_id = p_exam_type_id;

  return concat(v_year, '-', v_code, '-', lpad(v_next::text, 6, '0'));
end;
$$;

create index idx_certificate_public_id on certificate (public_id);
create index idx_certificate_number on certificate (certificate_number);
create index idx_certificate_status on certificate (status);
create index idx_certificate_issued_at on certificate (issued_at);
create index idx_exam_attempt_date on exam_attempt (exam_date);
create index idx_exam_attempt_status on exam_attempt (status);
create index idx_exam_attempt_signer on exam_attempt (signer_user_id);
create index idx_person_full_name on person (full_name);

create view public_certificate_check as
select
  certificate.public_id,
  certificate.certificate_number,
  exam_type.name as exam_type_name,
  exam_attempt.grade,
  certificate.issued_at,
  certificate.valid_to,
  certificate.validity_type,
  certificate.status,
  user_profile.display_name as signer_display_name
from certificate
join exam_attempt on exam_attempt.id = certificate.exam_attempt_id
join exam_type on exam_type.id = exam_attempt.exam_type_id
left join user_profile on user_profile.user_id = exam_attempt.signer_user_id;
