# EO2MATE PROD Configuration Findings

Baseline review only.
Do not change PROD based on this file without TEST validation first.

## JNT_BOOKING_MODE

Referenced by:
- create-delivery-booking

Behavior:
- Optional
- Defaults to MANUAL when not configured

Current PROD secret list:
- JNT_BOOKING_MODE not configured

Baseline conclusion:
- Current deployed behavior defaults to MANUAL booking mode.

## PAYMENT_LIFECYCLE_SECRET

Referenced by:
- payment-lifecycle

Behavior:
- Required by protected payment lifecycle requests
- Function returns PAYMENT_LIFECYCLE_SECRET_NOT_CONFIGURED when absent

Current PROD secret list:
- PAYMENT_LIFECYCLE_SECRET not configured

Repository search:
- No frontend, workflow, or other Edge Function caller was found in the captured baseline.

Baseline conclusion:
- Preserve as a configuration finding.
- Determine intended caller/use in TEST before changing PROD.

## VERIFY_TOKEN

Referenced by:
- meta-webhook

Behavior:
- Used for Meta webhook verification.

Current PROD secret list:
- VERIFY_TOKEN not configured
- META_WEBHOOK_VERIFY_TOKEN is configured

Baseline conclusion:
- Secret-name mismatch exists between deployed source and configured PROD secret name.
- Validate and correct in TEST first.
- Do not rename/delete PROD secrets during baseline capture.
