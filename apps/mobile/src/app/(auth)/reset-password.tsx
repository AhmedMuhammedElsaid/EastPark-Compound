import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { Eye, EyeSlash } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { z } from "zod";

import { AuthInput } from "@/components/auth/auth-input";
import { AuthScreenWrapper } from "@/components/auth/auth-screen-wrapper";
import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { authApi } from "@/services/api/auth";
import { FONT, SEMANTIC, SPACING } from "@/theme/tokens";

const schema = z
  .object({
    password: z.string().min(8, "auth.errors.password_too_short"),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: "auth.errors.passwords_no_match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    header: {
      alignItems: "center" as const,
      marginTop: SPACING.xl,
      marginBottom: SPACING["2xl"],
    },
    title: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 24,
      color: colors.text,
      textAlign: "center" as const,
      marginBottom: SPACING.xs,
    },
    subtitle: {
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center" as const,
      marginBottom: SPACING.xl,
    },
    form: { gap: SPACING.xs, marginBottom: SPACING.sm },
    errorCard: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    errorTitle: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 20,
      color: colors.text,
      textAlign: "center" as const,
    },
    errorBody: {
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center" as const,
    },
  }), [colors]);
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const styles = useStyles();
  const colors = useAppColors();
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit({ password }: FormData) {
    if (!token)
      return;
    try {
      await authApi.resetPassword(token, password);
      showMessage({
        message: t("auth.password_reset_success"),
        type: "success",
        backgroundColor: SEMANTIC.success,
      });
      router.replace("/(auth)/login");
    }
    catch {
      showMessage({
        message: t("auth.reset_link_expired"),
        type: "danger",
        backgroundColor: SEMANTIC.error,
      });
    }
  }

  if (!token) {
    return (
      <AuthScreenWrapper scrollable={false}>
        <View style={styles.header}>
          <BrandMark size="sm" />
        </View>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>{t("auth.invalid_reset_link")}</Text>
          <Text style={styles.errorBody}>{t("auth.contact_administrator")}</Text>
        </View>
        <GoldButton
          variant="outline"
          label={t("auth.back_to_login")}
          onPress={() => router.replace("/(auth)/login")}
        />
      </AuthScreenWrapper>
    );
  }

  return (
    <AuthScreenWrapper>
      <View style={styles.header}>
        <BrandMark size="sm" />
      </View>

      <Text style={styles.title}>{t("auth.reset_password")}</Text>
      <Text style={styles.subtitle}>{t("auth.choose_new_password")}</Text>

      <View style={styles.form}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthInput
              label={t("auth.password")}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password ? t(errors.password.message as string) : undefined}
              secureTextEntry={!showPwd}
              autoComplete="new-password"
              returnKeyType="next"
              rightSlot={(
                <Pressable onPress={() => setShowPwd(v => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPwd ? t("auth.hide_password") : t("auth.show_password")}>
                  {showPwd ? <EyeSlash size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                </Pressable>
              )}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthInput
              label={t("auth.confirm_password")}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword ? t(errors.confirmPassword.message as string) : undefined}
              secureTextEntry={!showConfirm}
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
              rightSlot={(
                <Pressable onPress={() => setShowConfirm(v => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showConfirm ? t("auth.hide_password") : t("auth.show_password")}>
                  {showConfirm ? <EyeSlash size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                </Pressable>
              )}
            />
          )}
        />
      </View>

      <GoldButton
        label={t("auth.reset_password")}
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
      />
    </AuthScreenWrapper>
  );
}
