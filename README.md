# Auction Client UI v10

Adds optional PayMongo capability management and removes Facebook as a hard login gate.

## Client behavior
- Portal access works without Facebook and without PayMongo.
- Facebook setup can be skipped and completed later.
- Dashboard shows PayMongo status.
- NOT_CONFIGURED -> Set Up PayMongo opens the official signup page.
- Existing account -> Open PayMongo Dashboard.
- Payments navigation and online-payment dashboard functions stay disabled until `payment_enabled=true`.

## Required Edge Functions
- facebook-connection-status
- client-payment-status
- mark-paymongo-account-created

## Backend requirement
`create-payment` must independently reject clients without an ACTIVE enabled payment account. Hiding UI controls is not a security boundary.


## V11 payment lifecycle UI

- Payment group/payment-window monitoring
- Payment deadline and remaining-time display
- Payment expired / reopened status display
- Admin-only “Allow Payment Again” action
- Configurable reopen window (1–168 hours) and reason
- Calls the `payment-admin` Supabase Edge Function

Note: the `order_groups` table must be readable by the signed-in client's RLS policy.
