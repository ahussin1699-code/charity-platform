-- جداول أدوار المستخدمين والكيانات المرتبطة
-- شغّل هذه التعليمات في Supabase SQL

-- donors (المتبرعون)
create table if not exists public.donors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text unique not null,
  name text,
  phone text,
  created_at timestamp with time zone default now()
);

-- beneficiaries (المستفيدون)
create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text unique not null,
  name text,
  phone text,
  address text,
  created_at timestamp with time zone default now()
);

-- doctors (الأطباء)
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text unique not null,
  name text,
  specialty text,
  created_at timestamp with time zone default now()
);

-- supervisors (المشرفون)
create table if not exists public.supervisors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text unique not null,
  name text,
  created_at timestamp with time zone default now()
);

-- حالات (موجودة غالباً) نضيف علاقة اختيارية للمستفيد
alter table if exists public.cases
  add column if not exists beneficiary_id uuid references public.beneficiaries(id);

-- إضافة عمود الحالة لجدول الحالات إذا لم يكن موجوداً
alter table if exists public.cases
  add column if not exists status text default 'قيد المراجعة';

-- طلبات التبرع
create table if not exists public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  donor_id uuid references public.donors(id),
  amount numeric,
  status text default 'قيد المراجعة',
  created_at timestamp with time zone default now()
);

-- فهارس بسيطة
create index if not exists idx_doctors_email on public.doctors(email);
create index if not exists idx_supervisors_email on public.supervisors(email);
create index if not exists idx_donors_email on public.donors(email);
create index if not exists idx_beneficiaries_email on public.beneficiaries(email);
create index if not exists idx_donation_requests_case on public.donation_requests(case_id);
