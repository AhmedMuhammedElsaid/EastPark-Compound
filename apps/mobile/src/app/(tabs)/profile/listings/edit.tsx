import type { MyListing } from "@/services/api/listings";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ListingForm } from "@/components/listings/listing-form";
import { DetailErrorScreen, ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { listingToForm, ownerActions } from "@/lib/listings";
import { listingKeys, listingsApi } from "@/services/api/listings";
import { useAppSelector } from "@/store";
import { RADIUS, SPACING } from "@/theme/tokens";

/** Edit (`PATCH /listings/:id`, full body). Saving sends the listing back to PENDING. */
export default function EditListingScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAppSelector(s => s.auth.user?.id);

  const { data: listing, isError, refetch } = useQuery({
    queryKey: listingKeys.detail(id ?? ""),
    queryFn: () => listingsApi.getById(id!),
    select: res => res.data.data,
    enabled: !!id,
    // The form's defaults are the loaded listing: no background refetch mid-edit.
    staleTime: Infinity,
  });

  if (isError && !listing)
    return <DetailErrorScreen onRetry={() => refetch()} />;

  const editable = !!listing && listing.owner.id === userId && "rejectReason" in listing && ownerActions(listing.status).edit;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={t("listings.edit_title")} />
      {!listing
        ? (
            <View style={styles.skeleton}>
              <Skeleton width="100%" height={48} borderRadius={RADIUS.full} />
              <Skeleton width="100%" height={72} />
              <Skeleton width="100%" height={72} />
              <Skeleton width="100%" height={140} />
            </View>
          )
        : editable
          ? (
              <ListingForm
                key={listing.id}
                listingId={listing.id}
                initialValues={listingToForm(listing as MyListing)}
                initialPhotos={listing.photos.map(uri => ({ uri, mime: null }))}
              />
            )
          : <ErrorState message={t("listings.error_invalid_status")} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeleton: { padding: SPACING.base, gap: SPACING.lg },
});
