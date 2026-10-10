import { Image } from "expo-image";
import * as React from "react";
import { I18nManager, StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { BRAND } from "@/theme/tokens";

import { useTeaserPalette } from "./use-teaser-palette";

// eslint-disable-next-line perfectionist/sort-imports
const MARK = require("../../../assets/brand/mark.png");

/**
 * Decorative hero background (web `home-hero-glow` + `home-hero-mark`): a warm gold glow from the
 * top end corner, a softer one from the bottom start, and a faint EastPark mark bleeding off the
 * end edge. The web film grain has no RN equivalent and is left out. Hidden from assistive tech.
 */
export function HeroBackdrop() {
  const palette = useTeaserPalette();
  const rtl = I18nManager.isRTL;
  const strong = palette.isDark ? 0.24 : 0.22;
  const soft = palette.isDark ? 0.1 : 0.12;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glowEnd" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={BRAND.gold} stopOpacity={strong} />
            <Stop offset="1" stopColor={BRAND.gold} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowStart" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={BRAND.gold} stopOpacity={soft} />
            <Stop offset="1" stopColor={BRAND.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={rtl ? "0%" : "100%"} cy="0%" rx="90%" ry="70%" fill="url(#glowEnd)" />
        <Ellipse cx={rtl ? "100%" : "0%"} cy="100%" rx="70%" ry="55%" fill="url(#glowStart)" />
      </Svg>
      <Image
        source={MARK}
        style={styles.mark}
        contentFit="contain"
        tintColor={palette.isDark ? undefined : BRAND.goldText}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: "absolute",
    top: "50%",
    end: "-18%",
    width: 240,
    height: 240,
    marginTop: -120,
    opacity: 0.11,
  },
});
