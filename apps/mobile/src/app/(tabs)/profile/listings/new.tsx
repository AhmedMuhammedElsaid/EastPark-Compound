import type { ListingFormInput } from "@/lib/listings";
import { Redirect } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ListingForm } from "@/components/listings/listing-form";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useRefreshProfileUnits } from "@/lib/hooks/use-profile-units";
import { EMPTY_LISTING_FORM } from "@/lib/listings";
import { canOwnListings } from "@/lib/listings-access";
import { getListingFlatOptions } from "@/lib/units";
import { useAppSelector } from "@/store";

/** "List my flat". The flat is picked from the account's own flats (the primary one is preselected); phone is prefilled and editable. */
export default function NewListingScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const user = useAppSelector(s => s.auth.user);
  useRefreshProfileUnits();

  // Read once (lazy state): a later profile refresh must not reset what the user typed.
  const [initialValues] = React.useState<ListingFormInput>(() => {
    const unit = getListingFlatOptions(user)[0];
    return {
      ...EMPTY_LISTING_FORM,
      building: unit?.building ?? "",
      floor: unit?.floor ?? "",
      flatNumber: unit?.flatNumber ?? "",
      contactPhone: user?.phone ?? "",
    };
  });

  if (!canOwnListings(user?.role))
    return <Redirect href="/(tabs)/profile" />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title={t("listings.new_title")} />
      <ListingForm initialValues={initialValues} initialPhotos={[]} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
