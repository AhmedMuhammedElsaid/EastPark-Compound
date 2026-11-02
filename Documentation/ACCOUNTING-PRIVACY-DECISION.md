# Accounting: privacy-policy timing and slip photos (decision)

Answers the two blocking owner questions in `ACCOUNTING-PHASE-1A-TASKS.md`. Sources: plan §5, §9, §10, Q8;
the live policy `apps/web/src/content/privacy-policy.ts` (2026-10-12). Not legal advice: an Egyptian lawyer
should read the final text.

## Why "wait for 1b" fails

- The disclosure duty comes from **processing**, not from what residents can see. A payment recorded against
  a flat is personal data about an identifiable owner, and sometimes about a payer with no app account.
- PDPL 151/2020 counts financial data as *sensitive*, and its 2025 executive regulations make the law
  enforceable. Treat the ledger strictly.
- The live policy says nothing about finance: no "financial info" category. The only payment text is
  marketplace cash on delivery. The listed uploads (profile photos, feedback photos, PDF reports) are said to be
  served from **public links** (§3, §7), which slips must never be.

## Decision 1: the finance section ships with slice 6, not 1b

**`/privacy` must be updated in prod no later than the first slice 6 deploy.** Slice 6 adds the accountant
flats read (owner name and phone) and `POST /finance/charges`. That is the first prod code that records or
exposes finance personal data.

- Slices 1 to 5 can ship without the update. The role collects nothing, and flat links are already disclosed.
  Describe ownership history (`FlatOwnership`) in the same update.
- It is a web-only change to one module. Commit it as part of slice 6 and deploy the web app first.
- **Operational gate:** no ACCOUNTANT invite and no finance row in prod until the new policy is live. Bump
  `PRIVACY_EFFECTIVE_DATE`. Policy §13 promises notice of significant changes, so post an in-app
  announcement.

## Decision 2: no slip photos in prod before the policy names them

**Not acceptable.** Slips can carry third-party names, bank account numbers and cheque images, the most
sensitive data the app would hold. The current policy's "images are public links" statement would also be
wrong for them. Decision 1 already covers this because slice 6 deploys before slice 7. If slice 7 ever
deploys first, it carries the update. Local or staging test data is fine.

## What the finance section must cover

Add a new bilingual section (the sync test enforces AR/EN parity) and patch the existing sections named
below rather than repeating them:

- **Data:** per flat: charges, payments (amount, date, method, reference, cheque status), receipt numbers,
  credit and balance, and ownership periods. Also the payer's name when it is not the owner, and slip or
  cheque photos that may show names and bank details.
- **Purpose:** collecting service charges and maintenance-fund contributions, issuing receipts, keeping the
  compound accounts, resolving disputes.
- **Legal basis (§5):** necessary to manage the owner's obligations to the compound and to meet accounting
  and legal duties. It does not rest on consent, so there is no opt-out.
- **Who sees it (§6):** admins and named accountants. Accountants get owner name and phone only: no email,
  national ID or passport. From 1b, an owner sees their own statement for their ownership period. A new owner
  sees one brought-forward figure, never the previous owner's payments. Published summaries are aggregate.
  Every finance write and every slip view is audited.
- **Private storage (§3, §7):** this is an exception to the public-links item. Attachments go in a separate
  private Supabase bucket (Supabase is already a listed processor) and open only through 60-second links.
  Residents never receive them. Add staff slip photography to the camera item.
- **Retention (§8):** 7 years (Q8), then archive or delete. Account deletion closes ownership but keeps the
  finance rows, which belong to the flat and are shown as "former owner".
- **Rights (§10):** access and correction. Corrections are made as reversal entries, never edits. Erasure is
  limited during the retention period.

## Play Data safety form

**Yes, it changes.** It describes what the **mobile app** collects. Finance enters the mobile app in slice 8
(accountant screens, delivered by OTA, which skips Play review but does not lift the duty), and residents get
it in 1b.

- Add **Financial info → Other financial info**: collected, not shared (processors are not sharing), purposes
  App functionality and Account management, required, encrypted in transit. Deletion: say that some data is
  kept for legal and accounting reasons.
- **Photos:** check the existing declaration (profile and feedback photos). Add the payment-slip use, or
  declare Photos if it is missing.
- **When:** before the slice 8 OTA reaches any accountant. Slices 6 and 7 are web and backend only and do not
  need it. If the pending first Play submission comes after slice 8, include it there. Re-check at 1b: no new
  category, but resident visibility changes the answers' context.
