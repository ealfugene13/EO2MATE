# Auction Client UI v9

Adds the first-time Facebook onboarding gate.

## Behavior

- Authenticated client with no ACTIVE Facebook Page:
  - automatically opens **Facebook Setup**
- Client with an ACTIVE Facebook Page:
  - continues directly to the **Dashboard**
- Facebook OAuth callback result keeps the user on **Facebook Setup**
- Connected clients get **Continue to Dashboard**
- Facebook Setup remains available in the sidebar for reconnect/status checks
- Dashboard can display a Facebook connection warning if a disconnected state is detected

## Required Edge Function

- `facebook-connection-status`

Existing Edge Functions remain unchanged.
