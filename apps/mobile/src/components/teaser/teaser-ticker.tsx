import * as React from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, I18nManager, StyleSheet, Text, View } from "react-native";

import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { RADIUS, SPACING } from "@/theme/tokens";

import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

const ITEMS = ["ticker_1", "ticker_2", "ticker_3", "ticker_4", "ticker_5", "ticker_6"] as const;
/** Scroll speed of the marquee, in dp per second. */
const SPEED = 28;

/**
 * Slow marquee of what unlocks next (web `TeaserTicker`). The moving track is decorative and hidden
 * from assistive tech; the section's label carries the content. Under reduced motion the items
 * stop and wrap instead of scrolling.
 */
export function TeaserTicker() {
  const { t, i18n } = useTranslation();
  const palette = useTeaserPalette();
  const reduced = useReducedMotion();
  const label = t("home.teaser.ticker_label");
  const labels = ITEMS.map(key => t(`home.teaser.${key}`));

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${labels.join(i18n.language === "ar" ? "، " : ", ")}`}
      style={[styles.section, { borderColor: palette.border, backgroundColor: palette.card }]}
    >
      <View style={[styles.labelBox, { backgroundColor: palette.muted, borderEndColor: palette.border }]}>
        <Text style={[TEASER_TYPE.caption, styles.labelText, { color: palette.gold }]}>{label}</Text>
      </View>
      <View style={styles.viewport} importantForAccessibility="no-hide-descendants">
        {reduced
          ? <TickerCopy labels={labels} wrap />
          : <TickerTrack labels={labels} />}
      </View>
    </View>
  );
}

/** Two copies side by side; moving by one copy's width loops seamlessly. */
function TickerTrack({ labels }: { labels: string[] }) {
  const [shift] = React.useState(() => new Animated.Value(0));
  const [copyWidth, setCopyWidth] = React.useState(0);

  React.useEffect(() => {
    if (!copyWidth)
      return;
    shift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shift, {
        toValue: 1,
        duration: (copyWidth / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [copyWidth, shift]);

  // RTL lays the copies out from the right, so the track travels the other way.
  const direction = I18nManager.isRTL ? 1 : -1;
  const translateX = shift.interpolate({ inputRange: [0, 1], outputRange: [0, direction * copyWidth] });

  return (
    <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
      <View onLayout={event => setCopyWidth(event.nativeEvent.layout.width)}>
        <TickerCopy labels={labels} />
      </View>
      <TickerCopy labels={labels} />
    </Animated.View>
  );
}

function TickerCopy({ labels, wrap = false }: { labels: string[]; wrap?: boolean }) {
  const palette = useTeaserPalette();
  return (
    <View style={[styles.copy, wrap && styles.copyWrap]}>
      {labels.map(item => (
        <View key={item} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: `${palette.node}b3` }]} />
          <Text numberOfLines={1} style={[TEASER_TYPE.label, styles.itemText, { color: palette.textMuted }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  labelBox: { justifyContent: "center", paddingHorizontal: SPACING.md, borderEndWidth: 1 },
  labelText: { fontWeight: "700" },
  viewport: { flex: 1, minWidth: 0, overflow: "hidden", paddingVertical: SPACING.md },
  track: { flexDirection: "row", alignSelf: "flex-start" },
  copy: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  copyWrap: { flexWrap: "wrap", flexShrink: 1, rowGap: SPACING.sm },
  item: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.base },
  dot: { width: 6, height: 6, borderRadius: 3 },
  itemText: { fontWeight: "600" },
});
