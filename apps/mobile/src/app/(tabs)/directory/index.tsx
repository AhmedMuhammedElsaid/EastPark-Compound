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
import { ShopCard } from "@/components/directory/shop-card";
import { ErrorState } from "@/components/ui/error-state";
import { ShopCardSkeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { shopsApi } from "@/services/api/shops";
import { FONT, RADIUS, SPACING } from "@/theme/tokens";

type Category = ShopCategory | "ALL";

const PAGE_LIMIT = 20;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    searchBar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.full,
      marginHorizontal: SPACING.base,
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
      paddingHorizontal: SPACING.md,
      height: 48,
      gap: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: FONT.sans,
      fontSize: 15,
      color: colors.text,
      height: "100%",
    },
    listPad: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
    listContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
    empty: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingTop: 80,
      gap: SPACING.md,
      paddingHorizontal: SPACING.xl,
    },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
  }), [colors]);
}

export default function DirectoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useStyles();

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<Category>("ALL");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // 300ms debounce for search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
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
      {/* Search bar */}
      <View style={styles.searchBar}>
        <MagnifyingGlass size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("directory.search_placeholder")}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable
            onPress={() => setSearch("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.clear")}
          >
            <X size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Category chips */}
      <CategoryChips selected={category} onSelect={setCategory} />

      {/* Shop list */}
      {isError
        ? <ErrorState onRetry={refetch} />
        : isLoading
          ? (
              <View style={styles.listPad}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <ShopCardSkeleton key={`card-skeleton-${i}`} />
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
                ListEmptyComponent={<EmptyState search={debouncedSearch} />}
                ListFooterComponent={isFetchingNextPage ? <ShopCardSkeleton /> : null}
              />
            )}
    </View>
  );
}

function EmptyState({ search }: { search: string }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <View style={{ alignItems: "center" }}>
        <Storefront size={48} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>
        {search ? t("common.no_results") : t("directory.no_shops")}
      </Text>
      <Text style={styles.emptyBody}>
        {t("directory.no_shops_subtitle")}
      </Text>
    </View>
  );
}
