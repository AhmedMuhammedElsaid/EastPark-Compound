import type { ComingSoonFeature } from "@/lib/coming-soon";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Bell, ShoppingBag } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useGuestGate } from "@/lib/hooks/use-guest-gate";
import { notificationsApi } from "@/services/api/notifications";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

const MARK = require("../../../assets/brand/mark.png");

/**
 * Top app bar shared by the tab roots — mirrors the web AppShell header:
 * brand mark + name at the start, cart (with count) and notifications at the end.
 * The caller handles the top safe-area inset.
 */
export function AppHeader({ title }: { title?: string }) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  const { gateNavigation } = useGuestGate();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const cartCount = useAppSelector(s => s.cart.items.reduce((n: number, i: { quantity: number }) => n + i.quantity, 0));

  // Same endpoint the notifications screen pages through; one item is enough for the count.
  const { data } = useQuery({
    // Under the "notifications" root so the feed's invalidations refresh the dot too.
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.getNotifications({ limit: 1 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const unread = isAuthenticated ? (data?.data.data.unreadCount ?? 0) : 0;

  // Guests get the Coming soon sheet: ordering and notifications are not public yet.
  function go(href: string, feature?: ComingSoonFeature) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    gateNavigation(href, feature);
  }

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Image source={MARK} style={styles.mark} contentFit="contain" accessibilityIgnoresInvertColors />
        <Text style={styles.title} numberOfLines={1}>{title ?? t("common.brand")}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => go("/checkout/cart", "market")}
          accessibilityRole="button"
          accessibilityLabel={t("cart.title")}
          hitSlop={4}
        >
          <ShoppingBag size={22} color={colors.text} />
          {cartCount > 0 && (
            <View style={styles.count}>
              <Text style={styles.countText}>{cartCount > 9 ? `${formatNumber(9, i18n.language)}+` : formatNumber(cartCount, i18n.language)}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => go("/notifications")}
          accessibilityRole="button"
          accessibilityLabel={t("notifications.title")}
          hitSlop={4}
        >
          <Bell size={22} color={colors.text} />
          {unread > 0 && <View style={styles.dot} />}
        </Pressable>
      </View>
    </View>
  );
}

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    bar: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SPACING.base,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.bg,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexShrink: 1 },
    mark: { width: 28, height: 28 },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 17, color: colors.text },
    actions: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { backgroundColor: colors.elevated },
    count: {
      position: "absolute",
      top: 4,
      end: 2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: BRAND.gold,
      alignItems: "center",
      justifyContent: "center",
    },
    countText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 10, color: BRAND.ink },
    dot: {
      position: "absolute",
      top: 10,
      end: 11,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: BRAND.gold,
      borderWidth: 1.5,
      borderColor: colors.bg,
    },
  });
}
