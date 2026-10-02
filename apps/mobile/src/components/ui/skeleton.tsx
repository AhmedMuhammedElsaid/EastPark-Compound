import * as React from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { RADIUS } from "@/theme/tokens";

type Props = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
};

/**
 * Skeleton shimmer — pulsing opacity animation.
 * Uses React Native's built-in Animated API (no reanimated) for Expo Go compatibility.
 * Colors: dark-card (#221f1c) → dark-elevated (#2e2a26) — warm, never grey.
 */
export function Skeleton({ width = "100%", height = 16, borderRadius = RADIUS.sm, style }: Props) {
  const colors = useAppColors();
  const opacity = React.useRef(new Animated.Value(0.5)).current;
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotion)
      return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
    return () => opacity.stopAnimation();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.card },
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

/** Skeleton preset for a shop card */
export function ShopCardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <Skeleton width="100%" height={160} borderRadius={RADIUS.md} />
      <View style={styles.cardBody}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={14} style={styles.mt8} />
        <Skeleton width="40%" height={12} style={styles.mt8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardSkeleton: {
    marginBottom: 16,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  cardBody: {
    padding: 12,
    gap: 4,
  },
  mt8: { marginTop: 8 },
});
