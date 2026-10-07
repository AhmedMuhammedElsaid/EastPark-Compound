import type { AxiosResponse } from "axios";
import type { LeadStats, LeadStatus, ResidentLead } from "@/services/api/admin";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { MagnifyingGlass, Tray } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LeadCard } from "@/components/admin/lead-card";
import { buildLeadCardStyles } from "@/components/admin/lead-card-styles";
import { LEAD_STATS_QUERY_KEY, LEADS_QUERY_ROOT, useLeadActions } from "@/components/admin/use-lead-actions";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { leadMatches } from "@/lib/resident-leads";
import { adminApi } from "@/services/api/admin";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

const FILTERS = ["ALL", "PENDING", "INVITED", "CONVERTED", "REJECTED"] as const;
type Filter = (typeof FILTERS)[number];
const SKELETON_KEYS = ["lead-sk-1", "lead-sk-2", "lead-sk-3", "lead-sk-4"];
type LeadPageResponse = AxiosResponse<{ data: { items: ResidentLead[]; nextCursor: string | null } }>;

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
    hint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginHorizontal: SPACING.base, marginTop: SPACING.xs },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    empty: { alignItems: "center", paddingTop: 64, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: "center" },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), cardStyles: buildLeadCardStyles(colors), colors }), [colors]);
}

function useLeads(filter: Filter) {
  return useInfiniteQuery<LeadPageResponse, Error, { pages: LeadPageResponse[] }, string[], string | undefined>({
    queryKey: [LEADS_QUERY_ROOT, filter],
    queryFn: ({ pageParam }) => adminApi.getLeads({ cursor: pageParam, limit: 50, status: filter === "ALL" ? undefined : filter }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
  });
}

function filterCount(stats: LeadStats | undefined, filter: Filter): number | undefined {
  if (!stats)
    return undefined;
  return filter === "ALL" ? stats.total : stats[filter as LeadStatus];
}

type FilterBarProps = { filter: Filter; onSelect: (filter: Filter) => void; stats?: LeadStats };

function FilterBar({ filter, onSelect, stats, styles }: FilterBarProps & { styles: ReturnType<typeof buildStyles> }) {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
      {FILTERS.map((key) => {
        const active = filter === key;
        const count = filterCount(stats, key);
        const label = t(`admin_leads.status_${key.toLowerCase() as "all"}`);
        return (
          <Pressable
            key={key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{count === undefined ? label : `${label} · ${count}`}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function ResidentRequestsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, cardStyles, colors } = useStyles();
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [query, setQuery] = React.useState("");
  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, refetch } = useLeads(filter);
  const { data: stats } = useQuery({ queryKey: LEAD_STATS_QUERY_KEY, queryFn: adminApi.getLeadStats, select: res => res.data.data });
  const { pending, onAction } = useLeadActions();

  const leads = (data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? []).filter(lead => leadMatches(lead, query));
  const ui = React.useMemo(() => ({ styles: cardStyles, colors, onAction }), [cardStyles, colors, onAction]);
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("admin_leads.title")} />
      <FilterBar filter={filter} onSelect={setFilter} stats={stats} styles={styles} />
      <View style={styles.searchRow}>
        <MagnifyingGlass size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t("admin_leads.search_placeholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t("admin_leads.search_placeholder")}
        />
      </View>
      {query.trim() ? <Text style={styles.hint}>{t("admin_leads.search_hint")}</Text> : null}

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.loadingPad}>
                {SKELETON_KEYS.map(key => (
                  <Skeleton key={key} width="100%" height={150} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.md }} />
                ))}
              </View>
            )
          : (
              <FlashList
                data={leads}
                keyExtractor={item => item.id}
                extraData={pending}
                renderItem={({ item }) => <LeadCard lead={item} pending={pending[item.id]} ui={ui} />}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ ...styles.listContent, paddingBottom: insets.bottom + SPACING.xl }}
                onRefresh={refetch}
                refreshing={false}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}><Tray size={36} color={gold} /></View>
                    <Text style={styles.emptyText}>{t(query.trim() ? "admin_leads.no_matches" : "admin_leads.empty")}</Text>
                  </View>
                )}
                ListFooterComponent={isFetchingNextPage ? <Skeleton width="100%" height={150} borderRadius={RADIUS.lg} /> : null}
              />
            )}
    </View>
  );
}
