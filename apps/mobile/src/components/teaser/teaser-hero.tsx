import type { TimelineItem, TimelineStatus } from "./teaser-timeline";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { FONT, RADIUS, SPACING } from "@/theme/tokens";

import { HeroBackdrop } from "./hero-backdrop";
import { StageIn } from "./stage-in";
import { TeaserTimeline } from "./teaser-timeline";
import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

const PHASES: Array<{ key: "phase1" | "phase2" | "phase3"; status: Exclude<TimelineStatus, "step"> }> = [
  { key: "phase1", status: "live" },
  { key: "phase2", status: "preparing" },
  { key: "phase3", status: "next" },
];

/**
 * Coming-soon hero (web `TeaserHero`): eyebrow, two-line title, lede, optional actions and the
 * "what unlocks next" rollout timeline, entering line by line. Phases are labels only.
 */
export function TeaserHero({ eyebrow, lede, actions }: { eyebrow: string; lede: string; actions?: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const palette = useTeaserPalette();
  // Cormorant Garamond is English display only — never Arabic.
  const display = i18n.language === "en" ? styles.titleDisplay : null;
  const phases: TimelineItem[] = PHASES.map(({ key, status }) => ({
    key,
    status,
    label: t(`home.teaser.${key}`),
    kicker: t(`home.teaser.status_${status}`),
  }));

  return (
    <View style={[styles.hero, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <HeroBackdrop />
      <View style={styles.content}>
        <StageIn step={0}>
          <Text style={[TEASER_TYPE.overline, { color: palette.gold }]}>{eyebrow}</Text>
        </StageIn>
        <View accessibilityRole="header" style={styles.title}>
          <StageIn step={1}>
            <Text style={[styles.titleText, display, { color: palette.text }]}>{t("home.teaser.hero_title_lead")}</Text>
          </StageIn>
          <StageIn step={2}>
            <Text style={[styles.titleText, display, { color: palette.gold }]}>{t("home.teaser.hero_title_accent")}</Text>
          </StageIn>
        </View>
        <StageIn step={3}>
          <Text style={[TEASER_TYPE.bodyLg, styles.lede, { color: palette.textMuted }]}>{lede}</Text>
        </StageIn>
        {actions ? <StageIn step={4} style={styles.actions}>{actions}</StageIn> : null}
        <StageIn step={actions ? 5 : 4} style={styles.timeline}>
          <Text style={[TEASER_TYPE.overline, { color: palette.gold }]}>{t("home.teaser.timeline_title")}</Text>
          <TeaserTimeline items={phases} label={t("home.teaser.phases_label")} />
        </StageIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: "hidden" },
  content: { paddingHorizontal: SPACING.lg, paddingVertical: 36 },
  title: { marginTop: SPACING.md },
  titleText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 30, lineHeight: 46 },
  titleDisplay: { fontFamily: FONT.display, fontSize: 36, lineHeight: 42 },
  lede: { marginTop: SPACING.base },
  actions: { marginTop: 28 },
  timeline: { marginTop: 36 },
});
