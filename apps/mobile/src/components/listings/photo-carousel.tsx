import type { ViewToken } from "@shopify/flash-list";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Buildings } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, DARK, FONT, OVERLAY, RADIUS, SPACING } from "@/theme/tokens";

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/**
 * Full-bleed swipeable gallery (horizontal paging FlashList — no extra native
 * package, so it ships over OTA). The current photo is tracked through
 * viewability, not scroll offsets, so the counter is right in RTL too.
 */
export function PhotoCarousel({ photos, overlay }: { photos: string[]; overlay?: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const { width } = useWindowDimensions();
  const height = Math.round((width * 3) / 4);
  const [index, setIndex] = React.useState(0);

  const onViewableItemsChanged = React.useRef(({ viewableItems }: { viewableItems: ViewToken<string>[] }) => {
    const first = viewableItems.find(v => v.isViewable && v.index != null);
    if (first?.index != null)
      setIndex(first.index);
  }).current;

  if (photos.length === 0) {
    return (
      <View style={[styles.empty, { width, height, backgroundColor: colors.elevated }]} accessible accessibilityLabel={t("listings.no_photo")}>
        <Buildings size={48} color={colors.textMuted} />
        {overlay}
      </View>
    );
  }

  const n = (value: number) => formatNumber(value, i18n.language);

  return (
    <View style={{ width, height, backgroundColor: colors.elevated }}>
      <FlashList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, i) => `${i}-${uri}`}
        viewabilityConfig={VIEWABILITY}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item, index: i }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t("listings.photo_position", { current: n(i + 1), total: n(photos.length) })}
          />
        )}
      />
      {overlay}
      {photos.length > 1 && (
        <>
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>{`${n(index + 1)} / ${n(photos.length)}`}</Text>
          </View>
          <View style={styles.dots} pointerEvents="none" importantForAccessibility="no-hide-descendants">
            {photos.map((uri, i) => (
              <View key={`dot-${i}-${uri}`} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center" },
  counter: {
    position: "absolute",
    bottom: SPACING.md,
    end: SPACING.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: OVERLAY.scrimStrong,
  },
  counterText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, fontWeight: "600", color: DARK.text },
  dots: { position: "absolute", bottom: SPACING.md, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: `${BRAND.gold}66` },
  dotActive: { width: 16, backgroundColor: BRAND.gold },
});
