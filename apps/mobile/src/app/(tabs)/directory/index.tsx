import type { AxiosResponse } from "axios";
import type { CursorPage, Shop, ShopCategory } from "@/services/api/shops";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MagnifyingGlass, Storefront, X } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryChips } from "@/components/directory/category-chips";
import { ShopCard, ShopCardSkeleton } from "@/components/directory/shop-card";
import { AppHeader } from "@/components/ui/app-header";
import { ErrorState } from "@/components/ui/error-state";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { shopsApi } from "@/services/api/shops";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type Category = ShopCategory | "ALL";

const PAGE_LIMIT = 20;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    titleBlock: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36, color: colors.text },
    searchBar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      marginHorizontal: SPACING.base,
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
      paddingStart: SPACING.base,
      paddingEnd: SPACING.xs,
      minHeight: 48,
      gap: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: FONT.sans,
      fontSize: 15,
      color: colors.text,
      paddingVertical: SPACING.sm,
    },
    clearBtn: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.full,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    pressed: { opacity: 0.7 },
    listPad: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
    // Inside (tabs): the tab bar already clears the system navigation — fixed padding only.
    listContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm, paddingBottom: SPACING["2xl"] },
    empty: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingTop: 64,
      gap: SPACING.md,
      paddingHorizontal: SPACING.xl,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: RADIUS.full,
      backgroundColor: `${BRAND.gold}1f`,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    clearFilters: {
      minHeight: 44,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    clearFiltersText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 21 },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
  }), [colors]);
}

export default function DirectoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<Category>("ALL");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // 300ms debounce for search
  React.useEffect(() => {
    const timer = setTimeout(setDebouncedSearch, 300, search);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isLoading, isRefetching, refetch }
    = useInfiniteQuery<
      AxiosResponse<{ data: CursorPage<Shop> }>,
      Error,
      { pages: AxiosResponse<{ data: CursorPage<Shop> }>[] },
      string[],
      string | undefined
    >({
      queryKey: ["shops", category, debouncedSearch],
      queryFn: ({ pageParam }) =>
        shopsApi.getShops({
          cursor: pageParam,
          limit: PAGE_LIMIT,
          category: category === "ALL" ? undefined : category,
          search: debouncedSearch || undefined,
        }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
    });

  const shops = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">{t("directory.title")}</Text>
      </View>

      <SearchBar value={search} onChange={setSearch} />

      {/* Category chips */}
      <CategoryChips selected={category} onSelect={setCategory} />

      {/* Shop list */}
      {isError && !data
        ? <ErrorState onRetry={refetch} />
        : isLoading
          ? (
              <View style={styles.listPad}>
                {["a", "b", "c", "d"].map(k => (
                  <ShopCardSkeleton key={`card-skeleton-${k}`} />
                ))}
              </View>
            )
          : (
              <FlashList
                data={shops}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ShopCard shop={item} />}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.listContent}
                onRefresh={refetch}
                refreshing={isRefetching}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={(
                  <EmptyState
                    filtered={!!debouncedSearch || category !== "ALL"}
                    onClear={() => {
                      setSearch("");
                      setCategory("ALL");
                    }}
                  />
                )}
                ListFooterComponent={isFetchingNextPage ? <ShopCardSkeleton /> : null}
              />
            )}
    </View>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.searchBar}>
      <MagnifyingGlass size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t("directory.search_placeholder")}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={t("directory.search_placeholder")}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange("")}
          hitSlop={4}
          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("common.clear")}
        >
          <X size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Storefront size={32} color={gold} />
      </View>
      <Text style={styles.emptyTitle}>
        {filtered ? t("common.no_results") : t("directory.no_shops")}
      </Text>
      {filtered && (
        <>
          <Text style={styles.emptyBody}>{t("directory.no_shops_subtitle")}</Text>
          <Pressable
            onPress={onClear}
            style={({ pressed }) => [styles.clearFilters, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.clearFiltersText, { color: gold }]}>{t("common.clear")}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
