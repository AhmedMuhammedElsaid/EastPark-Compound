import type { AxiosResponse } from "axios";
import type { Href } from "expo-router";
import type { MyListing, Page } from "@/services/api/listings";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Buildings } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { GoldButton } from "@/components/auth/gold-button";
import { ListingCard, ListingCardSkeleton } from "@/components/listings/listing-card";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useRefreshProfileUnits } from "@/lib/hooks/use-profile-units";
import { getListingFlatOptions } from "@/lib/units";
import { listingKeys, listingsApi } from "@/services/api/listings";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type MinePage = AxiosResponse<{ data: Page<MyListing> }>;
const PAGE_LIMIT = 20;
const NEW_HREF = "/(tabs)/profile/listings/new" as Href;

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    listPad: { padding: SPACING.base },
    // Inside (tabs): the tab bar already clears the system navigation.
    listContent: { padding: SPACING.base, paddingBottom: SPACING["2xl"] },
    header: { marginBottom: SPACING.md },
    empty: { alignItems: "center", paddingTop: 48, gap: SPACING.md, paddingHorizontal: SPACING.lg },
    emptyIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 27, color: colors.text, textAlign: "center" },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" },
    emptyCta: { alignSelf: "stretch", marginTop: SPACING.sm },
    noFlat: { gap: SPACING.xs, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    noFlatTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: colors.text, textAlign: "center" },
    noFlatBody: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "center" },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

/** The resident's own listings in every status, newest first, plus "List my flat". */
export default function MyListingsScreen() {
  const { t } = useTranslation();
  const { styles, colors } = useStyles();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const user = useAppSelector(s => s.auth.user);
  useRefreshProfileUnits();
  // Only flats on the account can be listed (backend 400 `unitNotOwned`).
  const canList = getListingFlatOptions(user).length > 0;
  const newAction = canList
    ? <GoldButton label={t("listings.list_my_flat")} onPress={() => router.push(NEW_HREF)} />
    : (
        <View style={styles.noFlat} accessibilityRole="alert">
          <Text style={styles.noFlatTitle}>{t("listings.no_flat_title")}</Text>
          <Text style={styles.noFlatBody}>{t("listings.no_flat_body")}</Text>
        </View>
      );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isLoading, isRefetching, refetch }
    = useInfiniteQuery<MinePage, Error, { pages: MinePage[] }, readonly string[], string | undefined>({
      queryKey: listingKeys.mine(),
      queryFn: ({ pageParam }) => listingsApi.mine({ cursor: pageParam, limit: PAGE_LIMIT }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
    });

  const listings = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("listings.my_listings")} />
      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.listPad}>
                {["a", "b"].map(k => <ListingCardSkeleton key={`mine-sk-${k}`} />)}
              </View>
            )
          : (
              <FlashList
                data={listings}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <ListingCard
                    listing={item}
                    showStatus
                    onPress={() => router.push(`/(tabs)/profile/listings/${item.id}` as Href)}
                  />
                )}
                ListHeaderComponent={listings.length > 0
                  ? (
                      <View style={styles.header}>{newAction}</View>
                    )
                  : null}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}><Buildings size={32} color={gold} /></View>
                    <Text style={styles.emptyTitle}>{t("listings.my_empty")}</Text>
                    <Text style={styles.emptyBody}>{t("listings.my_empty_subtitle")}</Text>
                    <View style={styles.emptyCta}>{newAction}</View>
                  </View>
                )}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                onRefresh={refetch}
                refreshing={isRefetching && !isFetchingNextPage}
                contentContainerStyle={styles.listContent}
                ListFooterComponent={isFetchingNextPage ? <ListingCardSkeleton /> : null}
              />
            )}
    </View>
  );
}
