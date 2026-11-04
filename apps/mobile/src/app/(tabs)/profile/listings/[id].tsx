import type { Href } from "expo-router";
import type { Listing, ListingStatus, MyListing } from "@/services/api/listings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowClockwise, CheckCircle, PencilSimple, Prohibit } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { toneColor } from "@/components/listings/listing-bits";
import { ListingDetailBody } from "@/components/listings/listing-detail-body";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { showConfirm } from "@/lib/confirm-dialog";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { closeActionKey, daysLeft, isClosedStatus, listingErrorKey, ownerActions } from "@/lib/listings";
import { listingKeys, listingsApi } from "@/services/api/listings";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;
type Styles = ReturnType<typeof buildStyles>;
type OwnerAction = "renew" | "close" | "withdraw";

function buildStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    // Inside (tabs): the tab bar already clears the system navigation.
    scroll: { paddingBottom: SPACING["2xl"] },
    note: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, gap: SPACING.xs },
    noteTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 13, lineHeight: 20, color: colors.text },
    noteBody: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text },
    noteMuted: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    actions: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
    actionBtn: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.base,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    actionPrimary: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    actionDanger: { borderColor: `${SEMANTIC.error}99` },
    actionText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: colors.text },
    actionTextPrimary: { color: BRAND.ink },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    skBody: { padding: SPACING.base, gap: SPACING.md },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

function isMine(listing: Listing | MyListing): listing is MyListing {
  return "rejectReason" in listing;
}

/** The owner's view: status, the admin's reason, and Edit / Renew / Mark sold or rented / Withdraw. */
export default function MyListingDetailScreen() {
  const { t } = useTranslation();
  const { styles, colors } = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAppSelector(s => s.auth.user?.id);
  const queryClient = useQueryClient();

  const { data: listing, isError, isLoading, refetch } = useQuery({
    queryKey: listingKeys.detail(id ?? ""),
    queryFn: () => listingsApi.getById(id!),
    select: res => res.data.data,
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async (action: OwnerAction) => {
      const call = action === "renew" ? listingsApi.renew : action === "close" ? listingsApi.close : listingsApi.withdraw;
      return (await call(id!)).data.data;
    },
    onSuccess: (_updated, action) => {
      const toast = action === "renew" ? "listings.toast_renewed" : action === "close" ? "listings.toast_closed" : "listings.toast_withdrawn";
      showMessage({ message: t(toast), type: "success", backgroundColor: SEMANTIC.success });
    },
    onError: (error) => {
      showMessage({ message: t(listingErrorKey(error) as any), type: "danger", backgroundColor: SEMANTIC.error });
    },
    // Success or a 409 (the status moved under us): every view of the listing refetches.
    onSettled: () => queryClient.invalidateQueries({ queryKey: listingKeys.all }),
  });

  if (isError && !listing)
    return <DetailErrorScreen onRetry={() => refetch()} />;

  async function confirmAndRun(action: OwnerAction) {
    if (!listing || mutation.isPending)
      return;
    const copy = action === "renew"
      ? { title: t("listings.confirm_renew_title"), message: t("listings.confirm_renew_body"), confirmLabel: t("listings.confirm_renew_button"), destructive: false }
      : action === "close"
        ? { title: t("listings.confirm_close_title"), message: t("listings.confirm_close_body"), confirmLabel: t(closeActionKey(listing.type) as any), destructive: true }
        : { title: t("listings.confirm_withdraw_title"), message: t("listings.confirm_withdraw_body"), confirmLabel: t("listings.confirm_withdraw_button"), destructive: true };
    if (await showConfirm(copy))
      mutation.mutate(action);
  }

  const owned = !!listing && listing.owner.id === userId;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("listings.my_listings")} />
      {isLoading || !listing
        ? <DetailSkeleton styles={styles} />
        : (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <ListingDetailBody listing={listing} showStatus>
                <StatusNote listing={listing} styles={styles} colors={colors} />
              </ListingDetailBody>
              {owned && (
                <OwnerActionButtons
                  listing={listing}
                  busy={mutation.isPending}
                  onEdit={() => router.push({ pathname: "/(tabs)/profile/listings/edit", params: { id: listing.id } } as Href)}
                  onAction={confirmAndRun}
                  styles={styles}
                  colors={colors}
                />
              )}
            </ScrollView>
          )}
    </View>
  );
}

function StatusNote({ listing, styles, colors }: { listing: Listing | MyListing; styles: Styles; colors: Colors }) {
  const { t, i18n } = useTranslation();
  const status: ListingStatus = listing.status;
  const color = toneColor(status, colors);
  const box = [styles.note, { backgroundColor: `${color}1f`, borderColor: `${color}55` }];

  if (status === "REJECTED") {
    const reason = isMine(listing) ? listing.rejectReason : null;
    return (
      <View style={box}>
        {reason
          ? (
              <>
                <Text style={styles.noteTitle}>{t("listings.reject_reason")}</Text>
                <Text style={styles.noteBody}>{reason}</Text>
              </>
            )
          : null}
        <Text style={styles.noteMuted}>{t("listings.note_rejected")}</Text>
      </View>
    );
  }
  if (status === "PENDING")
    return <View style={box}><Text style={styles.noteMuted}>{t("listings.note_pending")}</Text></View>;
  if (isClosedStatus(status))
    return <View style={box}><Text style={styles.noteMuted}>{t("listings.note_closed")}</Text></View>;

  // APPROVED: how long it stays visible ("Visible until" is in the meta block below).
  const days = daysLeft(listing.expiresAt);
  if (days === null)
    return null;
  return (
    <View style={box}>
      <Text style={styles.noteBody}>{t("listings.days_left", { count: days, days: formatNumber(days, i18n.language) })}</Text>
    </View>
  );
}

type Tone = "primary" | "danger";

function ActionButton({ label, icon, onPress, tone, busy, styles }: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  tone?: Tone;
  busy: boolean;
  styles: Styles;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        tone === "primary" && styles.actionPrimary,
        tone === "danger" && styles.actionDanger,
        busy && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.actionText, tone === "primary" && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function OwnerActionButtons({ listing, busy, onEdit, onAction, styles, colors }: {
  listing: Listing | MyListing;
  busy: boolean;
  onEdit: () => void;
  onAction: (action: OwnerAction) => void;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const allowed = ownerActions(listing.status);
  if (!allowed.edit && !allowed.renew && !allowed.close && !allowed.withdraw)
    return null;
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  return (
    <View style={styles.actions}>
      {allowed.edit && (
        <ActionButton label={t("listings.action_edit")} icon={<PencilSimple size={18} color={BRAND.ink} weight="bold" />} onPress={onEdit} tone="primary" busy={busy} styles={styles} />
      )}
      {allowed.renew && (
        <ActionButton label={t("listings.action_renew")} icon={<ArrowClockwise size={18} color={gold} />} onPress={() => onAction("renew")} busy={busy} styles={styles} />
      )}
      {allowed.close && (
        <ActionButton label={t(closeActionKey(listing.type) as any)} icon={<CheckCircle size={18} color={SEMANTIC.success} />} onPress={() => onAction("close")} busy={busy} styles={styles} />
      )}
      {allowed.withdraw && (
        <ActionButton label={t("listings.action_withdraw")} icon={<Prohibit size={18} color={SEMANTIC.error} />} onPress={() => onAction("withdraw")} tone="danger" busy={busy} styles={styles} />
      )}
    </View>
  );
}

function DetailSkeleton({ styles }: { styles: Styles }) {
  return (
    <View>
      <Skeleton width="100%" height={280} borderRadius={0} />
      <View style={styles.skBody}>
        <Skeleton width="50%" height={28} />
        <Skeleton width="35%" height={18} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={48} />
      </View>
    </View>
  );
}
