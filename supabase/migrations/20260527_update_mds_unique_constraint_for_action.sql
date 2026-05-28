drop index if exists public.mds_requests_supplier_material_unique;

create unique index if not exists mds_requests_supplier_material_action_unique
on public.mds_requests (supplier_code, part_number, action_type);
