import { FONT } from "@/theme/tokens";

/** Type scale of the teaser sections (web `--text-*` tokens at phone width). */
export const TEASER_TYPE = {
  overline: { fontFamily: FONT.sans, fontWeight: "600" as const, fontSize: 12, lineHeight: 18, letterSpacing: 1 },
  h1: { fontFamily: FONT.sans, fontWeight: "700" as const, fontSize: 24, lineHeight: 36 },
  h2: { fontFamily: FONT.sans, fontWeight: "700" as const, fontSize: 20, lineHeight: 30 },
  bodyLg: { fontFamily: FONT.sans, fontWeight: "400" as const, fontSize: 16, lineHeight: 27 },
  body: { fontFamily: FONT.sans, fontWeight: "400" as const, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: FONT.sans, fontWeight: "500" as const, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: FONT.sans, fontWeight: "600" as const, fontSize: 12, lineHeight: 18 },
} as const;
