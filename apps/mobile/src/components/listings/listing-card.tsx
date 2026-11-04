import type { Listing, MyListing } from "@/services/api/listings";
import { Image } from "expo-image";
import { Buildings } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ListingSpecs, StatusPill, TypeTag, usePriceLabel } from "@/components/listings/listing-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type Props = {
  listing: Listing | MyListing;
  onPress: () => void;
  /** Owner views show the status pill (browse only ever shows live listings). */
  showStatus?: boolean;
};

/** 16:9 cover with a Sale/Rent tag → price → flat label → specs. */
export function ListingCard({ listing, onPress, showStatus }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(colors);
  const priceLabel = usePriceLabel();
  const cover = listing.photos[0];
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const price = priceLabel(listing.type, listing.price);
  const unit = t("listings.unit", { unit: listing.unitLabel });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t(`listings.type_${listing.type}`)}, ${unit}, ${price}`}
    >
      <View style={styles.cover}>
        {cover
          ? <Image source={{ uri: cover }} recyclingKey={listing.id} style={styles.coverImg} contentFit="cover" transition={150} />
          : (
              <View style={styles.coverEmpty}>
                <Buildings size={36} color={colors.textMuted} />
              </View>
            )}
        <View style={styles.tag}><TypeTag type={listing.type} /></View>
      </View>
      <View style={styles.body}>
        <Text style={[styles.price, { color: gold }]} numberOfLines={1}>{price}</Text>
        <Text style={styles.unit} numberOfLines={1}>{unit}</Text>
        <ListingSpecs areaSqm={listing.areaSqm} bedrooms={listing.bedrooms} bathrooms={listing.bathrooms} />
        {showStatus ? <View style={styles.statusRow}><StatusPill status={listing.status} /></View> : null}
      </View>
    </Pressable>
  );
}

export function ListingCardSkeleton() {
  const colors = useAppColors();
  const styles = useStyles(colors);
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={180} borderRadius={0} />
      <View style={styles.body}>
        <Skeleton width="45%" height={20} />
        <Skeleton width="30%" height={14} />
        <Skeleton width="60%" height={14} />
      </View>
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.md,
      overflow: "hidden",
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    cover: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.elevated },
    coverImg: { width: "100%", height: "100%" },
    coverEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
    tag: { position: "absolute", top: SPACING.sm, start: SPACING.sm },
    body: { padding: SPACING.md, gap: SPACING.xs },
    price: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28 },
    unit: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    statusRow: { marginTop: SPACING.xs },
  }), [colors]);
}
