import type { Shop } from "@/services/api/shops";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Star, Storefront } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCount, formatRating } from "@/components/directory/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { isShopOpenNow } from "@/lib/working-hours";
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Props = { shop: Shop };

/**
 * Shop card — mirrors the web directory card:
 * 16:9 cover with an Open/Closed pill at the end edge → name → category · rating (count).
 * Closed shops dim their cover. Loading state is handled by the parent (skeleton).
 */
export function ShopCard({ shop }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(colors);
  const isAr = i18n.language === "ar";

  const coverPhoto = shop.photos?.find(p => p.isPrimary) ?? shop.photos?.[0];
  const displayName = isAr ? shop.nameAr : shop.name;
  const categoryLabel = t(`directory.${shop.category.toLowerCase().replace("_and_", "_")}`);
  const hasRating = typeof shop.averageRating === "number";
  const openNow = isShopOpenNow(shop, new Date());

  function handlePress() {
    router.push(`/(tabs)/directory/${shop.id}`);
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={displayName}
    >
      <View style={styles.imageContainer}>
        {coverPhoto
          ? (
              <Image
                source={{ uri: coverPhoto.url }}
                recyclingKey={shop.id}
                style={[styles.image, !openNow && styles.imageClosed]}
                contentFit="cover"
                transition={150}
              />
            )
          : (
              <View style={styles.imagePlaceholder}>
                <Storefront size={36} color={colors.textMuted} />
              </View>
            )}

        <View style={[styles.badge, openNow ? styles.badgeOpen : styles.badgeClosed]}>
          <Text style={[styles.badgeText, openNow ? styles.badgeTextOpen : null]}>
            {openNow ? t("common.open") : t("common.closed")}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        <View style={styles.meta}>
          <Text style={styles.category} numberOfLines={1}>{categoryLabel}</Text>
          {hasRating && (
            <>
              <Text style={styles.dot}>·</Text>
              <Star size={13} weight="fill" color={BRAND.gold} />
              <Text style={styles.ratingText}>{formatRating(shop.averageRating as number)}</Text>
              <Text style={styles.reviewCount}>{`(${formatCount(shop.reviewCount)})`}</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.card,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: SPACING.md,
          overflow: "hidden",
        },
        pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
        imageContainer: {
          width: "100%",
          aspectRatio: 16 / 9,
          backgroundColor: colors.elevated,
        },
        image: {
          width: "100%",
          height: "100%",
        },
        imageClosed: { opacity: 0.55 },
        imagePlaceholder: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        badge: {
          position: "absolute",
          top: SPACING.md,
          end: SPACING.md,
          minHeight: 28,
          paddingHorizontal: SPACING.md,
          borderRadius: RADIUS.full,
          justifyContent: "center",
        },
        badgeOpen: { backgroundColor: SEMANTIC.success },
        badgeClosed: { backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
        badgeText: {
          fontFamily: FONT.sans,
          fontWeight: "700",
          fontSize: 12,
          lineHeight: 18,
          includeFontPadding: false,
          color: colors.text,
        },
        // Light text on the olive success fill in both themes (dark text fails on it).
        badgeTextOpen: { color: DARK.text },
        body: {
          paddingHorizontal: SPACING.base,
          paddingTop: SPACING.md,
          paddingBottom: SPACING.md,
          gap: SPACING.xs,
        },
        name: {
          fontFamily: FONT.sans,
          fontWeight: "700",
          fontSize: 16,
          lineHeight: 24,
          includeFontPadding: false,
          color: colors.text,
        },
        meta: {
          flexDirection: "row",
          alignItems: "center",
          gap: SPACING.xs,
        },
        category: {
          fontFamily: FONT.sans,
          fontSize: 13,
          lineHeight: 20,
          includeFontPadding: false,
          color: colors.textMuted,
          flexShrink: 1,
        },
        dot: { fontFamily: FONT.sans, color: colors.textMuted, fontSize: 13, lineHeight: 20, includeFontPadding: false },
        ratingText: {
          fontFamily: FONT.sans,
          fontWeight: "600",
          fontSize: 13,
          lineHeight: 20,
          includeFontPadding: false,
          color: colors.text,
        },
        reviewCount: {
          fontFamily: FONT.sans,
          fontSize: 12,
          lineHeight: 20,
          includeFontPadding: false,
          color: colors.textMuted,
        },
      }),
    [colors],
  );
}

/** Loading placeholder with the card's exact geometry (16:9 cover, border, body) so nothing jumps. */
export function ShopCardSkeleton() {
  const colors = useAppColors();
  const styles = useStyles(colors);
  return (
    <View style={styles.card}>
      <View style={styles.imageContainer} />
      <View style={styles.body}>
        <Skeleton width="65%" height={20} />
        <Skeleton width="45%" height={14} />
      </View>
    </View>
  );
}
