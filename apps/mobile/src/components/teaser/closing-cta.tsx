import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { RADIUS, SPACING } from "@/theme/tokens";

import { LandingButton } from "./landing-button";
import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

/** Closing call to action (web `ClosingCta`): reserve a place for launch, or sign in if invited. */
export function ClosingCta({ onRegister, onSignIn }: { onRegister: () => void; onSignIn: () => void }) {
  const { t } = useTranslation();
  const palette = useTeaserPalette();

  return (
    <View style={[styles.section, { backgroundColor: palette.muted, borderColor: palette.border }]}>
      <Text accessibilityRole="header" style={[TEASER_TYPE.h1, styles.center, { color: palette.text }]}>
        {t("landing.closing_title")}
      </Text>
      <Text style={[TEASER_TYPE.bodyLg, styles.center, styles.body, { color: palette.textMuted }]}>
        {t("landing.closing_body")}
      </Text>
      <View style={styles.actions}>
        <LandingButton label={t("landing.closing_cta")} onPress={onRegister} />
        <LandingButton label={t("landing.sign_in_cta")} onPress={onSignIn} variant="outline" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING["3xl"] },
  center: { textAlign: "center" },
  body: { marginTop: SPACING.base },
  actions: { marginTop: SPACING["2xl"], flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACING.md },
});
