alter table public.learning_contents
  add column if not exists snapshot_urls text[] default '{}'::text[],
  add column if not exists snapshot_count integer default 0,
  add column if not exists snapshot_status text default 'missing',
  add column if not exists snapshot_strategy text,
  add column if not exists snapshot_generated_at timestamptz;

update public.learning_contents
set
  snapshot_urls = coalesce(page_screenshots, '{}'::text[]),
  snapshot_count = coalesce(array_length(page_screenshots, 1), 0),
  snapshot_status = case
    when coalesce(array_length(page_screenshots, 1), 0) > 0 then 'ready'
    else 'missing'
  end,
  snapshot_generated_at = coalesce(snapshot_generated_at, updated_at)
where
  coalesce(array_length(snapshot_urls, 1), 0) = 0;
