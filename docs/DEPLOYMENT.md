# Deployment Checklist

This app is designed for Vercel + Supabase.

## Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` if using Google Gemini OCR
- `OPENROUTER_API_KEY` if using OpenRouter OCR fallback

Do not put service-role keys in client-side code or `NEXT_PUBLIC_*` variables.

## Supabase setup

1. Create a Supabase project.
2. Review `supabase/migrations/0001_baseline_schema.sql`.
3. Apply the migration in a preview Supabase project first.
4. Create a private storage bucket named `slips`.
5. Add the production site URL to Supabase Auth redirect URLs.

## Preview-first flow

Use a preview Vercel deployment and a preview Supabase project before touching production data.

Recommended order:

1. Apply database migration to preview Supabase.
2. Set Vercel preview env variables to preview Supabase keys.
3. Deploy preview branch.
4. Test login, create pawn, confirm transfer, collect interest, renew/topup, redeem, and reports.
5. Only after the preview is correct, apply the migration to production and promote/push to `main`.

## Manual preview test script

Run these checks on the Vercel preview URL:

1. Open the app with missing/incorrect env values in a disposable preview and confirm the error is clear.
2. Login as owner.
3. Create a pawn with a valid image smaller than 8 MB.
4. Try uploading a non-image or an image larger than 8 MB and confirm the app rejects it.
5. Confirm transfer for the pawn.
6. Collect interest with a valid amount and date.
7. Renew a pawn with principal paid down.
8. Top up a pawn with additional principal.
9. Create a redeem request and confirm it as owner.
10. Create a loan, add interest, pay down principal, then close it.
11. Add other income.
12. Open the report page and compare totals with the records created above.

## Important security notes

The current app still has client-side workflows for several financial actions. Before production use, move owner-only and multi-table actions behind server routes or Supabase RPC functions, then tighten RLS policies.
