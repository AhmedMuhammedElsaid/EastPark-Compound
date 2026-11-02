# Accounting slice 8 review — Accountant UI

Commits `4e596d1` (mobile) and `83f1b6e` (web), diff `5e69356..83f1b6e`. Reviewed 2026-11-02.
Independent review; no source changed.

## Findings

### M1 — Mobile: money screens are not refreshed after a payment is recorded (stale balance / today total)

- Files: `apps/mobile/src/components/finance/use-payment-submission.ts:43-73` (no `onSuccess` invalidation),
  `apps/mobile/src/app/(finance)/finance/payment/new.tsx:211-221` (Done = `router.back()`),
  `apps/mobile/src/services/api/finance.ts:223` (`MONEY_QUERY` relies on `refetchOnMount`).
- Problem: `gcTime: 0` + `refetchOnMount: "always"` only helps when a screen *mounts*. In an Expo
  Router stack the Today screen and the flat ledger stay mounted underneath `payment/new`; nothing
  calls `invalidateQueries(financeKeys.all)` after `createPayment` succeeds, and there is no
  `useFocusEffect` refetch. The `["finance","flat",id]` query is even shared with the `new` screen's
  preset, so its last fetch is the *pre-payment* figure.
- Scenario: accountant opens flat A1-3-2 (owes 900) → Record payment 900 → receipt → Done →
  back on the ledger it still shows "Owes 900 EGP" and the open charges; Today still shows the old
  "Collected today". A second accountant action (another payment, or "apply credit" with the stale
  `availableCredit`) is based on wrong numbers; a second cash collection from the resident is the
  realistic failure. (Apply-credit is protected by `creditChanged`; a new payment is not.)
- Fix: in `usePaymentSubmission` (and the apply-credit mutation) `onSuccess` →
  `queryClient.invalidateQueries({ queryKey: financeKeys.all })`; optionally also refetch on screen
  focus (`useFocusEffect`) for Today / flat ledger. Add a test that a success invalidates `["finance"]`.

### M2 — Mobile: an unconfirmed payment stays editable and its body is rebuilt on retry

- Files: `apps/mobile/src/app/(finance)/finance/payment/new.tsx:161-176` (`buildInput` recomputes
  `receivedAt` from `cairoToday()` on every submit), `:178-208`, `:240-330` (fields only disabled while
  `isPending`); `use-payment-submission.ts:43-48` (key kept across edits).
- Problem: after a no-response failure the banner says "Tap Try again: it will not be recorded twice",
  but the form is unlocked and the next submit re-reads every field (and today's date). The web desk
  locks the body (`PaymentSubmission.unconfirmed`); mobile does not. Any change (amount typo fix,
  another slip photo → new upload path, crossing Cairo midnight, or `force` dropped because "Try
  again" calls `submit()` without `force` after a forced attempt timed out) changes the request hash.
- Scenario: 23:59 cash payment, response lost; accountant taps Try again at 00:01 without touching
  anything → `receivedAt` is now tomorrow's date → if the first request landed the server answers
  409 `idempotencyConflict` and the banner offers "Start a new payment"; following it posts the
  payment twice. No double posting happens on the same key, but the UX promise is false and the
  offered escape leads to the duplicate.
- Fix: store the first built input (incl. `receivedAt`, `force`, uploaded `attachmentPath`) with the key
  and re-send it verbatim while unconfirmed; lock the form (or require an explicit "discard and edit"
  that first sends the user to the flat's recent payments), as web does.

### L1 — Web BFF: `financeIdSchema` accepts `.` and `..` as an id

- File: `apps/web/src/lib/finance/schemas.ts:61`, used by `app/api/finance/[[...path]]/route.ts:44-46`.
- Problem: `/^[A-Za-z0-9_.-]{1,64}$/` admits `..`; `encodeURIComponent('..') === '..'`, so
  `/api/finance/payments/%2E%2E/void` becomes backend `/finance/payments/../void`, which `fetch` URL
  normalisation turns into `/v1/finance/void`. Only one id segment exists, so the reach stays inside
  `/v1/finance/*` (all role-guarded, unknown paths 404) — no exploitable path today, but the allow-list
  no longer guarantees the backend route it was meant to.
- Fix: reject ids made only of dots (e.g. `/^(?!\.+$)[A-Za-z0-9_.-]{1,64}$/`) and add a route test.

### L2 — Web slip size limit lets near-limit files fail at the BFF

- Files: `components/finance/FinancePaymentNew.tsx:43` (file ≤ 4.5 MB) vs
  `app/api/finance/attachments/route.ts:11,23,30` (whole multipart body ≤ 4.5 MB).
- Scenario: a 4.49 MB scan passes the client check; multipart headers push the body over 4.5 MB →
  413 `attachmentTooLarge` after the upload. Also PDFs up to 10 MB (backend limit) can never be sent
  from web; copy should say so.
- Fix: client cap ≈ 4.4 MB (leave room for the envelope) and state the web limit in the hint.

### L3 — Mobile Today: "Collected today" counts uncleared cheques; date frozen at mount

- File: `apps/mobile/src/app/(finance)/finance/today.tsx:62-75`.
- Problem: sums every `status: "POSTED"` payment including `PENDING_CLEARANCE` (and a cheque that
  bounced the same day if its status stays POSTED) as cash collected; `today` is `useMemo`'d, so a screen
  left open past Cairo midnight keeps querying yesterday.
- Fix: label it "Recorded today" or exclude non-cleared cheques from the sum; recompute the date on focus.

### L4 — Mobile error copy for ambiguous 5xx on payment create

- File: `apps/mobile/src/lib/finance.ts:52-57`, `payment/new.tsx:204-205`.
- Problem: a 502/503/504 on `POST /finance/payments` (Render cold start, gateway) shows
  "storage unavailable"/"server error" instead of the "may be recorded, retry is safe" message; the
  payment may have committed. Only `status === undefined` gets `retry_safe`.
- Fix: for the create-payment call treat 5xx/408/429 like no response (`retry_safe`).

### L5 — Idempotency key lives only in component state (both clients)

- Files: web `FinancePaymentNew.tsx:74`, mobile `use-payment-submission.ts:41`.
- Problem: leaving the screen after an unconfirmed attempt drops the key; the next entry is a new
  payment. The backend's only other guard is `duplicateReference`, which cash payments without a
  reference never trigger.
- Fix (cheap): on an unconfirmed failure, tell the user to check the flat's recent payments before
  leaving; optionally keep the pending attempt in memory (not storage) per flat until confirmed.

## Checked and found correct

- BFF allow-list: fixed method/path table, ids validated + encoded, queries rebuilt from Zod output,
  only GET/POST exported; role guard (`requireFinance` → ACCOUNTANT/ADMIN/SUPER_ADMIN) on every BFF
  route and the `/finance` layout; mobile `(finance)/_layout` guard; internal secret + client IP via
  the shared `backendFetch`; errors reduced to allow-listed `finance.<key>` codes (list equals backend
  `finance.json`); responses `private, no-store`, routes `force-dynamic`.
- Slip view: 302 only to an https URL taken from the backend, `no-store` + `no-referrer`, never in a
  body or log; failures return `?slip=<code>` to the same-origin payment page (no open redirect).
- Multipart passthrough keeps the browser content-type/boundary; size checked before and after read.
- Money: integer piasters on web, string parsing on mobile, decimal strings sent; `expectedCredit`
  sent from the displayed `availableCredit` on both clients and `creditChanged` handled.
- `duplicateReference` + force: the refused request created no row, so web's new key and mobile's
  reused key are both accepted by `runIdempotent`; neither can double-post.
- Mobile: `finance` root not persisted, `gcTime: 0`; no `*.test.tsx` under `src/app`; route-collision
  test extended; no new native dependency (expo-image-picker + camera permission already present).

## Verdict

No High findings. Two Medium mobile issues (stale money screens after a payment; editable/rebuilt
unconfirmed retry) should be fixed before the accountant pilot; the Lows are hardening. Web slice is
sound.
