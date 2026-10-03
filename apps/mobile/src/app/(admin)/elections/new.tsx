import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { z } from "zod";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { governanceApi } from "@/services/api/governance";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

// Messages are translation keys, rendered with t().
const schema = z.object({
  title: z.string().trim().min(3, "validation.min_3"),
  titleAr: z.string().trim().min(3, "validation.min_3"),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  expiresAt: z.string().trim().min(1, "validation.required"),
  visibilityMode: z.enum(["SEALED_UNTIL_DEADLINE", "LIVE_COUNT", "ADMIN_CONTROLLED"]),
});
type FormValues = z.infer<typeof schema>;

const VISIBILITY_MODES = ["SEALED_UNTIL_DEADLINE", "LIVE_COUNT", "ADMIN_CONTROLLED"] as const;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, gap: SPACING.sm },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.elevated, justifyContent: "center" as const, alignItems: "center" as const },
    navTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    scroll: { padding: SPACING.base, gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, color: colors.textMuted, marginTop: SPACING.md, marginBottom: SPACING.xs },
    input: { backgroundColor: colors.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontFamily: FONT.sans, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { fontFamily: FONT.sans, fontSize: 12, color: SEMANTIC.error, marginTop: SPACING.xs },
    textarea: { minHeight: 80, textAlignVertical: "top" as const },
    chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    chipText: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    chipTextActive: { color: colors.bg, fontWeight: "700" },
    submitBtn: { height: 52, borderRadius: RADIUS.md, backgroundColor: BRAND.gold, justifyContent: "center" as const, alignItems: "center" as const, marginTop: SPACING.xl },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
  }), [colors]);
}

export default function NewElectionScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", titleAr: "", description: "", descriptionAr: "", expiresAt: "", visibilityMode: "SEALED_UNTIL_DEADLINE" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) => governanceApi.createElection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elections"] });
      showMessage({ message: t("admin.election_created"), type: "success", backgroundColor: SEMANTIC.success });
      router.back();
    },
    onError: () => {
      showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft mirrored={I18nManager.isRTL} size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("admin.new_election")}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}>
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

        <Text style={styles.label}>{t("admin.description_en")}</Text>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextInput style={[styles.input, styles.textarea]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.description_en")} multiline />
          )}
        />

        <Text style={styles.label}>{t("admin.description_ar")}</Text>
        <Controller
          control={control}
          name="descriptionAr"
          render={({ field }) => (
            <TextInput style={[styles.input, styles.textarea]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.description_ar")} multiline textAlign="right" />
          )}
        />

        <Text style={styles.label}>{t("admin.expires_at")}</Text>
        <Controller
          control={control}
          name="expiresAt"
          render={({ field }) => (
            <TextInput style={[styles.input, errors.expiresAt && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder="YYYY-MM-DD" />
          )}
        />
        {errors.expiresAt?.message ? <Text style={styles.errorText}>{t(errors.expiresAt.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.visibility_mode")}</Text>
        <Controller
          control={control}
          name="visibilityMode"
          render={({ field }) => (
            <View style={styles.chips}>
              {VISIBILITY_MODES.map(mode => (
                <Pressable key={mode} style={[styles.chip, field.value === mode && styles.chipActive]} onPress={() => field.onChange(mode)}>
                  <Text style={[styles.chipText, field.value === mode && styles.chipTextActive]}>{t(`admin.visibility_${mode.toLowerCase()}`)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />

        <Pressable style={[styles.submitBtn, isPending && styles.submitBtnDisabled]} onPress={handleSubmit(d => mutate(d))} disabled={isPending}>
          <Text style={styles.submitBtnText}>{isPending ? t("common.loading") : t("common.submit")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
