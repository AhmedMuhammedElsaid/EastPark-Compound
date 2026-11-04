import type { AdminListingAction } from "@/components/listings/use-admin-listing-actions";
import type { useAppColors } from "@/lib/hooks/use-app-colors";
import type { AdminListing } from "@/services/api/listings";
import { Image } from "expo-image";
import { Buildings } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusPill, TypeTag, usePriceLabel } from "@/components/listings/listing-bits";
import { formatNumber } from "@/lib/format-number";
import { adminActions } from "@/lib/listings";
import { BRAND, FONT, LIGHT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;
export type AdminCardStyles = ReturnType<typeof buildAdminCardStyles>;

export function buildAdminCardStyles(colors: Colors) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.md,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    top: { flexDirection: "row", gap: SPACING.md },
    thumb: { width: 88, height: 88, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center" },
    thumbImg: { width: "100%", height: "100%" },
    info: { flex: 1, gap: 2 },
    tagRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
    unit: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: colors.text, writingDirection: "ltr" },
    price: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: gold },
    meta: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    actions: { flexDirection: "row", gap: SPACING.sm },
    btn: { flex: 1, minHeight: 44, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.md },
    btnApprove: { backgroundColor: BRAND.gold },
    btnApproveText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 20, color: BRAND.ink },
    btnDanger: { borderWidth: 1, borderColor: SEMANTIC.error },
    btnDangerText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 20, color: colors.text },
    btnDangerFilled: { backgroundColor: SEMANTIC.error },
    btnDangerFilledText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 20, color: LIGHT.bg },
    disabled: { opacity: 0.5 },
  });
}

/** Approve / Reject (PENDING) or Take down (APPROVED); shared by the card and the detail screen. */
export function AdminActionButtons({ listing, pending, onAction, styles }: {
  listing: AdminListing;
  pending?: AdminListingAction;
  onAction: (listing: AdminListing, action: AdminListingAction) => void;
  styles: AdminCardStyles;
}) {
  const { t } = useTranslation();
  const allowed = adminActions(listing.status);
  if (!allowed.approve && !allowed.reject && !allowed.takeDown)
    return null;
  const busy = !!pending;
  const label = (action: AdminListingAction, key: string) => (pending === action ? t("common.loading") : t(key));

  return (
    <View style={styles.actions}>
      {allowed.reject && (
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnDanger, busy && styles.disabled, pressed && styles.pressed]}
          onPress={() => onAction(listing, "reject")}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.btnDangerText}>{label("reject", "listings.reject")}</Text>
        </Pressable>
      )}
      {allowed.approve && (
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnApprove, busy && styles.disabled, pressed && styles.pressed]}
          onPress={() => onAction(listing, "approve")}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.btnApproveText}>{label("approve", "listings.approve")}</Text>
        </Pressable>
      )}
      {allowed.takeDown && (
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnDangerFilled, busy && styles.disabled, pressed && styles.pressed]}
          onPress={() => onAction(listing, "takeDown")}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.btnDangerFilledText}>{label("takeDown", "listings.take_down")}</Text>
        </Pressable>
      )}
    </View>
  );
}

type Props = {
  listing: AdminListing;
  pending?: AdminListingAction;
  onPress: () => void;
  onAction: (listing: AdminListing, action: AdminListingAction) => void;
  styles: AdminCardStyles;
  colors: Colors;
};

export function AdminListingCard({ listing, pending, onPress, onAction, styles, colors }: Props) {
  const { t, i18n } = useTranslation();
  const priceLabel = usePriceLabel();
  const cover = listing.photos[0];

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${t("listings.unit", { unit: listing.unitLabel })}, ${t(`listings.status_${listing.status}`)}`}
      >
        <View style={styles.thumb}>
          {cover
            ? <Image source={{ uri: cover }} recyclingKey={listing.id} style={styles.thumbImg} contentFit="cover" />
            : <Buildings size={28} color={colors.textMuted} />}
        </View>
        <View style={styles.info}>
          <View style={styles.tagRow}>
            <TypeTag type={listing.type} />
            <StatusPill status={listing.status} />
          </View>
          <Text style={styles.unit} numberOfLines={1}>{listing.unitLabel}</Text>
          <Text style={styles.price} numberOfLines={1}>{priceLabel(listing.type, listing.price)}</Text>
          <Text style={styles.meta} numberOfLines={1}>{t("listings.listed_by", { name: listing.owner.name })}</Text>
          {listing.revisionCount > 0
            ? <Text style={styles.meta}>{t("listings.edits_total", { total: formatNumber(listing.revisionCount, i18n.language) })}</Text>
            : null}
        </View>
      </Pressable>
      <AdminActionButtons listing={listing} pending={pending} onAction={onAction} styles={styles} />
    </View>
  );
}
