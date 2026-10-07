import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { CalendarBlank } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { combineDateAndTime, formatExpiry, initialPickerValue } from "@/lib/expiry-date";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Props = {
  value: Date | undefined;
  onChange: (value: Date) => void;
  /** Accessible name and placeholder context, e.g. "Expires at". */
  label: string;
  hasError?: boolean;
};

/**
 * Date + time picker field. Android opens the native date dialog then the time
 * dialog; iOS shows an inline `datetime` picker under the field. Past dates are
 * blocked in the dialog (minimumDate) and again by the form schema.
 */
export function DateTimeField({ value, onChange, label, hasError }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  const [iosOpen, setIosOpen] = React.useState(false);
  const isAr = i18n.language === "ar";
  const accent = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  // The Android dialog's calendar/clock text follows the DEVICE locale (the API
  // has no locale option); its buttons are labelled and tinted by the app.
  const buttons = {
    positiveButton: { label: t("common.confirm"), textColor: accent },
    negativeButton: { label: t("common.cancel"), textColor: accent },
  };

  const open = () => {
    void Haptics.selectionAsync();
    const start = initialPickerValue(value);
    if (Platform.OS !== "android") {
      if (!value)
        onChange(start);
      setIosOpen(o => !o);
      return;
    }
    DateTimePickerAndroid.open({
      mode: "date",
      value: start,
      minimumDate: new Date(),
      ...buttons,
      onChange: (dateEvent, pickedDate) => {
        if (dateEvent.type !== "set" || !pickedDate)
          return;
        DateTimePickerAndroid.open({
          mode: "time",
          value: start,
          ...buttons,
          onChange: (timeEvent, pickedTime) => {
            if (timeEvent.type !== "set" || !pickedTime)
              return;
            onChange(combineDateAndTime(pickedDate, pickedTime));
          },
        });
      },
    });
  };

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.field, hasError && styles.fieldError, pressed && styles.pressed]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${formatExpiry(value, i18n.language)}` : label}
        accessibilityHint={t("admin.pick_date_time_hint")}
      >
        <CalendarBlank size={20} color={accent} />
        <Text style={[styles.valueText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatExpiry(value, i18n.language) : t("admin.pick_date_time")}
        </Text>
      </Pressable>
      {Platform.OS === "ios" && iosOpen && (
        <DateTimePicker
          mode="datetime"
          display="inline"
          value={initialPickerValue(value)}
          minimumDate={new Date()}
          locale={isAr ? "ar-EG" : "en-GB"}
          accentColor={BRAND.gold}
          onChange={(event, picked) => {
            if (event.type === "set" && picked)
              onChange(combineDateAndTime(picked, picked));
          }}
        />
      )}
    </View>
  );
}

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      minHeight: 48,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    fieldError: { borderColor: SEMANTIC.error },
    pressed: { opacity: 0.85 },
    valueText: { flex: 1, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text },
    placeholder: { color: colors.textMuted },
  });
}
