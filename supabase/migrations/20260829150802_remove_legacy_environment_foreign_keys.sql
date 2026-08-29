-- Transitional EO2MATE standardization migration.
--
-- TEST and PROD are represented by separate Supabase projects.
-- CLNT is no longer treated as a deployment environment.
--
-- Existing application code still references the legacy environment
-- columns, so those columns are retained temporarily.

alter table public.auction_posts
  drop constraint if exists auction_posts_environment_fkey;

alter table public.client_subscriptions
  drop constraint if exists client_subscriptions_allowed_environment_fkey;

alter table public.order_groups
  drop constraint if exists order_groups_environment_fkey;
