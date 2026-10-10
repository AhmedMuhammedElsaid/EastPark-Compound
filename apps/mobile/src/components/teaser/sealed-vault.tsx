import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { SPACING } from "@/theme/tokens";

import { GovernancePreview } from "./governance-preview";
import { MarketplacePreview } from "./marketplace-preview";
import { OrderTrackingPreview } from "./order-tracking-preview";
import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

type FeatureCopy = { body: string; points: string[] };

/**
 * Landing version of the web `SealedVault interactive={false} marketOpen`: the open marketplace
 * card first, then "Sealed until launch" with the governance and order-tracking cards (not links —
 * visitors have nowhere to go yet).
 */
export function SealedVault({ market, governance }: { market: FeatureCopy; governance: FeatureCopy }) {
  const { t } = useTranslation();
  const palette = useTeaserPalette();

  return (
    <View style={styles.vault}>
      <MarketplacePreview body={market.body} points={market.points} />
      <View style={styles.sealed}>
        <View>
          <Text style={[TEASER_TYPE.overline, styles.overline, { color: palette.gold }]}>{t("home.teaser.sealed")}</Text>
          <Text accessibilityRole="header" style={[TEASER_TYPE.h1, styles.title, { color: palette.text }]}>
            {t("home.teaser.vault_title")}
          </Text>
          <Text style={[TEASER_TYPE.body, styles.sub, { color: palette.textMuted }]}>{t("home.teaser.vault_sub")}</Text>
        </View>
        <GovernancePreview body={governance.body} points={governance.points} />
        <OrderTrackingPreview />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  vault: { gap: SPACING["2xl"] },
  sealed: { gap: SPACING.xl },
  overline: { fontWeight: "700" },
  title: { marginTop: SPACING.xs },
  sub: { marginTop: SPACING.sm },
});
