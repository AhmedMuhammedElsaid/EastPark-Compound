import type { ListingFormInput } from "@/lib/listings";
import { Redirect } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ListingForm } from "@/components/listings/listing-form";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { EMPTY_LISTING_FORM } from "@/lib/listings";
import { canOwnListings } from "@/lib/listings-access";
import { useAppSelector } from "@/store";

/** "List my flat". Prefilled from the resident's first flat and profile phone; both stay editable. */
export default function NewListingScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const user = useAppSelector(s => s.auth.user);

  // Read once (lazy state): a later profile refresh must not reset what the user typed.
  const [initialValues] = React.useState<ListingFormInput>(() => {
    const unit = user?.units?.[0];
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
