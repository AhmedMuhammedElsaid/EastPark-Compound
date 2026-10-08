import type { TextInput } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { z } from "zod";

import { AuthInput, PasswordToggle } from "@/components/auth/auth-input";
import { AuthScreenWrapper } from "@/components/auth/auth-screen-wrapper";
import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { newPasswordSchema } from "@/lib/auth/password";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { authApi } from "@/services/api/auth";
import { FONT, SEMANTIC, SPACING } from "@/theme/tokens";

const schema = z
  .object({
    password: newPasswordSchema,
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
      lineHeight: 36,
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
      lineHeight: 22,
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
      lineHeight: 30,
      color: colors.text,
      textAlign: "center" as const,
    },
    errorBody: {
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center" as const,
    },
  }), [colors]);
}

function InvalidResetLink({ styles }: { styles: ReturnType<typeof useStyles> }) {
  const { t } = useTranslation();

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

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const styles = useStyles();
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const confirmRef = React.useRef<TextInput>(null);

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

  if (!token)
    return <InvalidResetLink styles={styles} />;

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
              submitBehavior="submit"
              onSubmitEditing={() => confirmRef.current?.focus()}
              rightSlot={(
                <PasswordToggle visible={showPwd} onToggle={() => setShowPwd(v => !v)} />
              )}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthInput
              ref={confirmRef}
              label={t("auth.confirm_password")}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword ? t(errors.confirmPassword.message as string) : undefined}
              secureTextEntry={!showConfirm}
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
              rightSlot={(
                <PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
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
