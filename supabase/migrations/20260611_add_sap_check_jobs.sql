alter table public.mds_requests
add column if not exists sap_check_status text default 'Not Checked',
add column if not exists sap_check_message text,
add column if not exists sap_checked_at timestamptz,
add column if not exists sap_check_run_id text,
add column if not exists sap_info_record text,
add column if not exists sap_deletion_flag boolean;

create table if not exists public.sap_check_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id text,
  record_ids text[] not null default '{}',
  status text not null default 'Queued',
  requested_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text
);

alter table public.sap_check_jobs
add column if not exists batch_id text,
add column if not exists record_ids text[] not null default '{}',
add column if not exists status text not null default 'Queued',
add column if not exists requested_by text,
add column if not exists created_at timestamptz not null default now(),
add column if not exists started_at timestamptz,
add column if not exists finished_at timestamptz,
add column if not exists error_message text;

create index if not exists sap_check_jobs_status_created_at_idx
on public.sap_check_jobs (status, created_at);

create index if not exists mds_requests_sap_check_run_id_idx
on public.mds_requests (sap_check_run_id);

create index if not exists mds_requests_sap_check_status_idx
on public.mds_requests (sap_check_status);
