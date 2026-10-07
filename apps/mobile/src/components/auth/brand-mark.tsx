import { Image } from "expo-image";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { BRAND, RADIUS, SPACING } from "@/theme/tokens";

type Size = "sm" | "md" | "lg";

type Props = { size?: Size };

const LOGO = require("../../../assets/brand/logo.png");
// assets/brand/logo.png is the official lockup (mark + "EAST PARK" + caption)
// keyed onto transparency from eastpark.jpg.
const LOGO_ASPECT = 720 / 463;
const LOGO_WIDTH: Record<Size, number> = { sm: 140, md: 184, lg: 228 };

/**
 * EastPark brand mark — the official vertical logo lockup on the ink plate
 * (same artwork as the app icon, splash and the web header).
 */
export function BrandMark({ size = "md" }: Props) {
  const width = LOGO_WIDTH[size];
  const plateStyle = size === "sm" ? styles.plateSm : size === "lg" ? styles.plateLg : styles.plateMd;

  return (
    <View style={[styles.plate, plateStyle]}>
      <Image
        source={LOGO}
        style={{ width, height: width / LOGO_ASPECT }}
        contentFit="contain"
        accessibilityRole="image"
        accessibilityLabel="EastPark"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: "center",
    backgroundColor: BRAND.ink,
    borderColor: BRAND.goldDark,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    shadowColor: BRAND.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5,
  },
  plateSm: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  plateMd: { paddingHorizontal: SPACING["2xl"], paddingVertical: SPACING.lg },
  plateLg: { paddingHorizontal: SPACING["3xl"], paddingVertical: SPACING.xl },
});
