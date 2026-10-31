import type { AxiosResponse } from "axios";
import type { RevisionValue } from "@/lib/listings";
import type { AdminListing, ListingFieldChange, ListingRevision, ListingType, Page } from "@/services/api/listings";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { EnvelopeSimple, Phone } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminActionButtons, buildAdminCardStyles } from "@/components/listings/admin-listing-card";
import { ListingDetailBody } from "@/components/listings/listing-detail-body";
import { ReasonDialog } from "@/components/listings/reason-dialog";
import { useAdminListingActions } from "@/components/listings/use-admin-listing-actions";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatExpiry } from "@/lib/expiry-date";
import { formatCurrency } from "@/lib/format-currency";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { revisionFieldKey, revisionValue } from "@/lib/listings";
import { adminListingsApi, listingKeys } from "@/services/api/listings";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;
type Styles = ReturnType<typeof buildStyles>;
type RevisionPage = AxiosResponse<{ data: Page<ListingRevision> }>;

const startText = {
  writingDirection: I18nManager.isRTL ? ("rtl" as const) : ("ltr" as const),
  textAlign: I18nManager.isRTL ? ("right" as const) : ("left" as const),
};

function buildStyles(colors: Colors) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: SPACING.md, gap: SPACING.sm },
    sectionTitle: { ...startText, fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: colors.text },
    body: { ...startText, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text },
    muted: { ...startText, fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    reason: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${SEMANTIC.error}55`, backgroundColor: `${SEMANTIC.error}1f`, padding: SPACING.md, gap: SPACING.xs },
    contactRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 44 },
    contactText: { flex: 1, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text, writingDirection: "ltr", textAlign: I18nManager.isRTL ? "right" : "left" },
    actions: { paddingHorizontal: SPACING.base, marginTop: SPACING.md },
    history: { paddingHorizontal: SPACING.base, marginTop: SPACING.xl, gap: SPACING.md },
    revision: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: SPACING.md, gap: SPACING.sm },
    change: { gap: 2 },
    changeField: { ...startText, fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: gold },
    moreBtn: { minHeight: 44, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    moreText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 20, color: colors.text },
    pressed: { opacity: 0.85 },
    skBody: { padding: SPACING.base, gap: SPACING.md },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), cardStyles: buildAdminCardStyles(colors), colors }), [colors]);
}

/** Admin view of one listing: everything the owner sees, contact details, the actions and the edit history. */
export default function AdminListingDetailScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, cardStyles, colors } = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pending, onAction, reasonDialog } = useAdminListingActions();

  const { data: listing, isError, isLoading, refetch } = useQuery({
    queryKey: listingKeys.adminDetail(id ?? ""),
    queryFn: () => adminListingsApi.getById(id!),
    select: res => res.data.data,
    enabled: !!id,
  });

  if (isError && !listing)
    return <DetailErrorScreen onRetry={() => refetch()} />;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("listings.admin_title")} />
      {isLoading || !listing
        ? (
            <View>
              <Skeleton width="100%" height={280} borderRadius={0} />
              <View style={styles.skBody}>
                <Skeleton width="50%" height={28} />
                <Skeleton width="100%" height={56} />
                <Skeleton width="100%" height={96} />
              </View>
            </View>
          )
        : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }} showsVerticalScrollIndicator={false}>
              <ListingDetailBody listing={listing} showStatus>
                {listing.status === "REJECTED" && listing.rejectReason
                  ? (
                      <View style={styles.reason}>
                        <Text style={styles.sectionTitle}>{t("listings.reject_reason")}</Text>
                        <Text style={styles.body}>{listing.rejectReason}</Text>
                      </View>
                    )
                  : null}
                <OwnerCard listing={listing} styles={styles} colors={colors} />
              </ListingDetailBody>
              <View style={styles.actions}>
                <AdminActionButtons listing={listing} pending={pending[listing.id]} onAction={onAction} styles={cardStyles} />
              </View>
              <RevisionHistory listingId={listing.id} type={listing.type} styles={styles} />
            </ScrollView>
          )}
      <ReasonDialog {...reasonDialog} />
    </View>
  );
}

function OwnerCard({ listing, styles, colors }: { listing: AdminListing; styles: Styles; colors: Colors }) {
  const { t } = useTranslation();
  const { owner } = listing;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t("listings.owner")}</Text>
      <Text style={styles.body}>{owner.name}</Text>
      <View style={styles.contactRow}>
        <EnvelopeSimple size={18} color={colors.textMuted} />
        <Text style={styles.contactText} selectable>{owner.email}</Text>
      </View>
      <View style={styles.contactRow}>
        <Phone size={18} color={colors.textMuted} />
        <Text style={styles.contactText} selectable>{listing.contactPhone}</Text>
      </View>
    </View>
  );
}

function RevisionHistory({ listingId, type, styles }: { listingId: string; type: ListingType; styles: Styles }) {
  const { t, i18n } = useTranslation();
  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, refetch }
    = useInfiniteQuery<RevisionPage, Error, { pages: RevisionPage[] }, readonly string[], string | undefined>({
      queryKey: listingKeys.revisions(listingId),
      queryFn: ({ pageParam }) => adminListingsApi.revisions(listingId, { cursor: pageParam, limit: 20 }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
    });
  const revisions = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={styles.history}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{t("listings.history")}</Text>
      {isLoading
        ? <Skeleton width="100%" height={88} borderRadius={RADIUS.lg} />
        : isError && !data
          ? (
              <Pressable style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]} onPress={() => refetch()} accessibilityRole="button">
                <Text style={styles.moreText}>{t("common.retry")}</Text>
              </Pressable>
            )
          : revisions.length === 0
            ? <Text style={styles.muted}>{t("listings.history_empty")}</Text>
            : (
                // Bounded by the page size and inside the detail ScrollView, so a plain map is fine here.
                revisions.map(revision => (
                  <View key={revision.id} style={styles.revision}>
                    <Text style={styles.muted}>
                      {t("listings.revision_meta", { name: revision.editor.name, date: formatExpiry(new Date(revision.createdAt), i18n.language) })}
                    </Text>
                    {revision.changes.map(change => (
                      <ChangeLine key={change.field} change={change} type={type} styles={styles} />
                    ))}
                  </View>
                ))
              )}
      {hasNextPage
        ? (
            <Pressable
              style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
              onPress={() => !isFetchingNextPage && fetchNextPage()}
              disabled={isFetchingNextPage}
              accessibilityRole="button"
            >
              <Text style={styles.moreText}>{isFetchingNextPage ? t("common.loading") : t("common.load_more")}</Text>
            </Pressable>
          )
        : null}
    </View>
  );
}

function ChangeLine({ change, type, styles }: { change: ListingFieldChange; type: ListingType; styles: Styles }) {
  const { t, i18n } = useTranslation();
  const label = t(revisionFieldKey(change.field, type) as any);

  if ("added" in change) {
    return (
      <View style={styles.change}>
        <Text style={styles.changeField}>{label}</Text>
        {change.added.length > 0 || change.removed.length > 0
          ? (
              <Text style={styles.body}>
                {t("listings.photos_changed", {
                  added: formatNumber(change.added.length, i18n.language),
                  removed: formatNumber(change.removed.length, i18n.language),
                })}
              </Text>
            )
          : null}
        {change.reordered ? <Text style={styles.body}>{t("listings.photos_reordered")}</Text> : null}
      </View>
    );
  }

  const show = (value: RevisionValue) => {
    switch (value.kind) {
      case "empty": return t("listings.empty_value");
      case "key": return t(value.key as any);
      case "money": return formatCurrency(value.amount);
      default: return value.text;
    }
  };

  return (
    <View style={styles.change}>
      <Text style={styles.changeField}>{label}</Text>
      <Text style={styles.body}>
        {t("listings.change_value", { from: show(revisionValue(change.field, change.from)), to: show(revisionValue(change.field, change.to)) })}
      </Text>
    </View>
  );
}
