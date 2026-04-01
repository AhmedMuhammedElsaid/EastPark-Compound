# EastPark — Design System (DESIGN.md)

> Single source of truth. Supersedes CLAUDEDESIGN.md, UIUX.md, EASTPARKDESIGN.md, and EASTPARKDESIGN1.md.
> Color palette derived from the EastPark brand logo (eastpark.jpg).
> Aligned with FrontendPlan.md (all screens covered) and .impeccable.md (token authority).
> Design quality enforced via Impeccable skill pack — 21 commands active in Claude Code.
> All decisions are final. Re-open only if brand fundamentals change.

---

## 0. Brand Identity & Philosophy

### What the Logo Says

| Element | Signal |
|---|---|
| Deep warm near-black background | Premium luxury real estate — not a startup |
| Warm gold diamond mark | Prestige, community ownership, MENA luxury |
| Serif wordmark "EAST PARK" | Established, trustworthy, high-end |
| "INTEGRATED COMMUNITY" caption | Functional but premium |

**This is not a green app. It is a gold-and-black premium residential brand.**

Dark mode is the native/flagship experience — the logo lives on black. Every screen must feel like it belongs to the same brand as the logo: near-black, antique gold, warm white serif. Not a generic community app. Not a colorful supermarket. A premium integrated community.

### Design Formula

| Source App | Contribution |
|---|---|
| **MyGate** | Foundational structure — quick actions, status timelines, role-based layout, complaint workflows |
| **Talabat** | Commerce excellence — hero carousel, category pills, card design, cart mechanics, single-scroll checkout |
| **Facebook** | Community engagement — reactions, comment threads, infinite scroll, "new posts" float chip |
| **YouTube** | Premium transitions — smooth navigation, sticky tabs, auto-dismiss overlays, parallax |
| **EastPark Logo** | The soul — Black × Gold × White, luxury typeface, warm undertones, no neon, no clutter |

### Core Principles

1. **Gold is reserved** — primary CTAs, active states, logo mark, key icons only. Not decorative fill.
2. **Dark mode is the prestige mode** — it IS the logo. Ship dark as default, offer light as toggle.
3. **Warmth in every token** — no cold zinc grays, no pure black or white surfaces.
4. **Rich motion, purposeful** — spring physics, Lottie on key moments, skeleton shimmer always (never spinners).
5. **Luxury restraint** — less is more; gold used sparingly and intentionally.

### The 6 Pillars

1. **Prestige over perk** — Gold used sparingly because it means something; every use signals importance
2. **Warm, never cold** — All surfaces carry warm undertones; no zinc, no cold gray, no pure black/white
3. **Arabic-native, bilingual-ready** — RTL-first design; every screen must work perfectly in Arabic
4. **Dark is the default, light is a choice** — Dark mode is the flagship; light mode is a user preference
5. **Alive, not showy** — Every animation earns its place; motion must serve the user, not impress them
6. **Trust through consistency** — Civic and governance features need predictable, reliable UI patterns

---

## 1. Benchmark App Analysis

### MyGate (Core Foundation — Gated Community Super-App)

MyGate is the closest existing parallel to EastPark in every dimension: same user base (compound residents), same feature set (marketplace + governance + complaints + directory), same trust requirements, same RTL-capable markets.

| Pattern | How It Works | Why It Matters | EastPark Application |
|---|---|---|---|
| **Quick Action Grid** | 6–8 large cards on home (Visitors, Complaints, Requests, Directory, Announcements) | Every major feature is 1-tap away; no deep navigation required | 6 action cards on home: Shops, Orders, Vote, Reports, Feedback, Community |
| **Complaint/Request Cards** | Status badge (Open/In Progress/Resolved) + colored indicator dot + timestamp | Status visibility at a glance | Apply to all status-heavy modules: orders, feedback, announcements |
| **Status Timeline** | All past items in timeline with status-change timestamps | Audit trail builds accountability; users see full journey | Feedback detail: Submitted → Acknowledged → In Progress → Resolved |
| **Color-Coded Urgency** | Red for urgent, Orange for in-progress, Green for resolved, Blue for info | Instant visual priority without reading text | Consistent color coding across all modules |
| **Pinned Critical Notices** | Important notices pinned to top with colored accent bar | Critical info never buried | Urgent announcements always top with colored left-border |
| **Widget Dashboard** | Small stat cards: Pending (3), Unread (5) | At-a-glance compound health | Home feed quick stats: "3 Active Polls · 5 New Announcements · 2 In Transit" |
| **Role-Based UI** | Resident sees different home than Manager | Each persona gets relevant content first | Resident home ≠ Merchant home ≠ Admin home |
| **Notification Sliding Banner** | Sliding banner at top for real-time updates, auto-dismisses | Non-intrusive but noticeable | Real-time: "New announcement from compound", "Your order is ready" |
| **Empty State Illustrations** | Friendly illustration for zero-item states | Feels human and intentional | All empty states get illustration + encouraging copy |
| **History/Timeline View** | Scrollable history with milestone indicators | Users understand where things are in process | Critical for feedback, order tracking |

### Talabat (Marketplace & Commerce Excellence)

| Pattern | How It Works | EastPark Use |
|---|---|---|
| **Hero Carousel** | Full-bleed carousel, auto-play, smooth fade/slide transitions | Home feed top — announcements, offers, events |
| **Sticky Category Rail** | Horizontal scroll chip bar, stays visible while content scrolls under | Directory filter chips, community feed filter |
| **Shop Cards** | Photo → name + Open/Closed chip → rating stars → delivery badge | Business directory cards |
| **Single-Scroll Checkout** | One long-scroll screen, not a multi-step wizard | Checkout screen — address, payment, items, total |
| **Bottom Sheet Cart** | Cart slides up smooth, half-screen, not a modal | Cart access without losing directory context |
| **Skeleton Loading** | Grey skeleton cards fade into real content | All list screens — never blank white |
| **Search Debounce** | Predictive suggestions, 300ms debounce, recent searches | Directory search, community search |

### Facebook (Engagement & Community Delight)

| Pattern | How It Works | EastPark Use |
|---|---|---|
| **Infinite Scroll Feed** | Posts appear smoothly on scroll | Announcements, feedback, polls |
| **Post Card Hierarchy** | Source → content → engagement row | Announcement card: compound logo → title → content → like/comment |
| **Like Animation** | Double-tap → heart scales and settles | Like/react on announcements |
| **Comment Threading** | 1 level of nesting, "Show X replies" expands inline | Announcement comments |
| **"New Posts" Float Chip** | Float chip at top when new content available — no auto-scroll | Never steal the user's scroll position |
| **Engagement Counts** | Like count + comment count visible at glance | "47 reactions · 12 comments" on announcement cards |

### YouTube (Premium Transitions & Smooth Interactions)

| Pattern | How It Works | EastPark Use |
|---|---|---|
| **Smooth Page Transitions** | Tap item → detail slides up (not abrupt cut) | Shop card tap → shop detail |
| **Parallax Scrolling** | Hero photo slower, description faster | Shop detail hero parallax |
| **Sticky Chip Bar** | Category chips pin below header on scroll | Directory + community screens |
| **Auto-Dismiss Overlays** | Success info appears, auto-fades 3–4s | Success toasts after key actions |
| **Tab Scale Bounce** | Active tab icon scales 1.1→1.0 on tap | Bottom tab bar active feedback |

---

## 2. Color System

### Brand Colors (Extracted from Logo)

| Token | Hex | Source | Usage |
|---|---|---|---|
| `gold` | `#b8966a` | Logo diamond mark (warm muted gold) | Primary brand color |
| `gold-light` | `#c9ab84` | Lighter tint | Hover/focus states |
| `gold-dark` | `#9e7d52` | Pressed shade | Pressed CTAs |
| `ink` | `#0d0c0b` | Logo background (near-black, warm) | Dark mode background |
| `white` | `#ffffff` | Logo wordmark | Text on dark, card bg on light |

### Gold Scale (NativeWind / Tailwind config)

```
gold-50:  #faf6f0   ← lightest tint (light mode section backgrounds)
gold-100: #f2e8d8   ← subtle gold wash
gold-200: #e4ceae   ← input borders, dividers
gold-300: #d4b286
gold-400: #c4a07a   ← lighter interactive states
gold-500: #b8966a   ← PRIMARY — CTAs, active states, badges ★
gold-600: #9e7d52   ← pressed state
gold-700: #7a5e38   ← dark accent text on light bg (gold-500 fails WCAG AA on light — always use gold-700 for text)
gold-800: #584224
gold-900: #382a14   ← darkest (rarely used)
```

### Light Mode Tokens

| Token | Hex | Rationale |
|---|---|---|
| `primary` | `#b8966a` | Brand gold |
| `primary-pressed` | `#9e7d52` | Darker gold on press |
| `surface` | `#faf8f5` | Warm off-white (NOT cold gray) — echoes gold undertone |
| `card` | `#ffffff` | White cards elevated on warm surface |
| `border` | `#e4ceae` | gold-200 — subtle warm dividers |
| `text-primary` | `#1a1714` | Near-black with warm undertone |
| `text-muted` | `#7a6e62` | Warm gray — NOT cold zinc |
| `success` | `#5a7a52` | Muted olive green |
| `warning` | `#c48b2f` | Deep amber |
| `error` | `#b03a2e` | Deep muted red |
| `info` | `#4a6b8a` | Slate blue |

### Dark Mode Tokens (Native/Premium — Matches Logo)

| Token | Hex | Rationale |
|---|---|---|
| `dark-bg` | `#0d0c0b` | Logo background — near-black, warm (not cold #000 or #0f0f0f) |
| `dark-surface` | `#171614` | Slightly lifted from bg |
| `dark-card` | `#221f1c` | Card surface — warm dark brown-black |
| `dark-elevated` | `#2e2a26` | Modals, bottom sheets |
| `dark-border` | `#3d3830` | Subtle warm dark dividers |
| `dark-text` | `#faf8f5` | Warm white (same as light mode surface — intentional) |
| `dark-muted` | `#a89880` | Warm muted gold-gray |
| `primary` | `#b8966a` | Gold stays identical — pops on dark bg just like the logo |

### Semantic Color System

| State | Color | Hex | Dot | Used In |
|---|---|---|---|---|
| Success / Resolved / Open | Muted Olive Green | `#5a7a52` | 🟢 | Orders delivered, feedback resolved, vote confirmed |
| Warning / In Progress | Deep Amber | `#c48b2f` | 🟠 | Orders preparing, feedback under review |
| Error / Urgent / Open | Deep Muted Red | `#b03a2e` | 🔴 | Errors, urgent announcements, open complaints |
| Info / Secondary | Slate Blue | `#4a6b8a` | 🔵 | Informational banners, non-urgent notices |

### Shadow Tinting

- Light mode: `rgba(184, 150, 106, 0.10)` — warm gold-tinted shadow
- Dark mode: `rgba(0, 0, 0, 0.40)` — pure dark shadow
- Never use cold grey shadows — they break the luxury warmth

### Color Rules

- Never use pure `#000000` or pure `#ffffff` as backgrounds.
- Gold `#b8966a` on light backgrounds: always use `gold-700` (`#7a5e38`) for text — gold-500 fails WCAG AA on light surfaces.
- Gold on dark backgrounds: `#b8966a` at 500 is the natural state (logo proof — gold on black).
- Surface in light mode is warm `#faf8f5`, NOT cold zinc.
- Dark card is `#221f1c`, NOT zinc `#27272a` or `#18181b`.
- Skeleton shimmer (dark mode): `#221f1c` → `#2e2a26` wave — not grey.

### Near-White Value Hierarchy (Light Mode)

Three warm near-white values exist — their roles are distinct:

| Value | Name | Exact Role |
|---|---|---|
| `#faf8f5` | `light-bg` / `surface` | **Page background, list container background** — the canonical surface |
| `#f2e8d8` | `gold-100` | Input field backgrounds, secondary card tints, chip highlights |
| `#faf6f0` | `gold-50` | Lightest gold tint, hover wash on light mode, very subtle accents |

Never use `#f2e8d8` as a page background. Never use cold `#f4f4f5` or `#fafafa`.

### TypeScript Design Tokens

Store in `src/theme/tokens.ts`:

```typescript
// ─── Brand Identity — Extracted from EastPark Logo ───────────────────────────
export const BRAND = {
  gold: '#b8966a',        // warm muted gold — primary brand color
  goldDark: '#9e7d52',    // pressed / focus ring
  goldLight: '#c9ab84',   // dark mode highlight / hover
  goldTint: '#f2e8d8',    // selected chip bg, pill highlights (light mode)
  goldText: '#7a5e38',    // gold-700 — use for gold text on light backgrounds (WCAG AA)
  ink: '#0d0c0b',         // logo near-black — dark mode base
  white: '#ffffff',       // logo wordmark text
} as const;

// ─── Light Mode ──────────────────────────────────────────────────────────────
export const LIGHT = {
  bg: '#faf8f5',          // warm off-white surface (NOT cold zinc)
  card: '#ffffff',        // elevated white card on warm surface
  surface: '#faf8f5',     // page background (warm off-white — NOT gold-100)
  primary: '#b8966a',     // gold-500
  primaryDark: '#9e7d52', // gold-600 — pressed
  primaryText: '#7a5e38', // gold-700 — gold text on light bg (WCAG AA compliant)
  inputBg: '#f2e8d8',     // gold-100 — input backgrounds, secondary card tints, chip highlights
  text: '#1a1714',        // warm near-black
  textMuted: '#7a6e62',   // warm gray
  border: '#e4ceae',      // gold-200
  disabled: '#c4b49e',
  divider: '#e4ceae',
  shadow: 'rgba(184, 150, 106, 0.10)',
} as const;

// ─── Dark Mode ───────────────────────────────────────────────────────────────
export const DARK = {
  bg: '#0d0c0b',          // logo near-black (warm, NOT cold #000 or #0d0d0d)
  surface: '#171614',     // slightly lifted
  card: '#221f1c',        // warm dark card
  elevated: '#2e2a26',    // modals, bottom sheets
  border: '#3d3830',      // subtle warm divider
  primary: '#b8966a',     // gold stays constant in both modes
  primaryLight: '#c9ab84',// hover/highlight in dark mode
  text: '#faf8f5',        // warm white
  textMuted: '#a89880',   // warm muted gold-gray
  disabled: '#4a4642',
  divider: '#3d3830',
  shadow: 'rgba(0, 0, 0, 0.40)',
} as const;

// ─── Semantic (Luxury-Toned — Never Neon) ────────────────────────────────────
export const SEMANTIC = {
  success: '#5a7a52',     // muted olive green
  successBg: '#eef3ec',   // light mode tint
  warning: '#c48b2f',     // deep amber (harmonizes with gold)
  warningBg: '#fdf3e0',
  error: '#b03a2e',       // deep muted red
  errorBg: '#faecea',
  info: '#4a6b8a',        // slate blue
  infoBg: '#eaf0f6',
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,   // standard card radius
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─── Spacing Scale ───────────────────────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl: 48,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
// Cairo for ALL functional UI (both EN and AR)
// Cormorant Garamond for EN display/hero moments only
export const TYPOGRAPHY = {
  display: { size: 36, weight: '900', lineHeight: 1.15, fontEN: 'CormorantGaramond-Black', fontAR: 'Cairo-ExtraBold' },
  h1:      { size: 28, weight: '700', lineHeight: 1.2,  fontEN: 'CormorantGaramond-Bold',  fontAR: 'Cairo-Bold' },
  h2:      { size: 20, weight: '600', lineHeight: 1.3,  fontEN: 'Cairo-SemiBold',           fontAR: 'Cairo-SemiBold' },
  bodyLg:  { size: 16, weight: '500', lineHeight: 1.5,  fontEN: 'Cairo-Medium',             fontAR: 'Cairo-Medium' },
  body:    { size: 14, weight: '400', lineHeight: 1.5,  fontEN: 'Cairo-Regular',            fontAR: 'Cairo-Regular' },
  label:   { size: 13, weight: '500', lineHeight: 1.4,  fontEN: 'Cairo-Medium',             fontAR: 'Cairo-Medium' },
  caption: { size: 12, weight: '400', lineHeight: 1.4,  fontEN: 'Cairo-Regular',            fontAR: 'Cairo-Regular' },
  button:  { size: 14, weight: '600', lineHeight: 1.4,  fontEN: 'Cairo-SemiBold',           fontAR: 'Cairo-SemiBold' },
  overline:{ size: 11, weight: '500', lineHeight: 1.4,  fontEN: 'Cairo-Medium',             fontAR: 'Cairo-Medium' },
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const SHADOWS = {
  sm: { shadowColor: 'rgba(184, 150, 106, 0.08)', shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: 'rgba(184, 150, 106, 0.10)', shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: 'rgba(184, 150, 106, 0.12)', shadowOffset: { width: 0, height: 10 }, shadowRadius: 20, elevation: 8 },
} as const;

// ─── Gold Scale (for NativeWind tailwind.config) ──────────────────────────────
export const GOLD_SCALE = {
  50:  '#faf6f0',
  100: '#f2e8d8',
  200: '#e4ceae',
  300: '#d4b286',
  400: '#c4a07a',
  500: '#b8966a',  // PRIMARY
  600: '#9e7d52',  // pressed
  700: '#7a5e38',  // text on light bg
  800: '#584224',
  900: '#382a14',
} as const;
```

---

## 3. Typography System

### Two-Font System

Mirrors the logo's dual personality: premium serif identity + readable UI sans-serif.

**Cairo** — UI Font for ALL functional text (both Arabic and English)
- Source: `@expo-google-fonts/cairo`
- Fully bilingual: Arabic + Latin optimized, RTL-aware
- Used for: ALL buttons, inputs, nav labels, lists, captions, body text, metadata

**Cormorant Garamond** — Display Font for English branding moments ONLY
- Source: `@expo-google-fonts/cormorant-garamond`
- Used for: splash screen, onboarding hero text, app logo lockup within app
- NEVER used for Arabic text
- NEVER used for functional UI (buttons, labels, inputs, navigation)

### Font Loading (`useFonts` hook)

Place in root `app/_layout.tsx`. Use **exact export names** from `@expo-google-fonts/*`:

```typescript
import {
  useFonts,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import {
  CormorantGaramond_700Bold,
  CormorantGaramond_900Black,
} from '@expo-google-fonts/cormorant-garamond';

// In root _layout.tsx:
const [fontsLoaded] = useFonts({
  // Cairo — functional UI (these are the StyleSheet fontFamily string keys)
  'Cairo-Regular':    Cairo_400Regular,
  'Cairo-Medium':     Cairo_500Medium,
  'Cairo-SemiBold':   Cairo_600SemiBold,
  'Cairo-Bold':       Cairo_700Bold,
  'Cairo-ExtraBold':  Cairo_800ExtraBold,
  // Cormorant Garamond — display/branding only
  'CormorantGaramond-Bold':  CormorantGaramond_700Bold,
  'CormorantGaramond-Black': CormorantGaramond_900Black,
});

if (!fontsLoaded) return <SplashScreen />;
```

The string keys above (`'Cairo-Regular'`, `'Cairo-SemiBold'`, etc.) match the `fontEN`/`fontAR` values in the `TYPOGRAPHY` token exactly.

### Typography Scale

| Scale | Weight | Size | Line Height | Usage |
|---|---|---|---|---|
| `display` | Black 900 | 36sp | 1.15x | Splash, hero, app name |
| `h1` | Bold 700 | 28sp | 1.2x | Hero text, large numbers, section hero |
| `h2` | SemiBold 600 | 20sp | 1.3x | Screen titles, section headers |
| `body-lg` | Medium 500 | 16sp | 1.5x | Shop names, post text, primary content |
| `body` | Regular 400 | 14sp | 1.5x | Descriptions, list items |
| `button` | SemiBold 600 | 14sp | 1.4x | All button labels (CTA, secondary, destructive) |
| `label` | Medium 500 | 13sp | 1.4x | Chip labels, badge text, tab labels |
| `caption` | Regular 400 | 12sp | 1.4x | Timestamps, metadata, helper text |
| `overline` | Medium 500 | 11sp | 1.4x | Section labels (ALL CAPS, 1px letter-spacing) |

### Font Usage Rules

- All functional UI → **Cairo** (both EN and AR)
- App name / splash / hero branding → **Cormorant Garamond** (EN only)
- Prices, OTP codes, unit numbers → always LTR even in RTL context (Unicode BiDi — do not override)
- Never mix both fonts on the same line
- Minimum line height 1.5x for body text (accessibility)
- Never use weight lighter than Regular for body text
- Gold `#b8966a` text on light backgrounds → always Bold weight minimum AND use `gold-700` (`#7a5e38`)
- Overline labels: ALL CAPS + 1px letter-spacing
- No Inter font anywhere in this project

---

## 4. Navigation Architecture

### Bottom Tab Bar — 5 Tabs

**Source:** Talabat (no drawer) + YouTube (5-tab flat nav)

```
[ Home ] [ Directory ] [ Orders* ] [ Community ] [ Profile* ]
```

| Tab | Icon | Active Color | Behavior |
|---|---|---|---|
| Home | House | Gold `#b8966a` | Quick action grid + hero carousel |
| Directory | Storefront | Gold | Category pills + shop cards |
| Orders | Bag | Gold + red badge if items | Order list + real-time tracking |
| Community | Bell | Gold + gold badge if unread | Pinned announcements + polls |
| Profile | User | Gold | Settings + account (auth-wall if guest) |

- `*` = auth-wall triggers on tap if guest
- Active tab: filled icon + primary color label + scale bounce 1.1→1.0 (200ms)
- Inactive: outlined icon + muted label
- Tab bar background: `card` (#ffffff light / `#221f1c` dark) with subtle top border
- Badge: red pill with white count text
- Tab bar dark mode: `#221f1c` surface + subtle gold top border `rgba(184, 150, 106, 0.25)`
- **No drawer. No hamburger. All navigation within tabs.** Secondary features live inside their tab's stack.

### Secondary Navigation

- Top app bar: back chevron (← flips to → in RTL), screen title, optional right action icons
- **No floating action buttons (FAB)** — all primary actions are in-context within each screen
- Secondary features use tab-internal stack navigation

### Auth-Wall Pattern

Guest action → `dispatch(showAuthWall({ redirectAction }))` → `AuthWallSheet` slides up → after login, action auto-replays.

```
Auth-Wall Bottom Sheet:
- Reanimated 4 spring physics slide-up
- Dark scrim backdrop (50% opacity)
- EastPark logo centered at top
- "Login" (primary filled) / "Register" (outlined) — full-width buttons
- "Continue as Guest" text link below
- Drag handle at top
```

---

## 5. Screen-by-Screen Patterns

### 5.1 Home Feed

**Pattern source:** Talabat (hero carousel) + MyGate (quick-action grid, quick stats widget) + Facebook (What's New ribbon)

#### Wireframe

```
┌─────────────────────────────┐
│  Location bar + Search pill │  ← tappable pill, opens search screen
├─────────────────────────────┤
│   Hero Carousel (3 slides)  │  ← auto-play 4s, dot pagination, 12dp radius
├─────────────────────────────┤
│ ┌──────────┬──────────┬────┐│
│ │📌 3 Polls│🔔 5 New  │📦 2││  ← quick stats widget (tap to jump)
│ └──────────┴──────────┴────┘│
├─────────────────────────────┤
│  Quick Actions 2×3 grid     │
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │ Shops│ │Orders│ │ Vote ││
│  └──────┘ └──────┘ └──────┘│
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │Report│ │Notice│ │Feedbk││
│  └──────┘ └──────┘ └──────┘│
├─────────────────────────────┤
│  "What's New" ribbon        │  ← horizontal scroll, 2.5 card peek
├─────────────────────────────┤
│  "Your Recent Shops" row    │  ← auth-required, else hidden
├─────────────────────────────┤
│  Active Polls preview row   │  ← 2 card peek
└─────────────────────────────┘
```

#### Hero Carousel
- Full-width, auto-plays every 4s, pauses on touch
- 3 slides max (announcements, offers, events)
- Gradient overlay (bottom) for text legibility
- Corner radius: 12dp
- Dot pagination below
- Transition: 300ms cubic-bezier(0.4, 0, 0.2, 1) fade+slide

#### Quick Stats Widget
```
┌──────────────┬──────────────┬──────────────┐
│ 📌 3 Active  │ 🔔 5 New     │ 📦 2 Orders  │
│    Polls     │    Announce  │    In Transit│
└──────────────┴──────────────┴──────────────┘
```
Tap any stat card → jumps directly to that module section.

#### Quick Action Grid
- 2×3 tiles, each ~72dp square, rounded rect (12dp), soft pastel background per tile
- Icon (24dp) centered, label below in `label` scale
- Color per category: Shops→warm green tint, Orders→warm blue tint, Vote→warm purple tint, Reports→amber tint, Feedback→rose tint, More→warm gray
- NOT all same color — MyGate's per-tile personality
- Touch target: full 72dp tile is tappable

#### "What's New" Ribbon
- Horizontal scroll row with 2.5 card peek (signals scrollability — Talabat pattern)
- Cards: 160×100dp, image + title + timestamp
- Skeleton shimmer on load

#### Role-Based Variation
- Resident view: Quick action grid as above
- Merchant view: Quick actions emphasize Orders + Menu + Dashboard
- Admin view: Quick actions emphasize Announcements + Polls + Reports + User Management

---

### 5.2 Business Directory

**Pattern source:** Talabat (shop cards, filter chips, search) + YouTube (sticky chip bar)

#### Wireframe

```
┌─────────────────────────────┐
│  Search bar (rounded pill)  │
├─────────────────────────────┤
│  Sticky category chip bar   │  ← All/Café & Food/Grocery/Butcher/Services/Other
├─────────────────────────────┤
│  Shop card                  │
│  Shop card                  │
│  Shop card                  │
│  ...  (FlashList)           │
└─────────────────────────────┘
```

#### Shop Card (Talabat-style)

```
┌──────────────────────────────┐
│  Cover image (55% height)    │  ← aspect ~16:9, [Open] or [Closed] pill badge
├──────────────────────────────┤
│  Shop Name (body-lg, bold)   │
│  Category  ·  ⭐ 4.8 (120)   │
│  🕐 25–35 min  · 📍 Block 4  │
└──────────────────────────────┘
```

- Corner radius: 12dp
- Shadow: `md` elevation, warm gold-tinted
- "Closed" state: gray scrim overlay on image + "Closed" centered label
- Skeleton shimmer on initial load

#### Sticky Category Chips (YouTube pattern)
- Pins just below search bar on scroll
- Active: filled gold pill; Inactive: outlined pill
- Horizontal scroll — All / Café & Food / Grocery / Butcher / Services / Other

#### Filter Bottom Sheet (Talabat pattern)
- Sort: Relevance / Rating / Nearest (radio)
- Category multiselect checkboxes
- "Apply Filters" primary button full-width at bottom

#### Search UX
- Tapping pill → full-screen search, keyboard auto-focuses
- Recent searches as chip tags below input
- Results update with 300ms debounce
- Same card format as directory list
- FlashList for all results — never FlatList

#### Pagination
- Cursor-based infinite scroll via `useInfiniteQuery`
- FlashList `onEndReached` → `fetchNextPage()`
- Skeleton shimmer for next page load

---

### 5.3 Shop Detail & Menu

**Pattern source:** YouTube (parallax, smooth transitions) + Talabat (menu chips, product cards)

#### Shop Header
- Full-width photo gallery (swipe left/right — `react-native-image-viewing`)
- Parallax: hero photo scrolls at 0.6x speed while content scrolls at 1x
- Shop name, category, rating, hours, location, phone
- "Open Now" / "Closed" status badge (computed from `workingHours` JSON + `isOpen` override)
- Sticky menu category chip bar below header on scroll

#### Product Item Card (Talabat dish card — horizontal layout)

```
┌────────────────────────────────────────┐
│ Item Name (body-lg, bold)        [img] │
│ Short description (2-line, muted) [+]  │
│ EGP 45.00 (primary, bold)              │
└────────────────────────────────────────┘
```

- Image: 80×80dp, rounded 8dp, right-aligned
- "+" circular add button bottom-right of image
- When added: inline quantity stepper (−/count/+) replaces "+" (Talabat pattern)
- Price always in `body-lg` bold, gold-700 on light mode

#### Menu Section Chips (Sticky within shop)
- Horizontal chip bar for menu categories: Starters / Mains / Drinks / Desserts / etc.
- Sticks below shop header on scroll

#### Reviews Section
- Rating summary bar + distribution chart
- Review cards with avatar, rating stars, text, timestamp

---

### 5.4 Ordering & Checkout

**Pattern source:** Talabat (single-scroll checkout, order tracking stepper)

#### Checkout — Single Long-Scroll Screen

**NOT a wizard. One screen, scroll through all sections:**

```
┌─────────────────────────────┐
│  Delivery Address            │  ← tappable row → address picker bottom sheet
├─────────────────────────────┤
│  Order Items (expandable)   │
├─────────────────────────────┤
│  Notes (free-text field)    │  ← no delivery time slots
├─────────────────────────────┤
│  Payment Method             │  ← Cash on Delivery (primary) / Paymob card
├─────────────────────────────┤
│  Price Breakdown            │
│  Subtotal / Discount / Total│
├─────────────────────────────┤
│  [Place Order] full-width   │  ← primary gold button
└─────────────────────────────┘
```

Server computes `totalAmount` — never trust client payload.

#### Order Tracking (Talabat stepper)

```
● ──────── ● ──────── ○ ──────── ○ ──────── ○
Placed   Confirmed  Preparing  On Way  Delivered
```

- Filled circle + primary color = completed step
- Empty circle + muted = pending step
- Active step: pulsing animation
- Real-time via Socket.io — no manual refresh needed

#### Order Confirmed
- Lottie checkmark/confetti animation
- Scale: 1 → 1.05 (100ms) → checkmark rotates (200ms) → message slides in (300ms)
- Wait 2s → navigate to order detail (fade transition)

#### Cart Micro-Interaction
- Tapping "+" triggers scale-bounce on cart badge in tab bar
- Badge count increments with pop animation (Talabat pattern)

#### Cancel Flow
- Cancel button visible/enabled only while `status = PLACED`
- Confirmation bottom sheet before cancelling

---

### 5.5 Community Hub

**Pattern source:** MyGate (announcements, admin badges, pinned notices) + Facebook (post cards, engagement) + YouTube (sticky chips)

#### Feed Layout

```
┌────────────────────────────────┐
│  Filter chips (sticky)         │  ← All/Notices/Events/Polls/Reports
├────────────────────────────────┤
│  [RED BAR] 🔴 URGENT: Maintenance Tomorrow 10am
│  Pinned notice card            │  ← pinned always float to top
├────────────────────────────────┤
│  Announcement card             │
│  Announcement card             │
│  Poll card                     │
│  ...  (FlashList, infinite)    │
└────────────────────────────────┘
```

#### Announcement Card

```
┌────────────────────────────────┐
│  [Admin badge] EastPark Mgmt 🕐│
│                                │
│  Title (h2, bold)              │
│  Preview text (2–3 line clamp) │
│  [Optional image]              │
│  ─────────────────────────────│
│  👍 12  💬 4 comments          │
└────────────────────────────────┘
```

- White card on `surface` warm background (Facebook depth)
- "Admin" / "Committee" tinted gold badge on author name
- Pinned card: `error` (#b03a2e) or `info` (#4a6b8a) left border (MyGate ticket-border pattern)
- "New posts available" float chip at top on pull-refresh — never auto-scroll

#### Comments (YouTube bottom sheet)
- Tap "X comments" → @gorhom/bottom-sheet slides up, snap at 50% and 95%
- 1 level of reply threading — "View X replies" → expand inline
- Comment input pinned at bottom of sheet
- No Reddit-style deep nesting

#### Poll Card

```
┌────────────────────────────────┐
│  🗳 ACTIVE POLL  · Ends in 2d  │
│  "Should we repaint Block C?"  │
│                                │
│  Yes  ████████░░░░  67%        │
│  No   ████░░░░░░░░  33%        │
│                                │
│  48 votes · [Vote] or [Done]   │
└────────────────────────────────┘
```

- Before voting: plain option rows with radio circles
- After voting: animated progress bars fill to % (spring, 500ms)
- Guest: sees results only (no vote button)

#### Announcements Wireframe (MyGate Module 3 pattern)

```
[RED BAR]  🔴 URGENT: Maintenance Tomorrow 10am
           Tap for details

[BLUE BAR] ℹ️ Monthly Meeting Results Published
           Tap to read

[Previous Announcements...]
```

---

### 5.6 Governance (Polls & Elections)

**Pattern source:** MyGate (poll cards, vote flow)

Same poll card pattern as Community Hub.

#### Poll Detail
- Full-width option rows with clear tap target (min 48dp)
- After vote: all bars animate to new % simultaneously (spring 500ms)
- Vote count updates live via Socket.io
- "Your vote" indicator on chosen option

#### Elections — Candidate Card

```
┌─────────────────────────────────┐
│  [Photo 48dp]  Candidate Name   │
│               Unit B-204        │
│  Statement (3-line clamp)       │
│                    [Vote]       │
└─────────────────────────────────┘
```

- Photo: 48dp circle avatar
- After voting: "Your vote" checkmark badge on chosen candidate
- Results screen: same percentage bar animation as polls
- One vote per resident per election — server-enforced + `@@id([userId, electionId])` in DB

#### Role-Based Governance UI

```
Resident View:
  [Announcements] [Polls] [Reports] [Elections]

Admin View:
  [Post Announcement] [Create Poll] [View Reports] [Manage Elections] [Add Candidates]
```

---

### 5.7 Feedback & Complaints

**Pattern source:** MyGate (wizard form, left-border status cards, status timeline)

#### Submission Flow — Wizard (NOT single-scroll)

MyGate uses wizard because each step's answer changes the next step (dynamic form). Step dots at top.

```
Step 1: Category grid (icon tiles — Maintenance/Security/Noise/Cleanliness/Other)
Step 2: Description + photos (up to 3, each ≤ 5MB jpg/png/webp)
Step 3: Urgency level (Low/Medium/High) + anonymous toggle
Step 4: Confirmation screen with ticket number
```

#### Complaint Card (MyGate left-border pattern)

```
┌─────────────────────────────────┐
│ ▌ Ticket #1042                  │  ← left border color = status color
│   Maintenance · Lobby elevator  │
│   Submitted 2 days ago          │
│                    [In Progress]│
└─────────────────────────────────┘
```

Left border colors:
- `#b03a2e` (error red) = Open/New
- `#c48b2f` (amber) = In Progress
- `#5a7a52` (olive green) = Resolved
- `#4a6b8a` (slate blue) = Acknowledged

#### Status Timeline (MyGate Pattern)

```
┌─────────────────────────────┐
│ Complaint #1234             │
│ "Leaking water near stairs" │
├─────────────────────────────┤
│ 🟠 Open         Mar 28, 2:15 PM
│    ├─ Submitted
│    │  Mar 28, 10:00 AM
│    │  "Your request received"
│    └─ Acknowledged
│       Mar 28, 10:30 AM
│       "We're looking into it"
│    └─ [In Progress - Expected resolution by Apr 1]
│
│ [Assigned to: Ahmad (Maintenance)]
└─────────────────────────────┘
```

Wireframe as vertical component:

```
✅ Submitted     Mar 28, 10:32am
✅ Acknowledged  Mar 28, 2:15pm
🔵 In Progress   (assigned to maintenance team)
○  Resolved
```

- Vertical timeline with connecting line
- Completed steps: olive green checkmark + timestamp
- Active step: primary color pulsing dot
- Pending: empty circle + muted color

#### Anonymous Submissions
- `userId` / `author` stripped from admin response when `isAnonymous = true`
- Toggle clearly labeled at Step 3

---

### 5.8 Auth & Auth-Wall

**Pattern source:** Talabat (OTP pattern)

#### Login Screen
- Email + password inputs (Cairo font)
- "Forgot password?" text link
- Primary "Login" button
- "Don't have an account? Register" text link

#### Register Screen
- Name + email + phone + unit number + password
- All fields validated with Zod + React Hook Form
- "Register" → Email OTP → `verify-otp` screen

#### OTP Verification
- 6 individual digit boxes
- Auto-advance on input
- Auto-read from SMS (Android)
- Focused box: outlined border + primary gold color
- "Resend OTP" button (with cooldown timer)
- Old OTP invalidated on resend

#### Auth-Wall Bottom Sheet

```
┌────────────────────────────┐
│        ─── (handle) ───    │
│                            │
│    [EastPark Logo]         │
│                            │
│  [      Login      ]       │  ← primary gold filled
│  [     Register    ]       │  ← outlined
│                            │
│   Continue as Guest ↓      │  ← text link
└────────────────────────────┘
```

- @gorhom/bottom-sheet with Reanimated 4 spring physics
- Scrim backdrop: 50% opacity dark
- After login: redirectAction auto-replays

#### Merchant/Admin Invite Flow
- Admin sends email invite → one-time signed token
- `accept-invitation` deep link → name + password setup screen
- `Invitation` DB model tracks `usedAt` + `expiresAt`

#### Forgot Password
- Email input → Brevo sends reset link (TTL 30min in Redis)
- `reset-password` screen receives token via deep link
- Resetting invalidates the token

---

### 5.9 Profile & Settings

**Pattern source:** Facebook (grouped sections) + MyGate (role-aware profile)

#### Settings Structure

```
Personal Info
  — Name, phone, unit number, profile photo

Preferences
  — Language (AR ↔ EN) with flag icons
  — Theme (Light / Dark / System)

Notifications
  — Toggle per type: Announcements / Orders / Polls / Feedback

My Activity
  — My Orders
  — My Saved Shops
  — My Feedback

Merchant Section (visible only if role = Merchant)
  — Manage My Shop

Account
  — Logout
  — Delete Account (destructive — confirmation required)
```

- Each section has a clear header label (Facebook style)
- Row format: icon (left) + label + value/chevron (right)
- Language toggle triggers `switchLanguage()` + restart prompt (see RTL Section 8)
- `NotificationPreference` — one DB row per user per `NotificationType`

#### Profile Dropdown (MyGate pattern)

```
[👤 Avatar top-right — tappable]
         ↓
┌─────────────────────────────┐
│ My Profile                  │
│ My Orders                   │
│ My Feedback                 │
│ Saved Shops                 │
│ Preferences                 │
│ Settings                    │
│ Logout                      │
└─────────────────────────────┘
```

---

### 5.10 Merchant Dashboard

**Route:** `/(merchant)/dashboard.tsx` — gated by `merchant` role guard.
Linked from Profile tab → "Manage My Shop" (visible only when `user.role === 'MERCHANT'`).

#### Dashboard Layout
- Summary stats row: Today's Orders (count), Revenue (amount), Pending (count) — dark-card tiles, gold value text
- Active orders FlashList: real-time updates via Socket.io
- "Menu Management" shortcut card → `/(merchant)/menu/`

#### Order Management (`/(merchant)/orders/`)
- FlashList filterable by status: PLACED / CONFIRMED / PREPARING / DELIVERED / CANCELLED
- Order card: order ID, items summary, customer unit, timestamp, status badge (semantic colors)
- Order detail `/(merchant)/orders/[orderId].tsx`: full item list, delivery notes, status-advance CTA buttons
- Status flow: PLACED → CONFIRMED → PREPARING → DELIVERED — each step is a primary gold button tap + Reanimated spring confirm

#### Menu Management (`/(merchant)/menu/`)
- Product FlashList: thumbnail, name (both languages), price, availability toggle
- Add/Edit `/(merchant)/menu/[productId].tsx`: React Hook Form + Zod
  - Fields: `nameAr`, `nameEn`, `descriptionAr`, `descriptionEn`, price, category, image upload, `isAvailable` toggle
  - Image: Supabase Storage, max 5MB jpg/png/webp
  - Save: spring success animation on submit
- Soft delete: slide-out animation, preserves OrderItem FK history

#### Role Guard
```tsx
// /(merchant)/_layout.tsx
if (user.role !== 'MERCHANT') return <Redirect href="/(tabs)" />;
```

#### Design Rules
- Same gold/black palette — no separate merchant brand color
- Stats tiles: dark-card bg, gold value text, muted label caption
- Status badges match global semantic system: Warning amber = PLACED/CONFIRMED, Info blue = PREPARING, Success olive = DELIVERED, Error red = CANCELLED

---

### 5.11 Notifications Feed

**Route:** `/notifications/index.tsx` — auth-guarded.

#### Layout
- Header: "Notifications" (title scale) + "Mark all read" text link (gold, right-aligned)
- FlashList, newest first, sticky section headers: "Today" / "This Week" / "Earlier"

#### Notification Card
- Left: colored type icon (16dp) · Center: title (body-lg) + 2-line message (body, truncated) + relative timestamp (caption, muted) · Right: unread dot (8dp gold)
- Unread card bg: dark-elevated tint (vs dark-card for read)
- Tap: mark as read → navigate to linked screen

#### Notification Types & Tap Destinations

| Type | Icon | Destination |
|---|---|---|
| ORDER_STATUS | cart | `/orders/[orderId]` |
| ANNOUNCEMENT | megaphone | `/community/[announcementId]` |
| POLL_OPEN | chart | `/community/governance/polls/[pollId]` |
| ELECTION_OPEN | ballot | `/community/governance/elections/[id]` |
| FEEDBACK_REPLY | message | `/community/feedback/[feedbackId]` |
| GENERAL | bell | No deep link |

#### Empty State
- Lottie: calm bell animation
- Headline: "No notifications yet"
- Body: "You'll see order updates, announcements, and community activity here"

---

### 5.12 Accept Invitation

**Route:** `/(auth)/accept-invitation.tsx`
Reached via deep link: `eastpark://accept-invitation?token=<signed_jwt>`

#### Layout
- EastPark logo (Cormorant Garamond wordmark), centered top
- "You've been invited" headline (display scale, gold)
- Role badge pill: "Merchant" or "Administrator" (gold border + text)
- Form: Full Name + Password + Confirm Password
- "Complete Setup" primary gold CTA (full-width, 48dp)

#### Validation
- Name: required, min 2 chars
- Password: min 8 chars + strength bar (weak/medium/strong fill under input)
- Confirm password: must match

#### States
- **Valid token:** form as above
- **Expired/invalid token:** error card (Error red left-border) + "Contact your administrator" message — no form shown

#### On Success
- Lottie confetti / welcome animation (2s)
- Auto-login with returned JWT tokens
- Redirect: merchant → `/(merchant)/dashboard` · admin → `/(tabs)`

#### Design Rules
- Same visual language as all auth screens: dark-bg, logo top-centered, form on dark-elevated card
- Consistent with `login.tsx` / `register.tsx` spacing and input style

---

### 5.13 Checkout Sub-Screens

Section 5.4 covers the checkout single-scroll and order tracking patterns. Here are the precise route-by-route breakdowns:

#### `checkout/cart.tsx` — Cart Review
- FlashList of cart items: product image thumbnail (80×80dp), name, quantity stepper, line total
- Shop name header — all items must belong to the same shop (enforced server-side)
- Subtotal row + "Free delivery within compound" caption
- "Proceed to Checkout" primary gold CTA (full-width, 48dp)
- Empty cart: Lottie empty bag + "Your cart is empty" + "Browse Shops" secondary CTA

#### `checkout/address.tsx` — Delivery Address
- Resident unit number + building: pre-filled from profile, read-only card with gold left-border
- Free-text notes field (placeholder: "Gate 2 entrance, ring doorbell twice")
- Edit profile link if address info is missing
- "Continue" primary CTA → `payment.tsx`

#### `checkout/payment.tsx` — Payment Method
- Radio group: Cash on Delivery (default selected) / Card via Paymob
- COD description: "Pay when your order arrives at your door"
- Paymob: opens Paymob payment SDK sheet on selection
- Itemized order summary (collapsed by default, expandable)
- Grand total (gold, bold, title scale)
- "Place Order" primary gold CTA (full-width, 48dp, heavy weight)
- Disabled until payment method selected

#### `checkout/confirmation.tsx` — Order Confirmed
- Lottie checkmark + confetti animation (2s, then fades to static checkmark)
- "Order Placed!" headline (display scale, gold)
- Order ID (label scale, muted)
- Estimated arrival note
- "Track My Order" secondary CTA → `/orders/[orderId]`
- "Back to Home" text link
- No back navigation — clear the cart, reset checkout stack

---

## 6. Loading States & Skeleton Shimmer

All four benchmark apps (MyGate, Talabat, Facebook, YouTube) use shimmer skeleton loading. No spinners on list screens — ever.

### Pattern

Gray animated gradient (left-to-right sweep) on placeholder shapes matching real content geometry. Fade into real content when loaded. Skeleton card count = expected card count (no sudden layout jump).

### Skeleton Shapes by Screen

| Screen | Skeleton Shape |
|---|---|
| Directory list | Rectangle (image top 55%) + 3 lines |
| Community feed | Circle (avatar 32dp) + 3 lines + rectangle |
| Poll card | Title line + 2 option bars |
| Order history | Circle + 2 lines + badge |
| Home feed quick actions | 6 rounded squares |
| Shop detail | Full-width rectangle + 4 lines |
| Product list | Horizontal: small square right + 3 lines left |

### Dark Mode Shimmer

- Light mode: `#e4ceae` → `#f2e8d8` wave on `#faf8f5` background
- Dark mode: `#221f1c` → `#2e2a26` wave on `#0d0c0b` background (warm tones — never cold zinc)

### Implementation

```
react-native-shimmer-placeholder + expo-linear-gradient
```

Animate with `useSharedValue` + `withRepeat(withTiming(...), -1)` for 60fps shimmer.

### Pull-to-Refresh

- Drag down → skeleton cards appear (NOT a circular spinner — CLAUDEDESIGN explicitly bans spinners)
- Release → API call fires
- On resolve: skeleton fades into real content
- Shows "Updated just now" timestamp after resolve
- Haptic feedback on release

---

## 7. Micro-Interactions & Animation

### Timing Reference

| Interaction | Duration | Easing | Source |
|---|---|---|---|
| Hero carousel transition | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | UIUX.md |
| Poll bar fill (after vote) | 500ms | Spring (mass 1, stiffness 200, damping 20) | UIUX.md |
| Bottom sheet entrance | 250ms | `cubic-bezier(0.0, 0.0, 0.2, 1)` ease-out | UIUX.md |
| Like animation scale | 0.2→1.3→1.0 over 500ms | Spring ease | UIUX.md |
| Success state sequence | 100ms scale + 200ms checkmark + 300ms message slide | Spring | UIUX.md |
| Card tap scale | 100ms | `1 → 1.02 → 1.0` | UIUX.md |
| Chip select fill | 200ms | ease | YouTube pattern |
| Tab icon bounce | 200ms | `1.1 → 1.0` spring | YouTube pattern |
| Add-to-cart badge pop | 150ms | `1 → 1.3 → 1.0` spring | Talabat |
| Bottom sheet backdrop | 200ms | ease | — |
| Auth-wall slide-up | Reanimated spring physics | slight overshoot | — |
| Empty state fade-in | Staggered: illustration first, then text, then CTA | 200ms each | MyGate |

### Full Interaction Inventory

| Interaction | Animation | Haptic | Source |
|---|---|---|---|
| Add to cart | Scale-bounce on cart tab badge | Light impact | Talabat |
| Poll vote | Progress bars spring-fill (500ms) | Success | MyGate |
| Order confirmed | Lottie checkmark/confetti | Success (heavy) | Talabat + MyGate |
| Vote submitted | Lottie animation | Success | — |
| Payment success | Lottie animation | Success (heavy) | — |
| Registration complete | Lottie animation | Success | — |
| Bottom sheet open | Spring slide-up (slight overshoot) | — | Talabat |
| Like announcement | Thumbs-up scale + fill | Light | Facebook |
| Auth-wall trigger | Spring slide-up + scrim fade-in | Warning | — |
| Tab switch | Scale bounce on active icon | Selection | YouTube |
| Chip select | Background fill (200ms ease) | — | YouTube |
| Skeleton → content | Cross-fade | — | All apps |
| Complaint status change | Push notification + timeline dot pulse | — | MyGate |
| OTP generate/display | Scale-in reveal | — | MyGate |
| Cart badge increment | Pop animation | — | Talabat |
| Form validation error | Shake (horizontal oscillation) | Error | — |
| Scroll to top | Smooth momentum scroll | — | — |

### Like/React Animation Detail

```
Double-tap anywhere on announcement card:
- Heart appears at tap point
- Scale: 0.2 → 1.3 → 1.0 (spring ease, 500ms)
- Heart trails upward and fades (opacity 1 → 0 over 800ms)
- Like count increments with number flip animation
- Haptic: light pulse on tap
```

### Success State Animation Detail

```
Order placed / Feedback submitted / Vote cast:
- Container scale: 1 → 1.05 (100ms)
- Checkmark icon appears + rotates in (200ms)
- Lottie confetti burst (200ms, plays once)
- Success message slides in from right (300ms)
- Wait 2s → navigate to next screen (fade transition)
```

### Haptic System

- **Success haptic:** order placed, vote submitted, complaint resolved, registration complete
- **Warning haptic:** auth-wall trigger, destructive action confirmation
- **Error haptic:** form validation failure, network error
- **Selection haptic:** chip select, tab switch, radio button
- **Light impact:** add to cart, like

### Reduced Motion

Respect `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled()`:
- Replace spring animations with instant transitions
- Disable auto-play on hero carousel
- Keep haptics (separate from motion preference)
- Keep Lottie but reduce to static frame

---

## 8. RTL & Localization Rules

**Source:** Talabat (gold standard for Arabic RTL in MENA apps)

### Core RTL Rules

1. **Full layout mirror** — every screen flips when `language = 'ar'`: flex directions, icon positions, text alignment, horizontal scroll directions
2. **Back chevron flips** — `←` becomes `→` in RTL (Expo Router handles via platform)
3. **Card layouts mirror** — image-on-left becomes image-on-right in RTL
4. **Prices and numbers stay LTR** — Unicode BiDi handles this; never force RTL on numeric content
5. **NativeWind RTL utilities** — use `rtl:flex-row-reverse`, `rtl:text-right`, `rtl:pr-4` etc.
6. **Language switch requires restart** — `I18nManager.forceRTL()` only takes effect after reload; prompt user with "Restart required" alert
7. **Cairo for all text** — same font for both AR and EN (Cairo is fully bilingual, no typeface switch)

### Implementation

```typescript
// Language switch handler
const switchLanguage = async (lang: 'ar' | 'en') => {
  const isRTL = lang === 'ar';
  I18nManager.forceRTL(isRTL);
  await dispatch(setLanguage(lang));
  Alert.alert(
    i18n.t('restartRequired'),
    i18n.t('restartRequiredMessage'),
    [{ text: i18n.t('restart'), onPress: () => Updates.reloadAsync() }]
  );
};
```

### String Rules

- No hardcoded strings anywhere in components
- All text through i18n keys from day 1
- Arabic text: slightly larger font size for readability
- Timestamps: relative time always ("منذ ساعتين" / "2 hours ago")
- Numbers: Western numerals in both languages (user preference)

### RTL-Aware Components

- FlashList: `inverted` prop not needed for RTL; relies on flex direction
- @gorhom/bottom-sheet: handles RTL natively
- react-native-reanimated-carousel: set `dir` prop from `I18nManager.isRTL`

---

## 9. Accessibility Standards

| Requirement | Implementation |
|---|---|
| **Touch Targets** | Minimum 44dp (48dp preferred) for all interactive elements |
| **Color Contrast** | WCAG AA: ≥4.5:1 for normal text, ≥3:1 for large text and graphics |
| **Gold on light bg** | Always use gold-700 `#7a5e38` — gold-500 `#b8966a` fails WCAG AA on `#faf8f5` |
| **Text Labels** | All buttons/icons have `accessibilityLabel` |
| **Roles** | Button, Image, Text properly assigned via `accessibilityRole` |
| **Announcements** | Real-time updates via `AccessibilityInfo.announceForAccessibility()` |
| **Keyboard Nav** | All interactions keyboard-accessible, logical tab order |
| **Focus Indicators** | Visible focus ring on keyboard navigation |
| **Font Scaling** | All text respects user system font size; never `allowFontScaling: false` |
| **Screen Reader** | Test with TalkBack (Android) + VoiceOver (iOS) before each feature PR |
| **Reduced Motion** | Respect `AccessibilityInfo.isReduceMotionEnabled()` |

### Contrast Reference

| Pair | Ratio | Pass? |
|---|---|---|
| `#b8966a` on `#0d0c0b` (dark bg) | ~4.6:1 | AA ✓ |
| `#7a5e38` on `#faf8f5` (light bg) | ~5.2:1 | AA ✓ |
| `#b8966a` on `#faf8f5` (light bg) | ~2.8:1 | FAIL — never use |
| `#faf8f5` on `#0d0c0b` (dark text) | ~18:1 | AAA ✓ |
| `#5a7a52` on `#ffffff` | ~4.5:1 | AA ✓ |
| `#b03a2e` on `#ffffff` | ~5.9:1 | AA ✓ |

---

## 10. Performance Optimizations

### Image Loading

- **Blur-up progressive:** 4% thumbnail as base64 placeholder → full image loads
- Use `react-native-fast-image` for caching + blur-up
- Images ≤ 5MB (jpg/png/webp) enforced on upload
- PDFs ≤ 20MB

### List Performance

- **FlashList** for all scrollable lists — never FlatList
- `estimatedItemSize` set per list type (shop card ~120dp, announcement card ~160dp)
- `removeClippedSubviews={true}` on all FlashList instances
- `drawDistance` set to 2× screen height

### Animation Performance

- All animations via `react-native-reanimated` worklets (not JS bridge crossing)
- `useSharedValue` + `useAnimatedStyle` pattern — never `Animated.Value`
- `runOnUI()` for computationally expensive transitions
- Target: >55fps on mid-range Android

### API & State

- Debounce search inputs: 300ms before firing query
- TanStack Query stale-while-revalidate: `staleTime: 5 * 60 * 1000` for directory
- Cursor-based pagination on all list endpoints — no offset pagination
- Redux selectors use `createSelector` (reselect) — no unnecessary re-renders
- Dismiss modals/sheets properly to free memory; clear timers on unmount

### Bundle Size

- Tree-shake unused icon libraries
- Lazy-load merchant dashboard (only loaded when `role === 'MERCHANT'`)
- Code-split governance screens from core tab bundle

### Offline

- TanStack Query + AsyncStorage persister for directory + announcements
- Cart persisted locally via `redux-persist`
- Network-state-aware retry logic in `queryClient`

---

## 11. Dark Mode Implementation

- Dark mode is the **flagship experience** — it matches the logo identity
- Ship dark as default; offer light as user toggle preference
- System default is also available: follows `useColorScheme()` hook
- **Never** use cold zinc dark (`#18181b`, `#27272a`) — always warm dark (`#0d0c0b`, `#221f1c`)

### Theme Provider Pattern

```typescript
// src/providers/ThemeProvider.tsx
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const preference = useSelector(selectThemePreference); // 'dark' | 'light' | 'system'
  const systemScheme = useColorScheme();
  const scheme = preference === 'system' ? systemScheme : preference;
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return (
    <ThemeContext.Provider value={theme}>
      <GluestackUIProvider colorMode={scheme}>
        {children}
      </GluestackUIProvider>
    </ThemeContext.Provider>
  );
};
```

### Dark Mode Adjustments

- Skeleton shimmer: `#221f1c` → `#2e2a26` wave (warm tones)
- Images get 10% dark overlay to reduce eye strain on large hero images
- Status badges use full semantic color (vibrant enough to pop on dark)
- Tab bar: `#221f1c` + subtle gold top border `rgba(184, 150, 106, 0.25)`
- Cards: `#221f1c` on `#0d0c0b` background — 3:1 contrast minimum
- Bottom sheets: `#2e2a26` elevated surface

### NativeWind Dark Config

```javascript
// tailwind.config.js
const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ⚠️ NativeWind v4: DO NOT use darkMode: 'class' — use colorScheme API instead
  // Dark mode is controlled via NativeWind's useColorScheme() hook + colorScheme prop on GluestackUIProvider
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ─── Brand Gold Scale ───────────────────────────────────
        'gold-50':  '#faf6f0',
        'gold-100': '#f2e8d8',
        'gold-200': '#e4ceae',
        'gold-300': '#d4b286',
        'gold-400': '#c4a07a',
        'gold-500': '#b8966a',   // PRIMARY
        'gold-600': '#9e7d52',   // pressed
        'gold-700': '#7a5e38',   // text on light bg (WCAG AA)
        'gold-800': '#584224',
        'gold-900': '#382a14',

        // ─── Dark Mode Surfaces ──────────────────────────────────
        'ink':          '#0d0c0b',   // dark-bg
        'dark-surface': '#171614',
        'dark-card':    '#221f1c',
        'dark-elevated':'#2e2a26',
        'dark-border':  '#3d3830',
        'dark-muted':   '#a89880',

        // ─── Light Mode Surfaces ─────────────────────────────────
        'surface':      '#faf8f5',   // light-bg (warm off-white)
        'light-card':   '#ffffff',
        'light-border': '#e4ceae',
        'light-muted':  '#7a6e62',
        'light-text':   '#1a1714',

        // ─── Semantic ────────────────────────────────────────────
        'success':      '#5a7a52',
        'success-bg':   '#eef3ec',
        'warning':      '#c48b2f',
        'warning-bg':   '#fdf3e0',
        'error':        '#b03a2e',
        'error-bg':     '#faecea',
        'info':         '#4a6b8a',
        'info-bg':      '#eaf0f6',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  plugins: [],
};
```

**Dark mode in NativeWind v4** — use `colorScheme` prop, not CSS classes:
```tsx
// In root _layout.tsx — reads Redux preferencesSlice.themePreference
import { useColorScheme } from 'nativewind';

const { setColorScheme } = useColorScheme();
// On mount and on preference change:
setColorScheme(themePreference); // 'dark' | 'light' | 'system'
```

NativeWind v4 dark utilities (`dark:bg-ink`, `dark:text-gold-200`) activate automatically when `colorScheme` is `'dark'`.

---

## 12. Component Sourcing Map

| Component | Library | Notes |
|---|---|---|
| Button, Input, Badge, Card, Toast | `@gluestack-ui/themed` (v2) | NativeWind-compatible primitives |
| Bottom Sheet (auth-wall, filters, comments) | `@gorhom/bottom-sheet` | Works with Reanimated 4 |
| Carousel (hero) | `react-native-reanimated-carousel` | Smooth, Reanimated-native |
| FlashList (all long lists) | `@shopify/flash-list` | ALL lists — never FlatList |
| Lottie animations | `lottie-react-native` | Order confirmed, vote, registration, payment |
| Progress bars (polls) | Custom via Reanimated 4 `useSharedValue` | Animate width with spring |
| Shimmer skeleton | `react-native-shimmer-placeholder` + `expo-linear-gradient` | |
| PDF viewer | `react-native-pdf` or WebView fallback | Community Hub reports |
| Image gallery (shop) | `react-native-image-viewing` | Lightbox-style full-screen |
| OTP input | `react-native-otp-textinput` | 6-box auto-advance |
| Step wizard (feedback) | Custom component using Reanimated scroll | Feedback submission |
| Icons | Phosphor Icons | Open-source, RTL-friendly, line-style consistent |
| Image loading | `react-native-fast-image` | Blur-up placeholder + cache |
| Gestures | `react-native-gesture-handler` | Precision cross-platform |
| Haptics | `expo-haptics` | Built-in, zero setup |

---

## 13. Implementation Patterns (TypeScript)

### Pattern 1: Hero Carousel + Sticky Tabs (Home Feed)

```typescript
// Structure — FlashList-based home feed
<Animated.ScrollView onScroll={scrollHandler}>
  <HeroCarousel
    data={slides}
    autoPlay
    autoPlayInterval={4000}
    // react-native-reanimated-carousel
  />
  <QuickStatsWidget stats={quickStats} />
  <StickyHeader scrollY={scrollY}>
    <CategoryChipBar categories={categories} onSelect={setFilter} />
  </StickyHeader>
  <QuickActionGrid actions={quickActions} />
  <WhatsNewRibbon items={recentAnnouncements} />
  <ActivePollsPreview polls={activePolls} />
</Animated.ScrollView>

// Carousel: Auto-play 4s, swipe to jump, dot indicators
// 300ms cubic-bezier(0.4, 0, 0.2, 1) transition
// Tabs: horizontal scroll, tap to filter, smooth content swap
// Grid: FlashList for performance (NOT FlatList)
```

### Pattern 2: Smooth Card Interactions

```typescript
const useCardPress = () => {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withSpring(1.02, { damping: 20, stiffness: 300 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1.0, { damping: 20, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { onPressIn, onPressOut, animatedStyle };
};

// All cards:
// - 12dp border radius
// - Soft warm gold-tinted shadow (default)
// - Scale 1 → 1.02 on press (100ms spring)
// - Haptic: light impact on press
// - Touch target minimum 44dp height
```

### Pattern 3: Poll Vote Animation

```typescript
const PollBar = ({ percentage, animated }: { percentage: number; animated: boolean }) => {
  const width = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      width.value = withSpring(percentage, {
        mass: 1,
        stiffness: 200,
        damping: 20,
        // 500ms spring — fills to new % after vote
      });
    }
  }, [percentage, animated]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    backgroundColor: '#b8966a', // gold-500
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, barStyle]} />
    </View>
  );
};

// Vote button tap:
// - Button fills with gold #b8966a (200ms spring)
// - All bars animate to new % simultaneously (500ms spring)
// - Option scales slightly (1 → 1.02)
// - Haptic: success on vote
```

### Pattern 4: Skeleton Loading

Library: **`react-native-shimmer-placeholder`** + **`expo-linear-gradient`**
(NOT `react-native-skeleton-placeholder` — different library, different API)

```typescript
import ShimmerPlaceHolder from 'react-native-shimmer-placeholder';
import { LinearGradient } from 'expo-linear-gradient';

// Warm shimmer colors — never cold grey
const SHIMMER_COLORS_DARK  = ['#221f1c', '#2e2a26', '#221f1c'] as const;
const SHIMMER_COLORS_LIGHT = ['#e4ceae', '#f2e8d8', '#e4ceae'] as const;

const ShopCardSkeleton = ({ isDark }: { isDark: boolean }) => (
  <View style={styles.card}>
    {/* Cover image placeholder */}
    <ShimmerPlaceHolder
      LinearGradient={LinearGradient}
      shimmerColors={isDark ? SHIMMER_COLORS_DARK : SHIMMER_COLORS_LIGHT}
      style={{ width: '100%', height: 140, borderRadius: 12 }}
    />
    {/* Shop name */}
    <ShimmerPlaceHolder
      LinearGradient={LinearGradient}
      shimmerColors={isDark ? SHIMMER_COLORS_DARK : SHIMMER_COLORS_LIGHT}
      style={{ marginTop: 12, width: '70%', height: 16, borderRadius: 4 }}
    />
    {/* Category + rating */}
    <ShimmerPlaceHolder
      LinearGradient={LinearGradient}
      shimmerColors={isDark ? SHIMMER_COLORS_DARK : SHIMMER_COLORS_LIGHT}
      style={{ marginTop: 8, width: '50%', height: 13, borderRadius: 4 }}
    />
    {/* Open/closed badge */}
    <ShimmerPlaceHolder
      LinearGradient={LinearGradient}
      shimmerColors={isDark ? SHIMMER_COLORS_DARK : SHIMMER_COLORS_LIGHT}
      style={{ marginTop: 8, width: '40%', height: 13, borderRadius: 4 }}
    />
  </View>
);

// Never show blank white/black screen
// Skeleton card count = expected real card count (prevents layout jump)
// Shimmer: warm gold gradient wave — NEVER cold grey
// Fade real content in when loaded (opacity 0→1 transition)
```

### Pattern 5: Bottom Sheets

```typescript
const FilterSheet = () => {
  const sheetRef = useRef<BottomSheet>(null);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['50%', '90%']}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: isDark ? '#2e2a26' : '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: '#b8966a' }}
      // 250ms cubic-bezier(0.0, 0.0, 0.2, 1) entrance
      // Backdrop cross-fades (200ms)
      // Content scrolls inside sheet, not backdrop
      // Haptic on close
    >
      <BottomSheetScrollView>
        {/* Filter content */}
      </BottomSheetScrollView>
    </BottomSheet>
  );
};
```

### Pattern 6: Like Animation

```typescript
const useLikeAnimation = () => {
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  const triggerLike = () => {
    // Scale: 0.2 → 1.3 → 1.0 over 500ms spring
    scale.value = withSequence(
      withSpring(1.3, { damping: 10, stiffness: 400 }),
      withSpring(1.0, { damping: 15, stiffness: 300 })
    );
    // Trail upward and fade
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(300, withTiming(0, { duration: 400 }))
    );
    translateY.value = withTiming(-60, { duration: 800 });
    // Haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return { scale, opacity, translateY, triggerLike };
};
```

### Pattern 7: Success State Animation

```typescript
const SuccessAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const containerScale = useSharedValue(1);
  const checkmarkRotate = useSharedValue(0);
  const messageTranslateX = useSharedValue(50);
  const messageOpacity = useSharedValue(0);

  useEffect(() => {
    // Container scale: 1 → 1.05 (100ms)
    containerScale.value = withTiming(1.05, { duration: 100 }, () => {
      containerScale.value = withTiming(1, { duration: 100 });
    });
    // Checkmark rotates in (200ms)
    checkmarkRotate.value = withDelay(100, withSpring(360, { damping: 15 }));
    // Message slides in from right (300ms)
    messageTranslateX.value = withDelay(200, withSpring(0, { damping: 20 }));
    messageOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    // Navigate after 2s
    setTimeout(onComplete, 2000);
  }, []);

  // ... animated JSX
};
```

### Pattern 8: Cursor Pagination with FlashList

```typescript
// All list screens use this pattern
const useShopList = (filter: ShopCategory | null) => {
  return useInfiniteQuery({
    queryKey: ['shops', filter],
    queryFn: ({ pageParam }) =>
      api.getShops({ cursor: pageParam, limit: 20, category: filter }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
};

// FlashList renders flat data from pages
const flatData = data?.pages.flatMap((p) => p.items) ?? [];

<FlashList
  data={flatData}
  renderItem={({ item }) => <ShopCard shop={item} />}
  estimatedItemSize={200}
  onEndReached={() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }}
  onEndReachedThreshold={0.5}
  ListFooterComponent={isFetchingNextPage ? <ShopCardSkeleton /> : null}
/>
```

---

## 14. Success Metrics

| Metric | Target |
|---|---|
| Animation frame rate | >55fps on mid-range Android (no dropped frames) |
| App load time | <2s on 4G connection |
| Time to Interactive | <3s |
| Color contrast | 100% WCAG AA pass (4.5:1 text, 3:1 graphics) |
| Touch targets | 100% of interactive elements ≥44dp |
| Accessibility | Full TalkBack + VoiceOver compatibility |
| RTL | Full layout mirror in Arabic — 0 hardcoded LTR strings |
| 30-day retention | Improvement after design rollout vs baseline |
| Shopping conversion | Orders placed per session (checkout smoothness) |
| Community participation | Poll votes, announcement comments, feedback submissions per DAU |

---

## 15. Do-Not-Do List

All 18 anti-patterns. Each violation must be caught before PR merge.

| Avoid | Instead |
|---|---|
| Emerald green `#10b981` anywhere | Gold `#b8966a` is the brand primary — green is not in this brand |
| Cold gray surfaces (`#f4f4f5`, zinc scale, `#18181b`) | Warm off-white `#faf8f5` light / warm dark `#0d0c0b` dark |
| Pure white `#fff` as page background | `surface` `#faf8f5` for pages; white only for elevated cards |
| Cold dark backgrounds (zinc `#18181b`, `#27272a`) | Warm dark `#221f1c` — matches the logo's warm black |
| Pure black `#000` dark mode background | Use `#0d0c0b` (warm near-black extracted from logo) |
| Amber as a primary/brand color | Amber (`#c48b2f`) is warnings only — gold is the brand |
| Any non-Cairo font for functional UI (Inter, Roboto, SF Pro, etc.) | Cairo only — all buttons, inputs, labels, lists, both EN and AR. Inter is NOT in this stack. |
| Cormorant Garamond for Arabic text | Cairo only for all Arabic — serif fonts don't render correctly in Arabic |
| Hamburger/drawer navigation | All features in bottom tab stacks — no drawer |
| FAB (floating action button) | In-context actions within each screen |
| FlatList for long lists | FlashList — always |
| Circular spinner on load or pull-to-refresh | Shimmer skeleton pattern on load; skeleton cards on pull-to-refresh |
| Wizard checkout flow | Single long-scroll checkout screen (Talabat pattern) |
| Deep nested comment threading (Reddit style) | Max 1 level of reply nesting — "View X replies" expands inline |
| Auto-refresh feed (scrolls user to top) | "New posts available" float chip (Facebook pattern) — user controls scroll |
| Hardcoded strings in components | All text through i18n keys from day 1 |
| Toast for order status updates | Push notification + real-time Socket.io state update |
| Gold `#b8966a` as text on light backgrounds | Use gold-700 `#7a5e38` for gold text on light (WCAG AA compliance) |

---

## 16. Impeccable AI Skill Pack

**What it is:** A Claude Code skill pack (impeccable.style) giving 21 design commands for frontend quality. Replaces generic "make it look better" prompts with precise, domain-specific design operations.

**Status:** Already installed via `npx skills add pbakaus/impeccable --yes` and active.
**Update:** `npx skills update`

### All 21 Commands — EastPark Usage Map

| Command | What It Does | When to Use on EastPark |
|---|---|---|
| `/teach-impeccable` | One-time setup — generates `.impeccable.md` design context | Run once at project start; re-run after major brand changes |
| `/audit` | Scores 5 quality dimensions with P0–P3 severity ratings | Before every feature PR — catch accessibility and spacing regressions |
| `/critique` | UX review against Nielsen's 10 heuristics + cognitive load | After building a full screen (shop detail, checkout, feedback wizard) |
| `/polish` | Final pre-shipping design pass | Before marking any screen as complete |
| `/typeset` | Fixes typography — hierarchy, scale, weight, line-height | After wiring Cairo — ensure display/title/body/caption scale is correct |
| `/arrange` | Fixes layout and spacing | When a screen feels "off" — padding, alignment, rhythm |
| `/normalize` | Aligns component to design system standards | When a component drifts from the gold token system |
| `/distill` | Removes unnecessary complexity | When a screen has too many competing elements |
| `/clarify` | Improves UX copy clarity | Button labels, error messages, empty states, onboarding text |
| `/animate` | Adds purposeful motion via Reanimated 4 | After static screens work — poll bar, cart bounce, sheet spring |
| `/colorize` | Introduces strategic color | When a screen feels monotone — apply gold hierarchy intelligently |
| `/bolder` | Amplifies understated designs | When hero/carousel/governance results feel too timid |
| `/quieter` | Tones down overly bold designs | When community feed or complaint form is visually noisy |
| `/delight` | Adds moments of joy | Order confirmed Lottie, poll vote feedback, successful registration |
| `/extract` | Pulls repeated patterns into reusable components | After 2–3 screens share a pattern — shop card, announcement card |
| `/adapt` | Adapts design for different devices/contexts | RTL/LTR audit pass, tablet layout check, dark/light mode QA |
| `/onboard` | Designs onboarding and first-run flows | Auth flow, guest-to-resident upgrade, merchant invitation deep-link |
| `/optimize` | Performance and render optimizations | After `/audit` flags perf — FlashList, image caching, memoization |
| `/harden` | Error handling and edge cases | Empty states, network errors, 0-item cart, closed shop checkout |
| `/overdrive` | Technically extraordinary visual effects (beta) | Hero carousel glass morphism, premium dark mode depth effects |
| `/frontend-design` | General frontend design skill (base layer) | Baseline — powers all other commands |

### Recommended Workflow Per Phase

**Phase 1 (Foundation — no UI yet):**
```
Run /teach-impeccable → generates .impeccable.md with EastPark brand context
```

**Phase 2–6 (Per screen built):**
```
Build screen → /arrange → /typeset → /colorize → /critique → /polish
```

**Before any feature PR:**
```
/audit     ← catches P0/P1 issues (accessibility, contrast, spacing)
/harden    ← empty states, error boundaries, loading states
/clarify   ← button labels, error messages, Arabic copy
```

**After a full module is complete:**
```
/normalize ← drift check against gold token system
/extract   ← pull repeated patterns into shared components
/adapt     ← RTL + dark mode QA pass
```

**Pre-launch (Phase 7):**
```
/delight   ← add joy moments across the app
/overdrive ← premium effects on hero and onboarding
/polish    ← final pass on every screen
```

### `.impeccable.md` — Design Context

When `/teach-impeccable` prompts for context, provide:

```
Brand: EastPark — luxury residential compound, MENA, premium feel
Primary color: #b8966a (warm gold, from brand logo)
Gold text on light: #7a5e38 (gold-700 — WCAG AA compliant)
Background light: #faf8f5 (warm off-white)
Background dark: #0d0c0b (near-black, from logo)
Card dark: #221f1c
UI font: Cairo (400/500/600/700) — Arabic + English ALL functional text
Display font: Cormorant Garamond 700/900 — English branding moments only
Personality: Premium, civic, warm — NOT startup, NOT cold/minimal
Target: Arabic RTL primary, English LTR secondary
Platform: React Native (Expo) + NativeWind + Gluestack UI v2
Avoid: Pure black/white surfaces, cold zinc grays, emerald green, FABs, drawers, Inter font, FlatList, spinners
```

---

*EastPark Design System — Last updated March 2026. All decisions locked. Re-open only if brand fundamentals change.*
