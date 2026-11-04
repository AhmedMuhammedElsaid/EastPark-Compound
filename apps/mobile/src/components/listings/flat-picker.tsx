import type { Control, UseFormSetValue } from "react-hook-form";
import type { ListingFormInput, ListingFormOutput } from "@/lib/listings";
import type { ListingFlatOption } from "@/lib/units";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { listingUnitLabel } from "@/lib/listings";
import { parseUnitLabel } from "@/lib/units";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type Props = {
  control: Control<ListingFormInput, unknown, ListingFormOutput>;
  setValue: UseFormSetValue<ListingFormInput>;
  /** The caller's own flats (backend `assertOwnsFlat` accepts only these). */
  flats: ListingFlatOption[];
};

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  const align = { textAlign: I18nManager.isRTL ? ("right" as const) : ("left" as const) };
  return StyleSheet.create({
    wrap: { gap: SPACING.xs },
    label: { ...align, fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    hint: { ...align, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    chip: {
      minHeight: 48,
      minWidth: 96,
      paddingHorizontal: SPACING.base,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    chipText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.textMuted, writingDirection: "ltr" },
    chipTextActive: { color: BRAND.ink, fontWeight: "700" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}

/**
 * Flat chooser for the listing form: the caller's own flats as chips (one flat
 * shows as a single selected chip). An edit keeps its stored flat as an extra
 * chip even when it has left the account, so the backend can refuse it.
 */
export function FlatPicker({ control, setValue, flats }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  const [building, floor, flatNumber] = useWatch({ control, name: ["building", "floor", "flatNumber"] });
  const current = building && floor && flatNumber ? listingUnitLabel({ building, floor, flatNumber }) : "";

  const options = React.useMemo(() => {
    const stored = current && !flats.some(f => f.label === current) ? parseUnitLabel(current) : null;
    return stored ? [stored, ...flats] : flats;
  }, [current, flats]);

  const fill = React.useCallback((option: ListingFlatOption, opts: { shouldDirty: boolean; shouldValidate: boolean }) => {
    setValue("building", option.building, opts);
    setValue("floor", option.floor, opts);
    setValue("flatNumber", option.flatNumber, opts);
  }, [setValue]);

  // Nothing chosen yet (a new listing; flats may arrive after the profile loads): preselect the first.
  React.useEffect(() => {
    if (!current && flats[0])
      fill(flats[0], { shouldDirty: false, shouldValidate: false });
  }, [current, flats, fill]);

  const choose = (option: ListingFlatOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fill(option, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t("listings.field_flat_picker")}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((option) => {
          const active = option.label === current;
          return (
            <Pressable
              key={option.label}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              onPress={() => choose(option)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{t("listings.flat_picker_hint")}</Text>
    </View>
  );
}
