import type { TextInputProps } from "react-native";
import { Eye, EyeSlash } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  rightSlot?: React.ReactNode;
};

/**
 * EastPark design-system input.
 * Dark bg: #221f1c card, gold focus border, #B03A2E error border.
 * Supports RTL writing direction.
 */
export function AuthInput({ ref, label, error, rightSlot, ...props }: Props & { ref?: React.Ref<TextInput> }) {
  const colors = useAppColors();
  const styles = useStyles(colors, !!rightSlot);
  const [focused, setFocused] = React.useState(false);

  const inputStyle = [
    styles.input,
    focused && !error && styles.inputFocused,
    error ? styles.inputError : null,
    props.editable === false && styles.inputDisabled,
    {
      writingDirection: I18nManager.isRTL ? ("rtl" as const) : ("ltr" as const),
      textAlign: I18nManager.isRTL ? ("right" as const) : ("left" as const),
    },
  ];

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          ref={ref}
          style={inputStyle}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          {...props}
        />
        {rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
      </View>
      {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>, hasRightSlot: boolean) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        wrapper: { marginBottom: SPACING.md },
        label: {
          fontFamily: FONT.sans,
          fontWeight: "500",
          fontSize: 14,
          lineHeight: 22,
          color: colors.textMuted,
          marginBottom: SPACING.xs,
        },
        inputRow: { position: "relative" },
        input: {
          height: 48,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: RADIUS.md,
          paddingHorizontal: SPACING.base,
          paddingEnd: hasRightSlot ? SPACING["4xl"] : SPACING.base,
          fontFamily: FONT.sans,
          fontSize: 15,
          color: colors.text,
        },
        inputFocused: {
          borderColor: BRAND.gold,
        },
        inputError: {
          borderColor: SEMANTIC.error,
        },
        inputDisabled: {
          opacity: 0.5,
        },
        rightSlot: {
          position: "absolute",
          end: SPACING.xs,
          top: 2,
          bottom: 2,
          justifyContent: "center",
          alignItems: "center",
        },
        error: {
          fontFamily: FONT.sans,
          fontSize: 12,
          lineHeight: 18,
          color: SEMANTIC.error,
          marginTop: SPACING.xs,
        },
      }),
    [colors, hasRightSlot],
  );
}

/**
 * Show/hide control for password fields: 44x44 target, localized label.
 * Pass as `rightSlot` of AuthInput.
 */
export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [passwordToggleStyles.btn, pressed && { opacity: 0.6 }]}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={visible ? t("auth.hide_password") : t("auth.show_password")}
    >
      {visible ? <EyeSlash size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
    </Pressable>
  );
}

const passwordToggleStyles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
