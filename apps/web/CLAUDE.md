@AGENTS.md
@APPCONTEXT.md

# EastPark Web App — Session Context

Read `APPCONTEXT.md` before making changes. It is the canonical, self-contained context for this
standalone repository and must stay accurate for fresh clones.

## Current State — 2026-10-01

- Production: `https://eastpark-web-app.vercel.app`
- Active API: `https://eastpark-backend.onrender.com`; Fly remains rollback infrastructure.
- Vercel project: `eastpark-web-app`
- `NEXT_PUBLIC_API_URL` is configured in Vercel production without `/v1` or a trailing slash.
- Backend health, Prisma connectivity, lead insertion, and browser CORS were verified live.
- The BFF/auth/SEO/UI checkpoint is validated for standalone installation and production release.
- Browser requests use same-origin Next API routes. Auth tokens remain in `HttpOnly`, production
	`Secure`, `SameSite=Strict` cookies and must never be exposed to client JavaScript.
- Implemented: login, registration, OTP verification, resilient resident-lead proxy,
	error/not-found and thank-you routes, responsive theme-aware navigation/footer, Alexandria,
	RTL/LTR, SEO metadata, JSON-LD, robots, sitemap, manifest, social images, CSP, and security headers.
- Local parity adds forgot-password, reset-password, and invitation-acceptance flows through the
	same-origin BFF. One-time URL tokens are memory-only and removed from browser history; accepted
	invitations return only the user to JavaScript and keep session credentials in `HttpOnly` cookies.
- Login renders the shared footer. Login and unit-registration pages include explicit bottom spacing
	between their content and the footer.
- Duplicate active units are returned by the backend as HTTP 409; the BFF preserves that status and
	the form shows the bilingual reserved-unit message.
- Local parity work adds a public `/announcements` feed and `/announcements/[id]` detail view with
	bilingual content, category filters, cursor pagination, PDF links, and read-only comments. The
	same-origin `/api/announcements` and `/api/announcements/[id]` proxies runtime-validate backend
	responses and retry one transport failure. This slice is validated locally but is not deployed.
- Announcement comments come embedded in public `GET /v1/announcements/:id`. The backend has no
	comments-list endpoint, so web must not copy the mobile client's stale paginated-comments call.
- Local parity work adds an ADMIN-only `/admin` workspace for creating announcements, polls,
	elections, and election candidates. Server layouts verify the live profile role, expired access
	tokens refresh through `/api/admin/session`, and every write BFF repeats the ADMIN check before
	forwarding to the authoritative backend endpoint.
- Share description: `Commerce, services, and community in one trusted place. Built By Ahmed
	Muhammed Elsaid.`
- Validation: `pnpm check` runs lint, strict TypeScript, and the production build; last run passed
	with the dynamic announcement and admin routes present. The announcement detail
	view was browser-verified in Arabic/English at 1440px and 390px widths.
- The repository installs and builds independently; do not add path dependencies outside this
	repository to production code.
- Never commit `.env*`, `.vercel/`, credentials, or copied secret-bearing terminal output.
- Render cold-start mitigation is committed: login mounts call `GET /api/auth/login` for a
	best-effort health warm-up, server auth requests allow 25 seconds, interactive auth allows 30
	seconds, and the root scheduled workflow pings Render every 10 minutes. Production warm-up returns
	HTTP 204; do not revert this to a definite "no internet" message on generic transport failure.
- Password visibility uses the shared accessible eye/eye-off icon button across all auth forms.
- Public desktop header commit `5497ea2` pins brand and controls to opposite logical edges and keeps
	navigation centered. Browser checks passed in Arabic RTL and English LTR at 1440px and 390px with
	no overflow; mobile classes were intentionally preserved.
- Backend `POST /v1/support/issues` is ready, but the web support route/BFF/form/footer link remain
	unfinished and must not be described as shipped.
- Latest full validation: `pnpm check` passed with 59/59 routes.

## Immediate Next Work

Audit the authenticated resident experience mobile-first. The resident credential file is local to
the user's Downloads folder; automation may read it to log in but must never print, log, copy,
persist, or commit its contents. Start with `src/components/app/AppShell.tsx` and `/home`, then cover
every resident route at 320, 390, 768, 1024, 1440, and wide desktop in both Arabic RTL and English
LTR. Use Playwright screenshots and bounding-box/overflow checks, fix one measured root cause at a
time, and rerun `pnpm check` before committing.

## Resume Order

1. Read this file, `APPCONTEXT.md`, parent `CLAUDE.md`, and parent `restructure.md`.
2. Check both parent and child Git status; nested repositories have independent histories.
3. Run `pnpm check` in this repository.
4. Checkpoint and deploy the current web work before broad feature parity work.
5. Mirror mobile features as small vertical slices. Use quick Explore subagents for discovery,
	 mobile as the behavioral reference, and backend contracts as authoritative. Do not invent APIs.

Operational follow-up: rotate credentials exposed during initial deployment. Real Paymob credentials
are still required before card payments; that does not block this resident lead form.
