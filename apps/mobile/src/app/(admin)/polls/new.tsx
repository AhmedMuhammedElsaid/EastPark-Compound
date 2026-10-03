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
const optionSchema = z.object({ label: z.string().trim().min(1, "validation.required"), labelAr: z.string().trim().min(1, "validation.required") });
const schema = z.object({
  question: z.string().trim().min(5, "validation.min_5"),
  questionAr: z.string().trim().min(5, "validation.min_5"),
  options: z.array(optionSchema).min(2, "validation.min_options"),
  expiresAt: z.string().trim().min(1, "validation.required"),
});
type FormValues = z.infer<typeof schema>;

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
    optionRow: { gap: SPACING.xs, marginBottom: SPACING.sm },
    optionInput: { flex: 1 },
    addOptionBtn: { alignItems: "center" as const, paddingVertical: SPACING.sm },
    addOptionText: { fontFamily: FONT.sans, fontSize: 14, color: BRAND.gold, fontWeight: "600" },
    submitBtn: { height: 52, borderRadius: RADIUS.md, backgroundColor: BRAND.gold, justifyContent: "center" as const, alignItems: "center" as const, marginTop: SPACING.xl },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
  }), [colors]);
}

export default function NewPollScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [optionCount, setOptionCount] = React.useState(2);
  const styles = useStyles();
  const colors = useAppColors();

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      question: "",
      questionAr: "",
      options: [{ label: "", labelAr: "" }, { label: "", labelAr: "" }],
      expiresAt: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) => governanceApi.createPoll(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      showMessage({ message: t("admin.poll_created"), type: "success", backgroundColor: SEMANTIC.success });
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
        <Text style={styles.navTitle}>{t("admin.new_poll")}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}>
        <Text style={styles.label}>{t("admin.question_en")}</Text>
        <Controller
          control={control}
          name="question"
          render={({ field }) => (
            <TextInput style={[styles.input, errors.question && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.question_en")} />
          )}
        />
        {errors.question?.message ? <Text style={styles.errorText}>{t(errors.question.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.question_ar")}</Text>
        <Controller
          control={control}
          name="questionAr"
          render={({ field }) => (
            <TextInput style={[styles.input, errors.questionAr && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={t("admin.question_ar")} textAlign="right" />
          )}
        />
        {errors.questionAr?.message ? <Text style={styles.errorText}>{t(errors.questionAr.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.expires_at")}</Text>
        <Controller
          control={control}
          name="expiresAt"
          render={({ field }) => (
            <TextInput style={[styles.input, errors.expiresAt && styles.inputError]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder="YYYY-MM-DD" />
          )}
        />
        {errors.expiresAt?.message ? <Text style={styles.errorText}>{t(errors.expiresAt.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.options")}</Text>
        {Array.from({ length: optionCount }).map((_, i) => (
          <View key={i} style={styles.optionRow}>
            <Controller
              control={control}
              name={`options.${i}.label`}
              render={({ field }) => (
                <TextInput style={[styles.input, styles.optionInput]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={`${t("admin.option")} ${i + 1} (EN)`} />
              )}
            />
            <Controller
              control={control}
              name={`options.${i}.labelAr`}
              render={({ field }) => (
                <TextInput style={[styles.input, styles.optionInput]} value={field.value} onChangeText={field.onChange} placeholderTextColor={colors.textMuted} placeholder={`${t("admin.option")} ${i + 1} (AR)`} textAlign="right" />
              )}
            />
            {(errors.options?.[i]?.label || errors.options?.[i]?.labelAr) ? <Text style={styles.errorText}>{t("validation.required")}</Text> : null}
          </View>
        ))}
        {optionCount < 6 && (
          <Pressable style={styles.addOptionBtn} onPress={() => setOptionCount(c => c + 1)}>
            <Text style={styles.addOptionText}>
              +
              {t("admin.add_option")}
            </Text>
          </Pressable>
        )}

        <Pressable style={[styles.submitBtn, isPending && styles.submitBtnDisabled]} onPress={handleSubmit(d => mutate(d))} disabled={isPending}>
          <Text style={styles.submitBtnText}>{isPending ? t("common.loading") : t("common.submit")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
