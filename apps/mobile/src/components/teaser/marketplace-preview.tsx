import type { Icon } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Basket, CaretRight, Coffee, Storefront, Wrench } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import { BRAND, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

import { TeaserPoints } from "./soon-pill";
import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

// Static illustrative cards (web `MarketplacePreview`): same icon, label key and tint.
const CARDS: Array<{ key: string; icon: Icon; label: string; tint: string }> = [
  { key: "cafe", icon: Coffee, label: "directory.cafe_food", tint: `${BRAND.gold}33` },
  { key: "grocery", icon: Basket, label: "directory.grocery", tint: `${SEMANTIC.success}33` },
  { key: "butcher", icon: Storefront, label: "directory.butcher", tint: `${SEMANTIC.error}26` },
  { key: "services", icon: Wrench, label: "home.teaser.market_services", tint: `${SEMANTIC.info}33` },
];

/**
 * The open marketplace card of the landing (web `MarketplacePreview open`): the shops are already
 * browsable, so the card is a real "Browse shops" link to the Directory tab — no lock or seal.
 */
export function MarketplacePreview({ body, points }: { body: string; points: string[] }) {
  const { t } = useTranslation();
  const palette = useTeaserPalette();

  return (
    <View>
      <Text accessibilityRole="header" style={[TEASER_TYPE.h2, { color: palette.text }]}>{t("home.teaser.market_title")}</Text>
      <Text style={[TEASER_TYPE.body, styles.body, { color: palette.textMuted }]}>{body}</Text>
      <View style={styles.points}><TeaserPoints points={points} /></View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.navigate("/(tabs)/directory");
        }}
        accessibilityRole="link"
        accessibilityLabel={t("home.teaser.market_open_cta")}
        accessibilityHint={t("home.teaser.market_open_note")}
        style={({ pressed }) => [styles.card, { backgroundColor: palette.card, borderColor: pressed ? palette.node : palette.border }]}
      >
        <View style={styles.cards} importantForAccessibility="no-hide-descendants">
          {CARDS.map(({ key, icon: CardIcon, label, tint }) => (
            <View key={key} style={[styles.mini, { borderColor: palette.border, backgroundColor: palette.bg }]}>
              <View style={[styles.miniArt, { backgroundColor: tint }]}>
                <CardIcon size={32} color={`${palette.text}b3`} />
              </View>
              <View style={styles.miniBody}>
                <Text numberOfLines={1} style={[TEASER_TYPE.label, styles.miniLabel, { color: palette.text }]}>{t(label as any)}</Text>
                <View style={[styles.bar, styles.barLong, { backgroundColor: palette.muted }]} />
                <View style={[styles.bar, styles.barShort, { backgroundColor: palette.muted }]} />
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <View style={styles.footerText}>
            <Text style={[TEASER_TYPE.body, styles.cta, { color: palette.gold }]}>{t("home.teaser.market_open_cta")}</Text>
            <Text style={[TEASER_TYPE.label, { color: palette.textMuted }]}>{t("home.teaser.market_open_note")}</Text>
          </View>
          <CaretRight size={20} color={palette.gold} mirrored={I18nManager.isRTL} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: SPACING.xs },
  points: { marginTop: SPACING.md },
  card: { marginTop: SPACING.base, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.base, overflow: "hidden" },
  cards: { flexDirection: "row", gap: SPACING.md, overflow: "hidden" },
  mini: { width: "42%", flexShrink: 0, borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  miniArt: { height: 96, alignItems: "center", justifyContent: "center" },
  miniBody: { padding: SPACING.md, gap: SPACING.sm },
  miniLabel: { fontWeight: "700" },
  bar: { height: 8, borderRadius: RADIUS.xs },
  barLong: { width: "75%" },
  barShort: { width: "50%" },
  footer: {
    marginTop: SPACING.base,
    paddingTop: SPACING.md,
    minHeight: 44,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  footerText: { flex: 1, minWidth: 0 },
  cta: { fontWeight: "700" },
});
