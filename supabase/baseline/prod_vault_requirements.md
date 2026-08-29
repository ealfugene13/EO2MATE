# EO2MATE PROD Vault Requirements

Baseline documentation only.
NEVER store actual secret values in GitHub.

## Vault secrets

### auction_finalizer_secret
- Required by: auction-finalizer-every-minute cron job
- Purpose: Authorization bearer credential used when calling the auction finalizer endpoint.

### auction_project_url
- Required by: auction-finalizer-every-minute cron job
- Purpose: Base Supabase project URL used to construct the meta-webhook finalizer endpoint.

### auction_finalizer_service_role
- Description in PROD: Service role key used by auction finalizer cron
- Current baseline observation: Exists in PROD Vault but is not referenced by the current cron.job command.
- Status: Preserve and review during TEST configuration; do not remove from PROD during baseline capture.

## Security rule

Secret VALUES must be configured separately for each environment.
TEST and PROD must never share environment-specific credentials merely for convenience.
