import type { Href } from "expo-router";
import type { Control } from "react-hook-form";
import type { ListingFormInput, ListingFormOutput, ListingPhoto } from "@/lib/listings";
import type { ListingType } from "@/services/api/listings";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { GoldButton } from "@/components/auth/gold-button";
import { FlatPicker } from "@/components/listings/flat-picker";
import { ListingPhotoField } from "@/components/listings/listing-photo-field";
import { uploadErrorKey } from "@/lib/feedback-attachments";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useDiscardGuard } from "@/lib/hooks/use-discard-guard";
import {
  buildListingPayload,
  LISTING_DESCRIPTION_MAX,
  listingErrorKey,
  listingFormSchema,
  listingPhotoParams,
  ListingUploadError,
  resolvePhotoUrls,
} from "@/lib/listings";
import { getListingFlatOptions } from "@/lib/units";
import { listingKeys, listingsApi } from "@/services/api/listings";
import { uploadsApi } from "@/services/api/uploads";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;
type Styles = ReturnType<typeof buildStyles>;
type FormControl = Control<ListingFormInput, unknown, ListingFormOutput>;

const TYPES: ListingType[] = ["SALE", "RENT"];

const startText = {
  writingDirection: I18nManager.isRTL ? ("rtl" as const) : ("ltr" as const),
  textAlign: I18nManager.isRTL ? ("right" as const) : ("left" as const),
};

function buildStyles(colors: Colors) {
  return StyleSheet.create({
    // Inside (tabs): the tab bar already clears the system navigation.
    scroll: { padding: SPACING.base, gap: SPACING.lg, paddingBottom: SPACING["2xl"] },
    field: { gap: SPACING.xs, flex: 1 },
    row: { flexDirection: "row", gap: SPACING.sm },
    label: { ...startText, fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    hint: { ...startText, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    input: {
      ...startText,
      minHeight: 48,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONT.sans,
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    // Phone numbers and flat codes read left to right in both languages.
    inputLtr: { writingDirection: "ltr" },
    textarea: { minHeight: 140, textAlignVertical: "top" },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { ...startText, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error },
    chips: { flexDirection: "row", gap: SPACING.sm },
    chip: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    chipText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.textMuted },
    chipTextActive: { color: BRAND.ink, fontWeight: "700" },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.base,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    switchText: { flex: 1, gap: 2 },
    note: {
      ...startText,
      fontFamily: FONT.sans,
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: `${SEMANTIC.warning}1f`,
      borderWidth: 1,
      borderColor: `${SEMANTIC.warning}55`,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}

type Props = {
  /** Present when editing: PATCH (full replacement) instead of POST. */
  listingId?: string;
  initialValues: ListingFormInput;
  initialPhotos: ListingPhoto[];
};

/** Photos state plus the save mutation: upload local photos (purpose `listing`), then POST or PATCH. */
function useListingSave(listingId: string | undefined, initialPhotos: ListingPhoto[]) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const allowLeaveRef = React.useRef(false);
  const [photos, setPhotos] = React.useState<ListingPhoto[]>(initialPhotos);
  const [uploading, setUploading] = React.useState(false);
  const isEdit = !!listingId;

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: ListingFormOutput) => {
      setUploading(true);
      let urls: string[];
      try {
        urls = await resolvePhotoUrls(photos, (uri, mime) => uploadsApi.uploadImage(uri, mime, "listing"));
      }
      finally {
        setUploading(false);
      }
      // Stored from here on: a failed save followed by a retry does not upload them again.
      setPhotos(urls.map(uri => ({ uri, mime: null })));
      const body = buildListingPayload(values, urls);
      return (await (listingId ? listingsApi.update(listingId, body) : listingsApi.create(body))).data.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.all });
      showMessage({ message: t(isEdit ? "listings.toast_updated" : "listings.toast_created"), type: "success", backgroundColor: SEMANTIC.success });
      allowLeaveRef.current = true;
      if (isEdit)
        router.back();
      else
        router.replace(`/(tabs)/profile/listings/${saved.id}` as Href);
    },
    onError: (error) => {
      const message = error instanceof ListingUploadError
        ? t(uploadErrorKey(error.original) as any, listingPhotoParams(i18n.language))
        : t(listingErrorKey(error) as any);
      showMessage({ message, type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  return { photos, setPhotos, uploading, mutate, isPending, allowLeaveRef };
}

/** Create / edit form. Photos upload first (purpose `listing`), then the listing is saved. */
export function ListingForm({ listingId, initialValues, initialPhotos }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  const [photoError, setPhotoError] = React.useState<string | undefined>();
  const { photos, setPhotos, uploading, mutate, isPending, allowLeaveRef } = useListingSave(listingId, initialPhotos);
  const isEdit = !!listingId;
  const user = useAppSelector(s => s.auth.user);
  const flats = React.useMemo(() => getListingFlatOptions(user), [user]);
  const noFlats = !isEdit && flats.length === 0;

  const { control, setValue, handleSubmit, watch, formState: { errors, isDirty } } = useForm<ListingFormInput, unknown, ListingFormOutput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: initialValues,
  });
  const type = watch("type");
  const photosChanged = photos.map(p => p.uri).join("|") !== initialPhotos.map(p => p.uri).join("|");
  useDiscardGuard(isDirty || photosChanged, allowLeaveRef);

  const submit = handleSubmit((values) => {
    if (noFlats)
      return;
    if (photos.length === 0) {
      setPhotoError(t("listings.error_photos"));
      return;
    }
    mutate(values);
  }, () => {
    if (photos.length === 0)
      setPhotoError(t("listings.error_photos"));
  });

  const errorOf = (name: keyof ListingFormInput) => {
    const message = errors[name]?.message;
    return message ? t(message as any) : undefined;
  };
  const fieldProps = { control, styles, colors };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.scroll}
    >
      <TypeField control={control} styles={styles} />

      {noFlats
        ? (
            <View style={styles.note} accessibilityRole="alert">
              <Text style={styles.label}>{t("listings.no_flat_title")}</Text>
              <Text style={styles.hint}>{t("listings.no_flat_body")}</Text>
            </View>
          )
        : <FlatPicker control={control} setValue={setValue} flats={flats} />}

      <Field
        {...fieldProps}
        name="price"
        label={t(type === "RENT" ? "listings.field_price_rent" : "listings.field_price_sale")}
        error={errorOf("price")}
        keyboardType="decimal-pad"
      />
      <Field {...fieldProps} name="areaSqm" label={t("listings.field_area")} error={errorOf("areaSqm")} keyboardType="number-pad" />
      <View style={styles.row}>
        <Field {...fieldProps} name="bedrooms" label={t("listings.field_bedrooms")} error={errorOf("bedrooms")} keyboardType="number-pad" />
        <Field {...fieldProps} name="bathrooms" label={t("listings.field_bathrooms")} error={errorOf("bathrooms")} keyboardType="number-pad" />
      </View>

      <FurnishedField {...fieldProps} />

      <Field
        {...fieldProps}
        name="description"
        label={t("listings.field_description")}
        placeholder={t("listings.description_placeholder")}
        error={errorOf("description")}
        multiline
        maxLength={LISTING_DESCRIPTION_MAX}
      />
      <Field {...fieldProps} name="contactPhone" label={t("listings.field_phone")} hint={t("listings.phone_hint")} error={errorOf("contactPhone")} ltr keyboardType="phone-pad" />

      <ListingPhotoField
        photos={photos}
        onChange={(next) => {
          setPhotos(next);
          if (next.length)
            setPhotoError(undefined);
        }}
        busy={uploading}
        disabled={isPending}
        error={photoError}
      />

      {isEdit ? <Text style={styles.note}>{t("listings.edit_review_note")}</Text> : null}

      <GoldButton
        label={uploading ? t("feedback.uploading") : t(isEdit ? "listings.save" : "listings.submit")}
        onPress={submit}
        loading={isPending}
        disabled={isPending || noFlats || (isEdit && !isDirty && !photosChanged)}
      />
    </ScrollView>
  );
}

function TypeField({ control, styles }: { control: FormControl; styles: Styles }) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name="type"
      render={({ field }) => (
        <View style={styles.field}>
          <Text style={styles.label}>{t("listings.field_type")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {TYPES.map((value) => {
              const active = field.value === value;
              return (
                <Pressable
                  key={value}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                  onPress={() => field.onChange(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`listings.type_${value}`)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    />
  );
}

function FurnishedField({ control, styles, colors }: { control: FormControl; styles: Styles; colors: Colors }) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name="furnished"
      render={({ field }) => (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>{t("listings.field_furnished")}</Text>
            <Text style={styles.hint}>{t("listings.field_furnished_hint")}</Text>
          </View>
          <Switch
            value={field.value}
            onValueChange={field.onChange}
            trackColor={{ true: BRAND.gold, false: colors.elevated }}
            thumbColor={field.value ? BRAND.ink : colors.textMuted}
            accessibilityLabel={t("listings.field_furnished")}
          />
        </View>
      )}
    />
  );
}

function Field({ control, name, label, hint, placeholder, error, styles, colors, ltr, multiline, maxLength, keyboardType = "default", autoCapitalize }: {
  control: FormControl;
  name: "building" | "floor" | "flatNumber" | "price" | "areaSqm" | "bedrooms" | "bathrooms" | "description" | "contactPhone";
  label: string;
  hint?: string;
  placeholder?: string;
  error?: string;
  styles: Styles;
  colors: Colors;
  ltr?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: "default" | "number-pad" | "decimal-pad" | "phone-pad";
  autoCapitalize?: "none" | "characters";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TextInput
            value={String(field.value ?? "")}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            multiline={multiline}
            maxLength={maxLength}
            accessibilityLabel={label}
            accessibilityHint={hint}
            style={[styles.input, ltr && styles.inputLtr, multiline && styles.textarea, !!error && styles.inputError]}
          />
        )}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
