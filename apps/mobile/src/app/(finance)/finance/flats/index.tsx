import type { Href } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams } from "expo-router";
import { Buildings, MagnifyingGlass, X } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FinanceFlatRow, FinanceFlatRowSkeleton } from "@/components/finance/finance-ui";
import { useDebounced } from "@/components/finance/use-debounced";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { normalizeFlatQuery } from "@/lib/finance";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useFinanceFlats } from "@/services/api/finance";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type Filter = "ALL" | "OWES" | "OVERDUE";
const FILTERS: readonly Filter[] = ["ALL", "OWES", "OVERDUE"];
const SEARCH_DEBOUNCE_MS = 300;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Expo Router gives string | string[]: the first value, or undefined. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Drilldown parameters from the dashboard (`building`, `hasBalance`, `overdueDays`, `sort`, `asOf`), validated. */
function readRoute(params: Record<string, string | string[] | undefined>) {
  const overdue = Number(first(params.overdueDays));
  const asOf = first(params.asOf);
  return {
    building: first(params.building)?.trim().toUpperCase().slice(0, 20) || undefined,
    hasBalance: first(params.hasBalance) === "true",
    overdueDays: Number.isInteger(overdue) && overdue > 0 ? overdue : undefined,
    sort: first(params.sort) === "balance" ? ("balance" as const) : undefined,
    asOf: asOf && DATE_ONLY.test(asOf) ? asOf : undefined,
  };
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({
    colors,
    styles: StyleSheet.create({
      container: { flex: 1, backgroundColor: colors.bg },
      searchWrap: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md },
      search: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        minHeight: 48,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      },
      searchFocused: { borderColor: BRAND.gold },
      searchInput: { flex: 1, fontFamily: FONT.sans, fontSize: 16, lineHeight: 24, color: colors.text, paddingVertical: SPACING.sm, textAlign: "left" },
      filterBar: { flexGrow: 0 },
      filterBarContent: { flexDirection: "row", paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
      chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: SPACING.base, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
      chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
      chipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "600" },
      chipTextActive: { color: BRAND.ink, fontWeight: "700" },
      pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
      buildingChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: SPACING.xs, minHeight: 48, marginHorizontal: SPACING.base, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full, borderWidth: 1, borderColor: BRAND.gold, backgroundColor: `${BRAND.gold}1f` },
      buildingChipText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
      listPad: { paddingHorizontal: SPACING.base },
      empty: { alignItems: "center", paddingTop: 64, gap: SPACING.md, paddingHorizontal: SPACING.xl },
      emptyIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
      emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text, textAlign: "center" },
    }),
  }), [colors]);
}

/** The building filter set by a dashboard drilldown; tap to remove it. */
function BuildingChip({ code, onClear }: { code: string; onClear: () => void }) {
  const { t } = useTranslation();
  const { styles, colors } = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.buildingChip, pressed && styles.pressed]}
      onPress={onClear}
      accessibilityRole="button"
      accessibilityLabel={t("finance.dash.clear_building", { code })}
      testID="building-chip"
    >
      <Text style={styles.buildingChipText}>{t("finance.dash.building_chip", { code })}</Text>
      <X size={16} color={colors.text} />
    </Pressable>
  );
}

/** Finance flat search (`/finance/flats`): label search, owes / overdue filters, tap for the ledger. */
export default function FinanceFlatsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useStyles();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const route = readRoute(useLocalSearchParams());
  // The dashboard's drilldown pre-selects the chip and the building; the user can still change both.
  const initialFilter: Filter = route.overdueDays ? "OVERDUE" : route.hasBalance ? "OWES" : "ALL";
  const [filter, setFilter] = React.useState<Filter>(initialFilter);
  const [building, setBuilding] = React.useState<string | undefined>(route.building);
  const q = useDebounced(normalizeFlatQuery(query), SEARCH_DEBOUNCE_MS);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isLoading, isRefetching, refetch } = useFinanceFlats({
    q: q || undefined,
    building,
    hasBalance: filter === "OWES" || (filter === initialFilter && route.hasBalance) ? true : undefined,
    overdueDays: filter === "OVERDUE" ? (filter === initialFilter && route.overdueDays ? route.overdueDays : 1) : undefined,
    sort: route.sort,
    asOf: route.asOf,
  });
  const flats = data?.pages.flatMap(p => p.data.data.items) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("finance.flats_title")} />

      <View style={styles.searchWrap}>
        <View style={[styles.search, focused && styles.searchFocused]}>
          <MagnifyingGlass size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t("finance.search_placeholder")}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={20}
            style={styles.searchInput}
            accessibilityLabel={t("finance.search_label")}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
        {FILTERS.map((key) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              onPress={() => setFilter(key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`finance.filter_${key.toLowerCase()}`)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {building ? <BuildingChip code={building} onClear={() => setBuilding(undefined)} /> : null}

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.listPad}>
                {["a", "b", "c", "d"].map(k => <FinanceFlatRowSkeleton key={`flat-sk-${k}`} />)}
              </View>
            )
          : (
              <FlashList
                data={flats}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <FinanceFlatRow flat={item} onPress={() => router.push(`/finance/flats/${encodeURIComponent(item.id)}` as Href)} />
                )}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ ...styles.listPad, paddingBottom: insets.bottom + SPACING.xl }}
                onRefresh={refetch}
                refreshing={isRefetching && !isFetchingNextPage}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}><Buildings size={32} color={gold} /></View>
                    <Text style={styles.emptyTitle}>{t("finance.no_flats")}</Text>
                  </View>
                )}
                ListFooterComponent={isFetchingNextPage ? <FinanceFlatRowSkeleton /> : null}
              />
            )}
    </View>
  );
}
