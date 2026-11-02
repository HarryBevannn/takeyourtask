-- Calls the send-notification-emails Edge Function every 5 minutes.
-- The function only accepts calls carrying a random secret that is generated here
-- and kept in Supabase Vault, so nobody needs to copy it anywhere.
-- Project-specific: the URL below points at this project's functions.

create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'email_cron_secret')
where not exists (select 1 from vault.secrets where name = 'email_cron_secret');

create function public.email_cron_secret_matches(secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    -- Qualified: vault.decrypted_secrets has its own "secret" column.
    select 1 from vault.decrypted_secrets
    where name = 'email_cron_secret' and decrypted_secret = email_cron_secret_matches.secret
  );
$$;

revoke execute on function public.email_cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.email_cron_secret_matches(text) to service_role;

select cron.schedule('send-notification-emails', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://tfpfzpqjihcqlnicfkff.supabase.co/functions/v1/send-notification-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')
    ),
    body := '{}'::jsonb
  );
$job$);
