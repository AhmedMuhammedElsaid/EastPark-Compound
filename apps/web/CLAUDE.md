@AGENTS.md
@APPCONTEXT.md

# EastPark Web App — Session Context

Read `APPCONTEXT.md` before making changes. It is the canonical, self-contained context for this
standalone repository and must stay accurate for fresh clones.

## Current State — 2026-10-02

- Root `main` is committed and pushed; clone or pull `origin/main` for the current checkpoint. Production is
	`https://eastpark-web-app.vercel.app` with active API
	`https://eastpark-backend.onrender.com`.
- Authenticated resident parity, responsive layouts, showcase content, feedback, governance-first
	navigation, profile management, optional resident details, and admin resident operations are
	committed.
- Resident invitation/onboarding, account links, email relay and safe diagnostics, expired-session
	redirects, logout, loading feedback, password guidance, and unit-registration navigation were
	hardened for launch.
- Profile photo upload UI uses the shared `/api/uploads/image` BFF. Commit `e4bed42` preserves the
	original multipart boundary and bytes when forwarding to `POST /v1/uploads/image`.
- Fresh 2026-10-02 validation: `pnpm check` passes lint, strict TypeScript, and production build
	with 61/61 pages generated; parent backend strict typecheck also passes.
- Vercel Web Analytics is mounted globally in `src/app/layout.tsx` through `@vercel/analytics` and
	is included in the validated production build.
- **Blocking defect:** deployed image upload still does not work. Profile photos and feedback
	attachments are unverified/broken. Reproduce with an authenticated request, retain only sanitized
	status/error details, inspect Vercel/Render logs and Supabase Storage configuration, and require a
	real uploaded image URL to load before marking this complete.
- The parent tracked tree is clean. Parent `eastpark-frontend/` is an untracked legacy/user-owned
	directory; do not add or delete it.

Rerun `pnpm check` after installing on the destination machine; do not infer upload health from a
successful build because the failure is runtime/infrastructure-facing.

## Previous State — 2026-10-01

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
	tokens refresh through the shared `/api/auth/refresh` bounce route, and every write BFF repeats the ADMIN check before
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

Investigate the deployed image-upload failure first. The browser sends `FormData` to
`src/app/api/uploads/image/route.ts`; that route forwards the original multipart content type and
bytes to backend `/uploads/image`. Determine whether failure occurs at Vercel auth/proxying, Render
multipart handling, or Supabase Storage. Never expose credentials or auth cookies. Success requires
both profile-photo and feedback-attachment flows to return a URL that loads. Then rerun `pnpm check`
and the relevant backend checks before committing.

## Resume Order

1. Read this file, `APPCONTEXT.md`, parent `CLAUDE.md`, and parent `restructure.md`.
2. Check both parent and child Git status; nested repositories have independent histories.
3. Run `pnpm check` in this repository.
4. Checkpoint and deploy the current web work before broad feature parity work.
5. Mirror mobile features as small vertical slices. Use quick Explore subagents for discovery,
	 mobile as the behavioral reference, and backend contracts as authoritative. Do not invent APIs.

Operational follow-up: rotate credentials exposed during initial deployment. Real Paymob credentials
are still required before card payments; that does not block this resident lead form.
