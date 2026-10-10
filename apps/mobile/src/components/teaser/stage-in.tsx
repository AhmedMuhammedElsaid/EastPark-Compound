import type { StyleProp, ViewStyle } from "react-native";
import * as React from "react";
import { Animated, Easing } from "react-native";

import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

const STAGE_MS = 140;

/**
 * Staged entrance (web `home-stage`): fades and lifts its children in, `step` × 140 ms after mount.
 * Under reduced motion the content is shown at once.
 */
export function StageIn({ step, style, children }: { step: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [progress] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      delay: step * STAGE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, step]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
