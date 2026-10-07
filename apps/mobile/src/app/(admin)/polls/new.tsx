import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { z } from "zod";

import { BilingualFields } from "@/components/admin/bilingual-fields";
import { DateTimeField } from "@/components/ui/date-time-field";
import { ScreenHeader } from "@/components/ui/screen-header";
import { expirySchema } from "@/lib/expiry-date";
import { formatNumber } from "@/lib/format-number";
import { buildPollPayload } from "@/lib/governance-payload";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { governanceApi } from "@/services/api/governance";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

// Messages are translation keys, rendered with t().
const optionSchema = z.object({ label: z.string().trim().min(1, "validation.required"), labelAr: z.string().trim().min(1, "validation.required") });
const schema = z.object({
  question: z.string().trim().min(5, "validation.min_5"),
  questionAr: z.string().trim().min(5, "validation.min_5"),
  options: z.array(optionSchema).min(2, "validation.min_options"),
  expiresAt: expirySchema,
});
type FormValues = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.md, marginBottom: SPACING.xs },
    input: { backgroundColor: colors.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: 48, paddingVertical: SPACING.sm, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text, borderWidth: 1, borderColor: colors.border },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error, marginTop: SPACING.xs },
    optionRow: { gap: SPACING.xs, marginBottom: SPACING.sm },
    optionInput: { flex: 1 },
    addOptionBtn: { flexDirection: "row" as const, gap: SPACING.xs, alignItems: "center" as const, justifyContent: "center" as const, minHeight: 44 },
    addOptionText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: "primaryText" in colors ? colors.primaryText : BRAND.gold, fontWeight: "600" },
    submitBtn: { height: 52, borderRadius: RADIUS.md, backgroundColor: BRAND.gold, justifyContent: "center" as const, alignItems: "center" as const, marginTop: SPACING.xl },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  }), [colors]);
}

export default function NewPollScreen() {
  const { t, i18n } = useTranslation();
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
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) => governanceApi.createPoll(buildPollPayload(data)),
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
    <View style={styles.container}>
      <ScreenHeader title={t("admin.new_poll")} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}>
        <BilingualFields control={control} enName="question" arName="questionAr" enLabel={t("admin.question_en")} arLabel={t("admin.question_ar")} enError={errors.question?.message} arError={errors.questionAr?.message} styles={styles} />

        <Text style={styles.label}>{t("admin.expires_at")}</Text>
        <Controller
          control={control}
          name="expiresAt"
          render={({ field }) => (
            <DateTimeField value={field.value} onChange={field.onChange} label={t("admin.expires_at")} hasError={!!errors.expiresAt} />
          )}
        />
        {errors.expiresAt?.message ? <Text style={styles.errorText}>{t(errors.expiresAt.message as any)}</Text> : null}

        <Text style={styles.label}>{t("admin.options")}</Text>
        {Array.from({ length: optionCount }).map((_, i) => (
          <BilingualFields
            // eslint-disable-next-line react/no-array-index-key -- options are positional form fields
            key={i}
            control={control}
            enName={`options.${i}.label`}
            arName={`options.${i}.labelAr`}
            enLabel={t("admin.option_en", { number: formatNumber(i + 1, i18n.language) })}
            arLabel={t("admin.option_ar", { number: formatNumber(i + 1, i18n.language) })}
            enError={errors.options?.[i]?.label?.message}
            arError={errors.options?.[i]?.labelAr?.message}
            styles={styles}
          />
        ))}
        {optionCount < 6 && (
          <Pressable style={styles.addOptionBtn} onPress={() => setOptionCount(c => c + 1)} accessibilityRole="button">
            <Plus size={18} color={"primaryText" in colors ? colors.primaryText : BRAND.gold} />
            <Text style={styles.addOptionText}>{t("admin.add_option")}</Text>
          </Pressable>
        )}

        <Pressable style={({ pressed }) => [styles.submitBtn, isPending && styles.submitBtnDisabled, pressed && styles.pressed]} onPress={handleSubmit(d => mutate(d))} disabled={isPending} accessibilityRole="button">
          <Text style={styles.submitBtnText}>{isPending ? t("common.loading") : t("common.submit")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
