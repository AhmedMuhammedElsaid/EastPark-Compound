import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookmarkSimple } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { ShopCard, ShopCardSkeleton } from "@/components/directory/shop-card";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { shopsApi } from "@/services/api/shops";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

const PAGE_LIMIT = 20;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    listPad: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md },
    listContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING["2xl"] },
    empty: { alignItems: "center" as const, paddingTop: 64, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: RADIUS.full,
      backgroundColor: `${BRAND.gold}1f`,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
  }), [colors]);
}

/** The resident's bookmarked shops (GET /users/me/saved-shops), opened from Profile. */
export default function SavedShopsScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isLoading, isRefetching, refetch }
    = useInfiniteQuery({
      queryKey: ["saved-shops"],
      queryFn: ({ pageParam }) => shopsApi.getSavedShops({ cursor: pageParam, limit: PAGE_LIMIT }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
    });

  const shops = data?.pages.flatMap(p => p.data.data.items).map(item => item.shop).filter(Boolean) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("profile.saved_shops")} />
      {isError && !data
        ? <ErrorState onRetry={refetch} />
        : isLoading
          ? (
              <View style={styles.listPad}>
                {["a", "b", "c"].map(k => <ShopCardSkeleton key={`saved-skeleton-${k}`} />)}
              </View>
            )
          : (
              <FlashList
                data={shops}
                keyExtractor={item => item.id}
                // Opens the shop in the Profile stack so Back returns here.
                renderItem={({ item }) => <ShopCard shop={item} href={`/(tabs)/profile/shop/${item.id}`} />}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.listContent}
                onRefresh={refetch}
                refreshing={isRefetching}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                      <BookmarkSimple size={32} color={gold} />
                    </View>
                    <Text style={styles.emptyTitle}>{t("profile.saved_shops_empty")}</Text>
                    <Text style={styles.emptyBody}>{t("profile.saved_shops_empty_subtitle")}</Text>
                  </View>
                )}
                ListFooterComponent={isFetchingNextPage ? <ShopCardSkeleton /> : null}
              />
            )}
    </View>
  );
}
