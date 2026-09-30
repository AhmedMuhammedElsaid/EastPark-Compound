@AGENTS.md
@APPCONTEXT.md

# EastPark Web App — Session Context

Read `APPCONTEXT.md` before making changes. It is the canonical, self-contained context for this
standalone repository and must stay accurate for fresh clones.

## Current State — 2026-09-30

- Production: `https://eastpark-web-app.vercel.app`
- API: `https://eastpark-backend.fly.dev`
- Vercel project: `eastpark-web-app`
- `NEXT_PUBLIC_API_URL` is configured in Vercel production without `/v1` or a trailing slash.
- Backend health, Prisma connectivity, lead insertion, and browser CORS were verified live.
- The BFF/auth/SEO/UI checkpoint is validated for standalone installation and production release.
- Browser requests use same-origin Next API routes. Auth tokens remain in `HttpOnly`, production
	`Secure`, `SameSite=Strict` cookies and must never be exposed to client JavaScript.
- Implemented: login, registration, OTP verification, resilient resident-lead proxy,
	error/not-found and thank-you routes, responsive theme-aware navigation/footer, Alexandria,
	RTL/LTR, SEO metadata, JSON-LD, robots, sitemap, manifest, social images, CSP, and security headers.
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
- Share description: `Commerce, services, and community in one trusted place. Built By Ahmed
	Muhammed Elsaid.`
- Validation: `pnpm check` runs lint, strict TypeScript, and the production build; last run passed
	with 26/26 static pages generated and dynamic announcement feed/detail routes present. The detail
	view was browser-verified in Arabic/English at 1440px and 390px widths.
- The repository installs and builds independently; do not add path dependencies outside this
	repository to production code.
- Never commit `.env*`, `.vercel/`, credentials, or copied secret-bearing terminal output.

## Resume Order

1. Read this file, `APPCONTEXT.md`, parent `CLAUDE.md`, and parent `restructure.md`.
2. Check both parent and child Git status; nested repositories have independent histories.
3. Run `pnpm check` in this repository.
4. Checkpoint and deploy the current web work before broad feature parity work.
5. Mirror mobile features as small vertical slices. Use quick Explore subagents for discovery,
	 mobile as the behavioral reference, and backend contracts as authoritative. Do not invent APIs.

Operational follow-up: rotate credentials exposed during initial deployment. Real Paymob credentials
are still required before card payments; that does not block this resident lead form.
