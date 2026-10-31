import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";

import { ListingDetailBody } from "@/components/listings/listing-detail-body";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { listingKeys, listingsApi } from "@/services/api/listings";
import { useAppSelector } from "@/store";
import { SPACING } from "@/theme/tokens";

export default function FlatDetailScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAppSelector(s => s.auth.user?.id);

  const { data: listing, isError, isLoading, refetch } = useQuery({
    queryKey: listingKeys.detail(id ?? ""),
    queryFn: () => listingsApi.getById(id!),
    select: res => res.data.data,
    enabled: !!id,
  });

  if (isError && !listing)
    return <DetailErrorScreen onRetry={() => refetch()} />;

  const isOwn = !!listing && listing.owner.id === userId;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={t("listings.title")} />
      {isLoading || !listing
        ? <DetailSkeleton />
        : (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              {/* The owner reaches their own listing from the feed too — no point calling yourself. */}
              <ListingDetailBody listing={listing} showContact={!isOwn} showStatus={isOwn} />
            </ScrollView>
          )}
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View>
      <Skeleton width="100%" height={280} borderRadius={0} />
      <View style={styles.skBody}>
        <Skeleton width="50%" height={28} />
        <Skeleton width="35%" height={18} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={96} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Inside (tabs): the tab bar already clears the system navigation.
  scroll: { paddingBottom: SPACING["2xl"] },
  skBody: { padding: SPACING.base, gap: SPACING.md },
});
