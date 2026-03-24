create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'moneymanage-reminder-push'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select
  cron.schedule(
    'moneymanage-reminder-push',
    '*/5 * * * *',
    $$
    select
      net.http_post(
        url := 'https://YOUR_VERCEL_DOMAIN/api/cron/reminder-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer YOUR_CRON_SECRET'
        ),
        body := '{}'::jsonb
      );
    $$
  );
