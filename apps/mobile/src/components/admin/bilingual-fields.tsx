import type { Control, FieldValues, Path } from "react-hook-form";
import * as React from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text, TextInput, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";

/** The subset of the admin forms' StyleSheet these fields use. */
type FieldStyles = { label: any; input: any; inputError: any; errorText: any; textarea?: any };

type FieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  /** Translation key of the validation message, if any. */
  error?: string;
  arabic?: boolean;
  multiline?: boolean;
  styles: FieldStyles;
};

/**
 * One labelled text field. The label alone names the field: no placeholder
 * that repeats it. Arabic fields right-align their text.
 */
export function TextField<T extends FieldValues>({ control, name, label, error, arabic, multiline, styles }: FieldProps<T>) {
  const { t } = useTranslation();
  const colors = useAppColors();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TextInput
            style={[styles.input, multiline && styles.textarea, error ? styles.inputError : null]}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={label}
            multiline={multiline}
            textAlign={arabic ? "right" : undefined}
          />
        )}
      />
      {error ? <Text style={styles.errorText}>{t(error as any)}</Text> : null}
    </View>
  );
}

type PairProps<T extends FieldValues> = {
  control: Control<T>;
  enName: Path<T>;
  arName: Path<T>;
  enLabel: string;
  arLabel: string;
  enError?: string;
  arError?: string;
  multiline?: boolean;
  styles: FieldStyles;
};

/** English + Arabic variants of one field, the app language's variant first. */
export function BilingualFields<T extends FieldValues>({ enName, arName, enLabel, arLabel, enError, arError, control, multiline, styles }: PairProps<T>) {
  const { i18n } = useTranslation();
  const en = <TextField key="en" control={control} name={enName} label={enLabel} error={enError} multiline={multiline} styles={styles} />;
  const ar = <TextField key="ar" control={control} name={arName} label={arLabel} error={arError} multiline={multiline} arabic styles={styles} />;
  return <>{i18n.language === "ar" ? [ar, en] : [en, ar]}</>;
}
