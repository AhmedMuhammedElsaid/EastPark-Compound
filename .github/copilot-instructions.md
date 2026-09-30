# EastPark — Copilot Instructions

## Design Context

### Users

**Age range:** 20–60. Design must be modern but legible for the full range. Minimum 14sp body text, 16sp primary content, 48dp preferred touch targets.

**Primary user:** Residents of a gated residential compound in the MENA region. They interact with EastPark daily — ordering from compound shops, reading community announcements, voting in governance polls, and submitting service complaints.

**Secondary roles:** Guests (read-only), Merchants (order management), Compound Admins (announcements, elections, feedback).

**Job to be done:** A single trusted platform replacing fragmented WhatsApp groups, paper notices, and in-person requests — handling commerce, governance, and compound management.

**Language context:** Arabic is the primary language and RTL is the primary layout direction. English (LTR) is secondary and switchable. Every design decision must work in both directions.

---

### Brand Personality

**Three words:** Prestige. Civic. Warm.

**Voice:** Calm authority. Clear, unhurried, competent. Never chatty, never alarming without reason.

**Benchmark apps:**
- **MyGate** — civic UX: quick actions, status timelines, role-based layouts
- **Talabat** — commerce: carousels, category chips, skeleton loading, cart mechanics
- **Facebook** — engagement: card feeds, reactions, comments, infinite scroll
- **YouTube** — transitions: smooth navigation, sticky chip bars

---

### Aesthetic Direction

**Theme:** Dark mode is the flagship experience and the default. Light mode is a user-toggled preference.

**Color system:**

| Token | Hex | Role |
|---|---|---|
| gold-500 (PRIMARY) | `#b8966a` | CTAs, active states, badges — use sparingly |
| gold-400 | `#c4a07a` | Hover / focus |
| gold-600 | `#9e7d52` | Pressed state |
| dark-bg | `#0d0c0b` | Page background (dark mode) |
| dark-card | `#221f1c` | Card surfaces |
| dark-elevated | `#2e2a26` | Modals, bottom sheets |
| dark-border | `#3d3830` | Dividers |
| dark-text | `#faf8f5` | Primary text on dark |
| dark-muted | `#a89880` | Supporting text on dark |
| light-bg | `#faf8f5` | Page background (light mode) |
| light-card | `#ffffff` | Card backgrounds |
| light-border | `#e4ceae` | Dividers |
| light-text | `#1a1714` | Primary text on light |
| light-muted | `#7a6e62` | Supporting text on light |
| success | `#5A7A52` | Muted olive green |
| warning | `#C48B2F` | Deep amber |
| error | `#B03A2E` | Deep muted red |
| info | `#4A6B8A` | Slate blue |

**Color rules:**
- Gold `#b8966a` is reserved for primary interaction only — never decorative fill
- Never use pure `#000000` or `#ffffff` as surfaces
- Never use cold zinc/gray tones — always warm equivalents
- No neon, no candy colors

**Typography:**

| Font | Use | Languages |
|---|---|---|
| Cairo | All functional UI — all Arabic text at every scale | Arabic + English |
| Cormorant Garamond | Display / hero only — splash, onboarding hero, app name | English only, never Arabic |

Cairo scale: Display 700/28sp · Title 600/20sp · Body-lg 500/16sp · Body 400/14sp · Label 500/13sp · Caption 400/12sp

**Border radius:** xs 4dp · sm 8dp · md 12dp (standard card) · lg 16dp · xl 24dp · full 9999

**Touch targets:** 44dp minimum, 48dp preferred

**Lists:** Always use @shopify/flash-list — never FlatList

**Motion:** Rich and delightful — every screen should feel alive. Spring physics on sheets/cards, Lottie on all key confirmations (order placed, vote submitted, complaint resolved), parallax on hero carousel, skeleton shimmer on all loading states (never spinners on lists), haptics paired with every visual interaction. Respect `prefers-reduced-motion`.

**Empty states:** Branded Lottie animations per screen — never generic placeholders

---

### Design Principles

1. **Prestige over perk.** Gold is used sparingly because it means something when it appears. Less is more.
2. **Warm, never cold.** All surfaces and neutrals carry warm undertones. No cold zinc. No clinical white.
3. **Arabic-native, bilingual-ready.** RTL-first. Every layout must work in Arabic before English is considered.
4. **Dark is the default, light is a choice.** Dark mode ships first and looks best.
5. **Alive, not showy.** Motion is rich and expressive — spring physics, Lottie, micro-interactions everywhere. Every animation earns its place. Degrade gracefully for reduced-motion.
6. **Trust through consistency.** Civic features demand predictable, unambiguous UI. Residents always know where they are and what happens next.

---

### Accessibility

**Standard:** WCAG AA
- Text contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text 18sp+)
- Touch targets: 44dp min, 48dp preferred
- `accessibilityLabel` + `accessibilityRole` on all interactive elements
- VoiceOver / TalkBack support for all primary flows
- Gold `#b8966a` as text: only on dark backgrounds (`#0d0c0b` passes ~4.7:1). On light: use `gold-700` `#7a5e38` instead
- `prefers-reduced-motion`: fall back to opacity or instant transitions

---

### What NOT to Build

- No cold blue / zinc gray palette — no generic SaaS or Material Design defaults
- No rounded-everything, card-in-card nesting
- No gradient buttons or neon accents
- No hamburger menus or drawer navigation
- No FlatList (use @shopify/flash-list)
- No startup-trendy design that ages in 18 months
