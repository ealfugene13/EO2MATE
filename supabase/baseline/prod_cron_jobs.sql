-- EO2MATE PROD cron baseline
-- Captured from existing PROD configuration.
-- Reference only. Do not execute directly against PROD.

-- Job: auction-finalizer-every-minute
-- Schedule: every minute

select net.http_post(
  url :=
    (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'auction_project_url'
    )
    || '/functions/v1/meta-webhook?action=finalize',

  headers :=
    jsonb_build_object(
      'Content-Type',
      'application/json',
      'Authorization',
      'Bearer ' ||
      (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'auction_finalizer_secret'
      )
    ),

  body :=
    jsonb_build_object(
      'trigger',
      'auction_cron',
      'time',
      now()
    ),

  timeout_milliseconds := 10000
);
