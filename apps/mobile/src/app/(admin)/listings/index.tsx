import type { AxiosResponse } from "axios";
import type { Href } from "expo-router";
import type { AdminListing, ListingStats, ListingStatus, Page } from "@/services/api/listings";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { MagnifyingGlass, Tray } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminListingCard, buildAdminCardStyles } from "@/components/listings/admin-listing-card";
import { ReasonDialog } from "@/components/listings/reason-dialog";
import { useAdminListingActions } from "@/components/listings/use-admin-listing-actions";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { adminListingsApi, listingKeys } from "@/services/api/listings";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

// Review queue first; closed states last.
const FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL", "SOLD", "RENTED", "WITHDRAWN", "EXPIRED"] as const;
type Filter = (typeof FILTERS)[number];
type AdminPage = AxiosResponse<{ data: Page<AdminListing> }>;
const SKELETON_KEYS = ["al-sk-1", "al-sk-2", "al-sk-3"];
const SEARCH_DEBOUNCE_MS = 350;

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    filterBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
    filterBarContent: { flexDirection: "row", paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, gap: SPACING.sm },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: SPACING.base, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    chipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "500" },
    chipTextActive: { color: BRAND.ink, fontWeight: "700" },
    searchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginHorizontal: SPACING.base, marginTop: SPACING.md, paddingHorizontal: SPACING.md, minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    searchInput: { flex: 1, fontFamily: FONT.sans, fontSize: 14, color: colors.text, paddingVertical: SPACING.sm },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    empty: { alignItems: "center", paddingTop: 64, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: "center" },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), cardStyles: buildAdminCardStyles(colors), colors }), [colors]);
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(setDebounced, ms, value);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function filterCount(stats: ListingStats | undefined, filter: Filter): number | undefined {
  if (!stats)
    return undefined;
  return filter === "ALL" ? stats.total : stats[filter];
}

function FilterBar({ filter, onSelect, stats, styles }: {
  filter: Filter;
  onSelect: (filter: Filter) => void;
  stats?: ListingStats;
  styles: ReturnType<typeof buildStyles>;
}) {
  const { t, i18n } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
      {FILTERS.map((key) => {
        const active = filter === key;
        const count = filterCount(stats, key);
        const label = t(`listings.status_${key}`);
        return (
          <Pressable
            key={key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {count === undefined ? label : `${label} · ${formatNumber(count, i18n.language)}`}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Admin review queue: status chips with counts, server search, approve / reject / take down. */
export default function AdminListingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, cardStyles, colors } = useStyles();
  const [filter, setFilter] = React.useState<Filter>("PENDING");
  const [query, setQuery] = React.useState("");
  const q = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const status: ListingStatus | undefined = filter === "ALL" ? undefined : filter;
  const { pending, onAction, reasonDialog } = useAdminListingActions();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, isRefetching, refetch }
    = useInfiniteQuery<AdminPage, Error, { pages: AdminPage[] }, readonly string[], string | undefined>({
      queryKey: listingKeys.admin(status, q),
      queryFn: ({ pageParam }) => adminListingsApi.list({ status, q: q || undefined, cursor: pageParam, limit: 20 }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
    });
  const { data: stats } = useQuery({
    queryKey: listingKeys.adminStats(),
    queryFn: adminListingsApi.stats,
    select: res => res.data.data,
  });

  const listings = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("listings.admin_title")} />
      <FilterBar filter={filter} onSelect={setFilter} stats={stats} styles={styles} />
      <View style={styles.searchRow}>
        <MagnifyingGlass size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t("listings.admin_search")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t("listings.admin_search")}
        />
      </View>

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.loadingPad}>
                {SKELETON_KEYS.map(key => (
                  <Skeleton key={key} width="100%" height={160} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.md }} />
                ))}
              </View>
            )
          : (
              <FlashList
                data={listings}
                keyExtractor={item => item.id}
                extraData={pending}
                renderItem={({ item }) => (
                  <AdminListingCard
                    listing={item}
                    pending={pending[item.id]}
                    onPress={() => router.push(`/(admin)/listings/${item.id}` as Href)}
                    onAction={onAction}
                    styles={cardStyles}
                    colors={colors}
                  />
                )}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ ...styles.listContent, paddingBottom: insets.bottom + SPACING.xl }}
                onRefresh={refetch}
                refreshing={isRefetching && !isFetchingNextPage}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}><Tray size={36} color={gold} /></View>
                    <Text style={styles.emptyText}>{t("listings.admin_empty")}</Text>
                  </View>
                )}
                ListFooterComponent={isFetchingNextPage ? <Skeleton width="100%" height={160} borderRadius={RADIUS.lg} /> : null}
              />
            )}
      <ReasonDialog {...reasonDialog} />
    </View>
  );
}
