# Auction Client UI v8

Adds client-facing Facebook onboarding.

## New
- Facebook Setup navigation
- Connect / reconnect Facebook button
- Calls existing `facebook-oauth-start` with the logged-in client ID
- Connected Page status display
- Safe status lookup through `facebook-connection-status` Edge Function
- Onboarding checklist and client requirements

## Required Edge Function
Deploy `facebook-connection-status.ts` as `facebook-connection-status`.

Existing required functions remain unchanged.
