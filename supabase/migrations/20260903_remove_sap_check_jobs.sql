drop table if exists public.sap_check_jobs;

alter table if exists public.mds_requests
drop column if exists sap_check_status,
drop column if exists sap_check_message,
drop column if exists sap_checked_at,
drop column if exists sap_check_run_id,
drop column if exists sap_info_record,
drop column if exists sap_deletion_flag;
