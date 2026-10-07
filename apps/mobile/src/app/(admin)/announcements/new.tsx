import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { z } from "zod";

import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

// Messages are translation keys, rendered with t().
const schema = z.object({
  title: z.string().trim().min(3, "validation.min_3"),
  titleAr: z.string().trim().min(3, "validation.min_3"),
  body: z.string().trim().min(10, "validation.min_10"),
  bodyAr: z.string().trim().min(10, "validation.min_10"),
  category: z.enum(["GENERAL", "PROMOTION", "EVENT", "MAINTENANCE", "NEWS"]),
});
type FormValues = z.infer<typeof schema>;

const CATEGORIES = ["GENERAL", "PROMOTION", "EVENT", "MAINTENANCE", "NEWS"] as const;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.md, marginBottom: SPACING.xs },
    input: { backgroundColor: colors.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: 48, paddingVertical: SPACING.sm, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text, borderWidth: 1, borderColor: colors.border },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error, marginTop: SPACING.xs },
    textarea: { minHeight: 100, textAlignVertical: "top" as const },
    chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    chip: { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: SPACING.base, borderRadius: RADIUS.full, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    chipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    chipTextActive: { color: BRAND.ink, fontWeight: "700" },
    submitBtn: { height: 52, borderRadius: RADIUS.md, backgroundColor: BRAND.gold, justifyContent: "center" as const, alignItems: "center" as const, marginTop: SPACING.xl },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  }), [colors]);
}

export default function NewAnnouncementScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", titleAr: "", body: "", bodyAr: "", category: "GENERAL" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) => communityApi.createAnnouncement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["home-announcements"] });
      showMessage({ message: t("admin.announcement_created"), type: "success", backgroundColor: SEMANTIC.success });
      router.back();
    },
    onError: () => {
      showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("admin.new_announcement")} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}>
        <Text style={styles.label}>{t("admin.title_en")}</Text>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <TextInput style={[styles.input, errors.title && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.title_en")} />
          )}
        />
        {errors.title?.message ? <Text style={styles.errorText}>{t(errors.title.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.title_ar")}</Text>
        <Controller
          control={control}
          name="titleAr"
          render={({ field }) => (
            <TextInput style={[styles.input, errors.titleAr && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.title_ar")} textAlign="right" />
          )}
        />
        {errors.titleAr?.message ? <Text style={styles.errorText}>{t(errors.titleAr.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.body_en")}</Text>
        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <TextInput style={[styles.input, styles.textarea, errors.body && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.body_en")} multiline />
          )}
        />
        {errors.body?.message ? <Text style={styles.errorText}>{t(errors.body.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.body_ar")}</Text>
        <Controller
          control={control}
          name="bodyAr"
          render={({ field }) => (
            <TextInput style={[styles.input, styles.textarea, errors.bodyAr && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.body_ar")} multiline textAlign="right" />
          )}
        />
        {errors.bodyAr?.message ? <Text style={styles.errorText}>{t(errors.bodyAr.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.category")}</Text>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <View style={styles.chips}>
              {CATEGORIES.map(cat => (
                <Pressable key={cat} style={[styles.chip, field.value === cat && styles.chipActive]} onPress={() => field.onChange(cat)} accessibilityRole="button" accessibilityState={{ selected: field.value === cat }}>
                  <Text style={[styles.chipText, field.value === cat && styles.chipTextActive]}>{t(`community.${cat}`)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />

        <Pressable style={({ pressed }) => [styles.submitBtn, isPending && styles.submitBtnDisabled, pressed && styles.pressed]} onPress={handleSubmit(d => mutate(d))} disabled={isPending} accessibilityRole="button">
          <Text style={styles.submitBtnText}>{isPending ? t("common.loading") : t("common.submit")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
