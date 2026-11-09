-- KORKHO SMART ROSTER: initial database schema
-- Run this file once in Supabase SQL Editor for a new project.
-- All timestamps are stored in timestamptz; application display uses Asia/Bangkok.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.staff_type as enum ('วิชาชีพ', 'ลูกจ้าง');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.staff_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  staff_code text generated always as ('KK-' || upper(substr(replace(id::text, '-', ''), 1, 8))) stored unique,
  first_name text not null,
  last_name text not null,
  position text not null,
  staff_type public.staff_type not null,
  morning_rate numeric(12,2) not null default 0 check (morning_rate >= 0),
  afternoon_rate numeric(12,2) not null default 0 check (afternoon_rate >= 0),
  status public.staff_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rate history: changing current rates must not alter issued documents.
create table if not exists public.staff_compensation_rates (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  shift_type text not null check (shift_type in ('morning','afternoon')),
  rate numeric(12,2) not null check (rate >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.duty_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_year integer not null check (schedule_year between 2000 and 2600),
  schedule_month integer not null check (schedule_month between 1 and 12),
  status text not null default 'draft' check (status in ('draft','confirmed','closed')),
  copied_from uuid references public.duty_schedules(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(schedule_year, schedule_month)
);

create table if not exists public.duty_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.duty_schedules(id) on delete cascade,
  staff_id uuid not null references public.staff(id),
  duty_date date not null,
  shift_type text not null check (shift_type in ('morning','afternoon')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(schedule_id, staff_id, duty_date, shift_type)
);

create table if not exists public.signatories (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signatory_roles (
  id uuid primary key default gen_random_uuid(),
  role_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.signatory_roles(role_name) values
('ผู้ควบคุม'),('ตรวจถูกต้อง'),('อนุมัติให้จ่ายได้'),('ผู้จ่ายเงิน')
on conflict (role_name) do nothing;

create table if not exists public.compensation_documents (
  id uuid primary key default gen_random_uuid(),
  document_no text,
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  order_no text,
  order_date date,
  multiplier_dates date[] not null default '{}',
  total_amount numeric(14,2) not null default 0,
  total_amount_text text,
  status text not null default 'issued' check (status in ('draft','issued','superseded')),
  revision_of uuid references public.compensation_documents(id),
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.compensation_document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.compensation_documents(id) on delete restrict,
  staff_id uuid references public.staff(id),
  staff_code_snapshot text,
  full_name_snapshot text not null,
  position_snapshot text not null,
  shift_type text not null check (shift_type in ('morning','afternoon')),
  rate_snapshot numeric(12,2) not null,
  duty_count integer not null default 0,
  amount numeric(14,2) not null default 0
);

create table if not exists public.compensation_daily_details (
  id uuid primary key default gen_random_uuid(),
  document_item_id uuid not null references public.compensation_document_items(id) on delete cascade,
  duty_date date not null,
  multiplier numeric(3,1) not null check (multiplier in (1,2)),
  rate_snapshot numeric(12,2) not null,
  amount numeric(14,2) not null
);

create table if not exists public.document_signatories (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.compensation_documents(id) on delete restrict,
  signatory_id uuid references public.signatories(id),
  full_name_snapshot text not null,
  position_snapshot text not null,
  role_name_snapshot text not null,
  display_order integer not null check (display_order between 1 and 4),
  unique(document_id, display_order)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_name on public.staff(first_name, last_name);
create index if not exists idx_duty_assignments_date on public.duty_assignments(duty_date);
create index if not exists idx_duty_assignments_schedule on public.duty_assignments(schedule_id);
create index if not exists idx_comp_docs_period on public.compensation_documents(period_year, period_month);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- Enable RLS on all application tables.
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.staff_compensation_rates enable row level security;
alter table public.duty_schedules enable row level security;
alter table public.duty_assignments enable row level security;
alter table public.signatories enable row level security;
alter table public.signatory_roles enable row level security;
alter table public.compensation_documents enable row level security;
alter table public.compensation_document_items enable row level security;
alter table public.compensation_daily_details enable row level security;
alter table public.document_signatories enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can read their own profile; admins can manage all profiles.
drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin());
drop policy if exists "profile admin update" on public.profiles;
create policy "profile admin update" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Access policy for the initial release:
-- Sensitive staff/rate/payment/audit records are ADMIN-ONLY.
-- Non-sensitive operational reference data can be read by authenticated users.
-- Mutations are ADMIN-ONLY until granular permissions are implemented and tested.

do $$
declare
  t text;
begin
  foreach t in array array[
    'staff',
    'staff_compensation_rates',
    'duty_schedules',
    'duty_assignments',
    'signatories',
    'signatory_roles',
    'compensation_documents',
    'compensation_document_items',
    'compensation_daily_details',
    'document_signatories',
    'audit_logs'
  ] loop

    -- Remove existing read policies before recreating
    execute format(
      'drop policy if exists %I on public.%I',
      t || ' authenticated read', t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      t || ' admin read', t
    );

    -- Create appropriate read policy
    if t in (
      'staff',
      'staff_compensation_rates',
      'compensation_documents',
      'compensation_document_items',
      'compensation_daily_details',
      'document_signatories',
      'audit_logs'
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_admin())',
        t || ' admin read', t
      );
    else
      execute format(
        'create policy %I on public.%I for select to authenticated using (true)',
        t || ' authenticated read', t
      );
    end if;

    -- Admin insert policy
    execute format(
      'drop policy if exists %I on public.%I',
      t || ' admin insert', t
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_admin())',
      t || ' admin insert', t
    );

    -- Admin update policy
    execute format(
      'drop policy if exists %I on public.%I',
      t || ' admin update', t
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || ' admin update', t
    );

    -- Admin delete policy
    execute format(
      'drop policy if exists %I on public.%I',
      t || ' admin delete', t
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      t || ' admin delete', t
    );

  end loop;
end $$;

-- Important: no public signup. Create users from Supabase Dashboard > Authentication > Users.
-- The trigger creates their profile with role='user'. Promote the first trusted account to admin
-- manually using the SQL instructions in SETUP-TH.md.
