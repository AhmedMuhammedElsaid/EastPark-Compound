import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft, EnvelopeSimple } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { z } from "zod";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthScreenWrapper } from "@/components/auth/auth-screen-wrapper";
import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { authApi } from "@/services/api/auth";

import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const schema = z.object({
  email: z.string().email("auth.errors.invalid_email"),
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
    form: { marginBottom: SPACING.sm },
    footer: { alignItems: "center" as const, marginTop: SPACING.lg },
    backLinkRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.xs, minHeight: 44 },
    backLink: {
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.textMuted,
    },
    successCard: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    successIcon: { width: 80, height: 80, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    successTitle: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 22,
      lineHeight: 34,
      color: colors.text,
      textAlign: "center" as const,
    },
    successBody: {
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center" as const,
      lineHeight: 22,
    },
    tryDifferentEmail: {
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center" as const,
      marginTop: SPACING.sm,
    },
  }), [colors]);
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles();
  const [sent, setSent] = React.useState(false);
  const [sentEmail, setSentEmail] = React.useState("");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: FormData) {
    try {
      await authApi.forgotPassword(email);
      setSentEmail(email);
      setSent(true);
    }
    catch {
      showMessage({
        message: t("common.error"),
        type: "danger",
        backgroundColor: SEMANTIC.error,
      });
    }
  }

  if (sent) {
    return (
      <AuthScreenWrapper scrollable={false}>
        <View style={styles.header}>
          <BrandMark size="sm" />
        </View>

        <View style={styles.successCard}>
          <View style={styles.successIcon}><EnvelopeSimple size={36} color={BRAND.gold} /></View>
          <Text style={styles.successTitle}>{t("auth.reset_link_sent")}</Text>
          <Text style={styles.successBody}>
            {t("auth.reset_link_body", { email: sentEmail })}
          </Text>
        </View>

        <GoldButton
          variant="outline"
          label={t("auth.back_to_login")}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace("/(auth)/login");
          }}
        />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSent(false);
          }}
          hitSlop={8}
          style={{ alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: SPACING.sm }}
        >
          <Text style={styles.tryDifferentEmail}>{t("auth.forgot.tryDifferentEmail")}</Text>
        </Pressable>
      </AuthScreenWrapper>
    );
  }

  return (
    <AuthScreenWrapper>
      <View style={styles.header}>
        <BrandMark size="sm" />
      </View>

      <Text style={styles.title}>{t("auth.reset_password")}</Text>
      <Text style={styles.subtitle}>{t("auth.forgot_password_body")}</Text>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthInput
              label={t("auth.email")}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email ? t(errors.email.message as string) : undefined}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />
      </View>

      <GoldButton
        label={t("auth.send_reset_link")}
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
      />

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={8}
          style={styles.backLinkRow}
        >
          <ArrowLeft mirrored={I18nManager.isRTL} size={14} color={colors.textMuted} />
          <Text style={styles.backLink}>{t("common.back")}</Text>
        </Pressable>
      </View>
    </AuthScreenWrapper>
  );
}
