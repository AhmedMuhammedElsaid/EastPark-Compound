import type { AxiosResponse } from "axios";
import type { Href } from "expo-router";
import type { Listing, ListingType, Page } from "@/services/api/listings";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Buildings, Plus } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingCard, ListingCardSkeleton } from "@/components/listings/listing-card";
import { AppHeader } from "@/components/ui/app-header";
import { ErrorState } from "@/components/ui/error-state";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { listingKeys, listingsApi } from "@/services/api/listings";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type Filter = ListingType | "ALL";
const FILTERS: readonly Filter[] = ["ALL", "SALE", "RENT"];
const PAGE_LIMIT = 20;
type ListingPage = AxiosResponse<{ data: Page<Listing> }>;

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    titleBlock: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, gap: SPACING.xs },
    titleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    title: { flex: 1, fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36, color: colors.text },
    subtitle: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    listBtn: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      backgroundColor: BRAND.gold,
    },
    listBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 13, lineHeight: 20, color: BRAND.ink },
    filterBar: { flexGrow: 0 },
    filterBarContent: { flexDirection: "row", paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
    chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: SPACING.base, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    chipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "600" },
    chipTextActive: { color: BRAND.ink, fontWeight: "700" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    listPad: { paddingHorizontal: SPACING.base },
    // Inside (tabs): the tab bar already clears the system navigation — fixed padding only.
    listContent: { paddingHorizontal: SPACING.base, paddingBottom: SPACING["2xl"] },
    empty: { alignItems: "center", paddingTop: 64, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text, textAlign: "center" },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

export default function FlatsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useStyles();
  const role = useAppSelector(s => s.auth.user?.role);
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const type = filter === "ALL" ? undefined : filter;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isLoading, isRefetching, refetch }
    = useInfiniteQuery<ListingPage, Error, { pages: ListingPage[] }, readonly string[], string | undefined>({
      queryKey: listingKeys.browse(type),
      queryFn: ({ pageParam }) => listingsApi.browse({ type, cursor: pageParam, limit: PAGE_LIMIT }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
    });

  const listings = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">{t("listings.title")}</Text>
          {/* Only residents list flats; admins browse and review. */}
          {role === "RESIDENT" && (
            <Pressable
              style={({ pressed }) => [styles.listBtn, pressed && styles.pressed]}
              onPress={() => router.push("/(tabs)/profile/listings" as Href)}
              accessibilityRole="button"
              accessibilityLabel={t("listings.my_listings")}
            >
              <Plus size={16} color={BRAND.ink} weight="bold" />
              <Text style={styles.listBtnText}>{t("listings.list_my_flat")}</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>{t("listings.subtitle")}</Text>
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(key === "ALL" ? "listings.filter_all" : `listings.type_${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.listPad}>
                {["a", "b", "c"].map(k => <ListingCardSkeleton key={`listing-sk-${k}`} />)}
              </View>
            )
          : (
              <FlashList
                data={listings}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <ListingCard listing={item} onPress={() => router.push(`/(tabs)/flats/${item.id}` as Href)} />
                )}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.listContent}
                onRefresh={refetch}
                refreshing={isRefetching && !isFetchingNextPage}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}><Buildings size={32} color={gold} /></View>
                    <Text style={styles.emptyTitle}>{t(filter === "ALL" ? "listings.empty" : "listings.empty_filtered")}</Text>
                    {filter === "ALL" ? <Text style={styles.emptyBody}>{t("listings.empty_subtitle")}</Text> : null}
                  </View>
                )}
                ListFooterComponent={isFetchingNextPage ? <ListingCardSkeleton /> : null}
              />
            )}
    </View>
  );
}
