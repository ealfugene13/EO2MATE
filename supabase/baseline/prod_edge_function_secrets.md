# EO2MATE PROD Edge Function Secret Requirements

Baseline documentation only.
NEVER store actual secret values or secret digests in GitHub.

## EO2MATE / Application Secrets

- ADMIN_ONBOARDING_KEY
- AUCTION_FINALIZER_SECRET

## Meta / Facebook

- META_APP_ID
- META_APP_SECRET
- META_CONFIG_ID
- META_REDIRECT_URI
- META_WEBHOOK_VERIFY_TOKEN

## PayMongo

- PAYMONGO_SECRET_KEY
- PAYMONGO_WEBHOOK_SECRET
- PROD_PAYMONGO_SECRET_KEY
- PROD_PAYMONGO_WEBHOOK_SECRET

## Supabase Environment

- SUPABASE_ANON_KEY
- SUPABASE_DB_URL
- SUPABASE_JWKS
- SUPABASE_PUBLISHABLE_KEYS
- SUPABASE_SECRET_KEYS
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL

## Environment Standard

TEST and PROD must have separate environment-specific values.

Secret values must be configured through approved secret management
and must never be committed to the repository.
