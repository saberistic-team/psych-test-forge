# Paid listings, creator earnings, admin plan controls, and Pro add-on packs

Three connected pieces: creators can sell access to a listed questionnaire and see what they earned; admins can change a customer's tier and top up their monthly allowances; Pro creators can buy one-off packs that raise their own allowances for the current month.

## 1. Paid marketplace listings (Business plan)

On a listed test, a Business creator can set a price and a sale mode:

- **Pay to take** — the respondent pays before starting.
- **Pay to unlock results** — free to take, pay to see the full report.

Rules:
- Price is optional; leaving it empty keeps the listing free (today's behaviour).
- Setting a price is Business-only. Pro/Free see the field with an upgrade prompt.
- Explore shows a price badge and filters for free vs paid.
- Checkout runs through the existing payments provider (already wired for the premium report), so the platform stays merchant of record. Purchases are recorded per test, per buyer, with the environment (test/live) attached, and entitlement is checked server-side before the questionnaire or the report is served — never trusted from the browser.
- Refunds/chargebacks received on the webhook reverse the earning line so nobody is paid out for a refunded sale.

## 2. Creator earnings dashboard and monthly settlement

Every paid sale writes an earnings line: gross amount, platform fee, creator net, test, month.

- The revenue split is an **admin-configurable rate**: one platform default, optionally overridden per creator. The rate in force at the time of sale is stored on the line, so later rate changes never rewrite history.
- New **Earnings** page for creators: this month's gross/fees/net, per-test breakdown with units sold and conversion, and a list of past months with status (Open, Pending payout, Paid) plus a CSV export.
- Admin **Payouts** view: each closed month per creator with the amount owed, payout notes/reference, and a "Mark as paid" action. Payment itself happens outside the app (bank/PayPal/Wise) — the app is the ledger of record, not a payments rail.
- Creators enter payout details (method + reference, e.g. IBAN or PayPal email) on the Earnings page so admins know where to send money. Stored server-side, readable only by the creator and admins.
- A month closes when the next month starts: open lines are grouped into a payout row for that creator.

## 3. Admin controls over customers

New "Manage" panel on each creator row in Admin:

- **Change tier** — set Free / Pro / Business manually. Recorded with who changed it and why. A manual tier is respected over the subscription-derived plan until cleared, so an admin grant isn't overwritten by the next webhook.
- **Add credits** — grant extra AI generations, extra attempts, or extra marketplace listing slots for the current month (or as a recurring monthly bonus). Grants are additive on top of the plan allowance.
- **Set revenue share** — override the platform fee for that creator.
- Every action is written to an admin audit log visible in Admin.

## 4. Pro add-on packs

Pro creators can buy one-off packs from Billing that apply to the current month:

| Pack | Adds | Price |
| --- | --- | --- |
| Generations pack | +25 AI generations | $9 |
| Attempts pack | +500 attempts | $9 |
| Listings pack | +3 marketplace listings | $9 |

- Packs stack (buying two attempt packs adds 1,000).
- Packs expire at the end of the billing month; unused amounts do not roll over. Billing states this clearly.
- Business has unlimited generations/listings already, so only the attempts pack is offered there.
- Billing shows "50 included + 25 purchased + 10 granted by admin" so the source of every unit is visible.

## Effective limit rule

All three sources feed one calculation used everywhere a limit is enforced:

```text
effective limit = plan allowance + purchased packs (this month) + admin grants (this month)
```

Unlimited (Business generations/listings) stays unlimited. Generation refunds on failure keep working unchanged.

## Technical notes

- Migrations (each with GRANTs, RLS enabled, and policies): `listing_prices` fields on `tests` (`price_cents`, `sale_mode`), `listing_purchases`, `creator_earnings`, `payouts`, `payout_accounts`, `usage_grants` (admin grants + purchased packs, one table with a `source` column), `admin_audit_log`, and `platform_settings` for the default revenue share; plus `revenue_share_bps` and `plan_override` on `profiles`.
- Payment provider catalog: new products/prices for the three add-on packs, and a dynamic-price checkout for paid listings (creator-set amount).
- Webhook (`src/routes/api/public/payments/webhook.ts`) gains handlers for pack purchases (write a `usage_grants` row), listing purchases (write `listing_purchases` + `creator_earnings`), and refunds (reverse the earning). Signature verification and the sandbox/live split stay as they are.
- `src/lib/usage.server.ts`: `planForUser` respects `plan_override`; new `effectiveLimits(userId)` folds in grants; `checkAndCountGeneration`, `checkAndCountAttempt`, and `checkAndCountListing` switch to it.
- New `src/lib/earnings.server.ts` + `earnings.functions.ts` (creator reads, admin payout actions), `src/lib/admin.functions.ts` (tier/credit/rate mutations, admin-verified via the caller's role, service-role client loaded inside the handler after the check).
- New routes: `_authenticated/earnings.tsx`; Admin and Billing extended in place. Month-close runs lazily on first read of a new month — no cron needed.
- Explore/take/results paywall gates live in `marketplace.functions.ts` and `participant.functions.ts` server-side.
- Legal pages get a short paid-listings/creator-earnings section (sales are made by the platform as merchant of record; creators are paid monthly net of the platform fee).
