# Supabase Security Plan

## High priority

- Keep the `slips` bucket private. Use signed URLs instead of public URLs.
- Do not let anonymous clients read `settings.agent_pin`.
- Store agent PINs as hashes, not plain text.
- Move multi-step financial actions into Postgres functions or server routes.
- Enable RLS on all tables before production.

## Actions that should be atomic

- New pawn: upload slip, create pawn, create notification.
- Confirm pawn transfer: create transfer slip, update pawn status, create notification.
- Collect interest: create payment, create notification.
- Renew pawn: close old pawn, create redemption, create new pawn, create transfer slip, create notification.
- Top up pawn: close old pawn, create redemption, create new pawn, create notification.
- Redeem pawn: create redemption, update pawn pending status, create notification.
- Confirm redeem: confirm redemption, close pawn, create notification.
- Loan transaction: create transaction, update remaining principal/status.

## Suggested role model

- `owner`: Supabase Auth user with full access.
- `agent`: app role with limited actions through server routes or RPC only.

The current client-side PIN flow should be treated as a convenience login, not a database authorization boundary.
