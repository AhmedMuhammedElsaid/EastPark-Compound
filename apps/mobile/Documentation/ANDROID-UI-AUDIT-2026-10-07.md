# Android UI audit — 2026-10-07

Device: Samsung A72 (SM-A725F), Android, 1080x2400, density override 384, 3-button navigation.
Build: `com.eastpark.app.preview` 1.0.0 (versionCode 6, installed 2026-10-04). Signed in as the owner, Arabic, dark.
Reference skin: the live web app (`apps/web`): Alexandria, sticky header with brand mark, bordered cards,
76px bottom nav on the page background with a hairline top border and safe-area padding.

## P0 — broken / blocking

1. **Bottom tabs sit under the Android navigation buttons.** `(tabs)/_layout.tsx` hard-codes
   `height: 64, paddingBottom: 8`, which overrides React Navigation's bottom safe-area inset. With
   edge-to-edge + 3-button nav, the system bar and its light contrast scrim cover the tabs; only a ~20px
   strip is tappable and labels are washed out.
2. **App icon and adaptive icon are the template React atom**, not the EastPark mark
   (`assets/icon.png`, `assets/adaptive-icon.png`). Non-production builds also stamp a banner/ribbon badge.
3. **Splash is the template React atom** (`assets/splash-icon.png`).
4. **Splash holds for up to 60 s on a cold backend.** `use-auth-rehydration.ts` hides the splash only after
   `GET /user/profile` returns; on a Render cold start the user stares at the splash for ~60 s.
   Persisted auth state is already available, so the splash should hide right after reading tokens and
   the profile should refresh in the background.

## P1 — wrong content / misleading

5. ~~Governance hub titled "الإدارة"~~ — matches the web wording (owner choice); not a bug.
6. Profile security row says **"Face ID"** on Android (Samsung reports face first). The switch was ON, but its
   near-black thumb on the gold track read as OFF.
7. Elections card badge: near-white text on a near-white chip (unreadable).
8. "2 المرشحون" — Latin digit next to Arabic-Indic digits elsewhere, and wrong grammar. Digits are mixed
   across the app (prices Arabic-Indic, rating "4.0" and counts Latin).
9. Greeting uses a Latin comma: "مساء الخير, أحمد".
10. Poll detail: options are plain boxes with no vote affordance (no radio, no submit, no hint).
11. Announcement detail: title repeated in the header and body; no date/category; empty comments list
    has no empty message; composer floats with a large gap above the tab bar.
12. Orders empty state has no "Browse shops" button.

## P2 — layout / polish (match the web skin)

13. Home and Directory-preview grids are off-center (left gutter ~70px vs right ~33px).
14. Home: no app header (brand mark, cart, notifications bell); large dead gap between quick actions
    and "Latest"; page ends abruptly.
15. Shop detail: hero image runs under the status bar with no scrim; back/heart buttons collide with
    status icons; Menu/Reviews tabs sit above the shop name; WhatsApp button has a bright green border
    (design forbids bright greens); "+" add button cramped under the thumbnail.
16. Directory: no screen title; cards have excess bottom padding.
17. Community: large gap between the category chips and the first card; cards show no date.
18. Profile: selected segment (language/theme) barely distinguishable; no edit-profile, flats, phone or
    notification-settings entries; no admin entry for admins.
19. Font: mobile uses Cairo, web uses Alexandria — the two apps do not look like the same product.
20. Tab bar uses `card` background and filled icons; web uses page background, hairline border, gold
    active state.

## Journey findings (cart, checkout, feedback, light theme)

21. Shop detail checkout bar is a ~230px solid gold block (double bottom inset inside tabs).
22. Cart header shows the shop name in English in the Arabic UI; quantity controls are a vertical stack with
    ~30px targets; "Clear" is a small red text link.
23. **Address step "Next" does nothing** for an account without a unit (silent validation failure).
24. Feedback: admin-reply badge unreadable (light chip); no photo attachment on mobile (web has it);
    anonymous switch state unclear; placeholder repeats the label; unlabeled "+" header button.
25. Light theme: status-bar icons white on the light background (system bars never styled); shop hero
    back/heart buttons invisible on light photos.
26. No entry to the admin / merchant dashboards from Profile.
27. Font family name `Cairo` was embedded via the expo-font config plugin (works); switched to Alexandria.

## New for this release (owner, 2026-10-07)

Orders are placed in the backend as today AND handed to the shop on WhatsApp (prefilled message with the
order number, items, total, flat, notes). Shops without WhatsApp fall back to a call button.

## Not yet covered on device

Notifications feed and admin/merchant screens (no entry point in the installed build), English LTR.

## Status — 2026-10-07 (uncommitted, not yet on a device)

Fixed in code: 1–4, 6–27 (5 was not a bug). Highlights: inset-aware web-style tab bar + transparent nav bar,
real EastPark icon/adaptive icon/splash, splash no longer waits on the API, Alexandria font (vendored in
`assets/fonts`), shared `AppHeader` (brand, cart badge, unread dot) and `ScreenHeader` (44px back) on every
screen, bordered card skin, localized digits/dates, poll/election radio affordance + residents-only note,
WhatsApp order hand-off (`WHATSAPP_ORDER_HANDOFF`, `src/lib/whatsapp.ts`), short order number `#XXXXXX`
shown to residents and merchants (same as web `shortId`), profile dashboard entries for admin/merchant.

Gates: type-check 0, jest 15 suites / 124 + whatsapp 7, translations ar/en key parity OK, no new lint errors
(baseline `max-lines-per-function` / react-hooks errors remain).

Open: feedback photo attachment (needs `expo-image-picker`; `pnpm add` blocked by the
virtual-store-dir-max-length mismatch), new EAS preview build + device re-walk, English LTR pass.
