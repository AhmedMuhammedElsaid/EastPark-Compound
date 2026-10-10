import { router } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/ui/app-header";
import { openRegisterUnit } from "@/lib/web-links";
import { SEMANTIC, SPACING } from "@/theme/tokens";

import { ClosingCta } from "./closing-cta";
import { HowItWorks } from "./how-it-works";
import { LandingButton } from "./landing-button";
import { SealedVault } from "./sealed-vault";
import { TeaserHero } from "./teaser-hero";
import { TeaserTicker } from "./teaser-ticker";
import { useTeaserPalette } from "./use-teaser-palette";

/**
 * The Home tab for guests: the web public landing page (`LandingTeaser`) section for section —
 * hero with the rollout phases, "Unlocking soon" ticker, how you join, the open marketplace plus the
 * sealed governance and tracking cards, and the closing call to action. No session or live data.
 */
export function GuestLanding() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const palette = useTeaserPalette();

  const register = React.useCallback(() => {
    openRegisterUnit(() => showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error }));
  }, [t]);
  const signIn = React.useCallback(() => router.push("/(auth)/login"), []);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <AppHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TeaserHero
          eyebrow={t("landing.eyebrow")}
          lede={t("landing.teaser_lede")}
          actions={(
            <View style={styles.actions}>
              <LandingButton label={t("landing.hero_cta")} onPress={register} />
              <LandingButton label={t("landing.sign_in_cta")} onPress={signIn} variant="outline" />
            </View>
          )}
        />
        <TeaserTicker />
        <HowItWorks />
        <SealedVault
          market={{
            body: t("landing.pillar_market_open_body"),
            points: [
              t("landing.pillar_market_open_point_1"),
              t("landing.pillar_market_open_point_2"),
              t("landing.pillar_market_open_point_3"),
            ],
          }}
          governance={{
            body: t("landing.pillar_governance_body"),
            points: [
              t("landing.pillar_governance_point_1"),
              t("landing.pillar_governance_point_2"),
              t("landing.pillar_governance_point_3"),
            ],
          }}
        />
        <ClosingCta onRegister={register} onSignIn={signIn} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.base, paddingBottom: SPACING["3xl"], gap: SPACING["2xl"] },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACING.md },
});
