import type { FeedbackCategory } from "@/services/api/community";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as React from "react";
import { useController, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { showMessage } from "react-native-flash-message";
import { z } from "zod";

import { GoldButton } from "@/components/auth/gold-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const CATEGORIES: FeedbackCategory[] = [
  "MAINTENANCE",
  "SECURITY",
  "CLEANLINESS",
  "NOISE",
  "SUGGESTION",
  "OTHER",
];

const schema = z.object({
  category: z.enum(["MAINTENANCE", "SECURITY", "CLEANLINESS", "NOISE", "SUGGESTION", "OTHER"]),
  // Messages are translation keys, rendered with t().
  body: z.string().trim().min(10, "feedback.body_too_short").max(2000, "feedback.body_too_long"),
  isAnonymous: z.boolean(),
});

type FormData = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.lg, paddingBottom: SPACING.xl },
    section: { gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    categoryGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    catChip: {
      minHeight: 44,
      justifyContent: "center" as const,
      paddingHorizontal: SPACING.base,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    catChipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    catChipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "600" },
    catChipTextActive: { color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    input: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 22,
      color: colors.text,
      minHeight: 48,
    },
    inputMultiline: { minHeight: 140, textAlignVertical: "top" as const, paddingTop: SPACING.md },
    inputFocused: { borderColor: BRAND.gold },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error },
    anonymousRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
    },
    anonymousText: { flex: 1, gap: 2 },
    anonymousLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    anonymousSubtitle: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: colors.textMuted },
  }), [colors]);
}

export default function NewFeedbackScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "MAINTENANCE", body: "", isAnonymous: false },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => communityApi.submitFeedback(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] });
      router.back();
    },
    onError: () => {
      showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title={t("feedback.new")} />

      {/* Inside the tab navigator: the tab bar clears the system bar, so no bottom inset. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <CategoryPickerField control={control} styles={styles} />
        <RhfTextInput
          control={control}
          name="body"
          label={t("feedback.feedback_body")}
          placeholder={t("feedback.body_placeholder")}
          error={errors.body?.message ? t(errors.body.message as any) : undefined}
          multiline
          styles={styles}
          colors={colors}
        />
        <AnonymousToggleField control={control} styles={styles} colors={colors} />

        <GoldButton
          label={isPending ? t("common.loading") : t("common.submit")}
          onPress={handleSubmit(d => mutate(d))}
          loading={isPending}
          disabled={isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Form field sub-components ────────────────────────────────────────────────

function CategoryPickerField({ control, styles }: { control: any; styles: any }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: "category" });

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("feedback.category")}</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const active = field.value === cat;
          return (
            <Pressable
              key={cat}
              style={({ pressed }) => [styles.catChip, active && styles.catChipActive, pressed && styles.pressed]}
              onPress={() => field.onChange(cat)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {t(`feedback.${cat}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RhfTextInput({
  control,
  name,
  label,
  placeholder,
  error,
  multiline,
  styles,
  colors,
}: {
  control: any;
  name: string;
  label: string;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  styles: any;
  colors: any;
}) {
  const { field } = useController({ control, name });
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={field.value as string}
        onChangeText={field.onChange}
        onBlur={() => {
          field.onBlur();
          setIsFocused(false);
        }}
        onFocus={() => setIsFocused(true)}
        placeholderTextColor={colors.textMuted}
        placeholder={placeholder ?? label}
        multiline={multiline}
        maxLength={2000}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function AnonymousToggleField({ control, styles, colors }: { control: any; styles: any; colors: any }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: "isAnonymous" });
  const on = field.value as boolean;

  return (
    <View style={styles.anonymousRow}>
      <View style={styles.anonymousText}>
        <Text style={styles.anonymousLabel}>{t("feedback.anonymous")}</Text>
        <Text style={styles.anonymousSubtitle}>{t("feedback.anonymous_subtitle")}</Text>
      </View>
      <Switch
        value={on}
        onValueChange={field.onChange}
        trackColor={{ true: BRAND.gold, false: colors.elevated }}
        thumbColor={on ? BRAND.ink : colors.textMuted}
        accessibilityLabel={t("feedback.anonymous")}
      />
    </View>
  );
}
