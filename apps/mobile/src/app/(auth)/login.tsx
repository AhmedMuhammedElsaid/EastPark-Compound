import type { Control, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Eye, EyeSlash, FaceMask, Fingerprint, LockKey } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { z } from "zod";
import { AuthInput } from "@/components/auth/auth-input";

import { AuthScreenWrapper } from "@/components/auth/auth-screen-wrapper";
import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useBiometric } from "@/lib/hooks/use-biometric";
import { getSecureItem, setSecureItem } from "@/lib/secure-storage";
import { authApi } from "@/services/api/auth";
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from "@/services/api/client";
import { usersApi } from "@/services/api/users";
import { completeLogin } from "@/services/auth/session";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const SERVER_WAKING_HINT_MS = 5_000;

const schema = z.object({
  email: z.string().email("auth.errors.invalid_email"),
  password: z.string().min(8, "auth.errors.password_too_short"),
});
type LoginFormData = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    header: { alignItems: "center" as const, marginTop: SPACING.xl, marginBottom: SPACING["2xl"] },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 26, color: colors.text, textAlign: "center" as const, marginBottom: SPACING.xs },
    subtitle: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, marginBottom: SPACING.xl },
    form: { gap: SPACING.xs },
    forgotRow: { alignSelf: "flex-end" as const, marginTop: SPACING.xs, marginBottom: SPACING.sm },
    forgotText: { fontFamily: FONT.sans, fontSize: 13, color: BRAND.gold, fontWeight: "500" },
    footer: { flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, marginTop: SPACING.lg },
    footerText: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted },
    footerLink: { fontFamily: FONT.sans, fontSize: 14, color: BRAND.gold, fontWeight: "600" },
    bottomPad: { height: SPACING["2xl"] },
    wakingText: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, textAlign: "center" as const, marginTop: SPACING.sm },
    biometricBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.sm,
      height: 52,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: BRAND.gold,
      backgroundColor: `${BRAND.gold}11`,
      marginBottom: SPACING.md,
    },
    biometricBtnLoading: { opacity: 0.6 },
    biometricBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: BRAND.gold },
    biometricEmail: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted, textAlign: "center" as const, marginBottom: SPACING.md },
    divider: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm, marginBottom: SPACING.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted, textTransform: "uppercase" as const, letterSpacing: 1 },
  }), [colors]);
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const biometric = useBiometric();
  const [showPassword, setShowPassword] = React.useState(false);
  const [biometricSubmitting, setBiometricSubmitting] = React.useState(false);
  const [serverWaking, setServerWaking] = React.useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function maybePromptEnableBiometric(email: string) {
    if (!biometric.ready || !biometric.isAvailable || biometric.enabled)
      return;
    const kindLabel = t(`auth.biometric.kind.${biometric.kind}`);
    Alert.alert(
      t("auth.biometric.enable_prompt_title"),
      t("auth.biometric.enable_prompt_body", { kind: kindLabel }),
      [
        { text: t("auth.biometric.not_now"), style: "cancel" },
        {
          text: t("auth.biometric.enable_button"),
          onPress: async () => {
            const ok = await biometric.enable(email);
            if (ok) {
              showMessage({
                message: t("auth.biometric.enabled_success"),
                type: "success",
                backgroundColor: SEMANTIC.success,
              });
            }
          },
        },
      ],
    );
  }

  async function onSubmit({ email, password }: LoginFormData) {
    // Render cold starts take 25-50 s: explain the wait instead of looking stuck.
    const wakingTimer = setTimeout(setServerWaking, SERVER_WAKING_HINT_MS, true);
    try {
      const res = await authApi.login({ email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      await completeLogin({ user, accessToken, refreshToken });
      // Post-login: offer biometric enrollment (does not block navigation).
      maybePromptEnableBiometric(email);
    }
    catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        // Account exists but the email is not verified yet.
        // Login sends no code, so request a fresh one before routing to verify.
        const resent = await authApi.resendOtp(email).then(() => true, () => false);
        showMessage({
          message: t(resent ? "auth.errors.email_not_verified" : "auth.errors.email_not_verified_no_code"),
          type: "warning",
          backgroundColor: SEMANTIC.warning,
        });
        router.push({ pathname: "/(auth)/verify-otp", params: resent ? { email, resent: "1" } : { email } });
        return;
      }
      const message = status === undefined
        ? t("auth.errors.server_unreachable")
        : status === 429
          ? t("errors.rate_limited")
          : t("auth.errors.login_failed");
      showMessage({ message, type: "danger", backgroundColor: SEMANTIC.error });
    }
    finally {
      clearTimeout(wakingTimer);
      setServerWaking(false);
    }
  }

  async function onBiometricSignIn() {
    if (biometricSubmitting)
      return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBiometricSubmitting(true);
    try {
      const ok = await biometric.authenticate();
      if (!ok)
        return;
      const refreshToken = await getSecureItem(SECURE_KEY_REFRESH);
      if (!refreshToken) {
        await biometric.disable();
        showMessage({
          message: t("auth.biometric.session_expired"),
          type: "warning",
          backgroundColor: SEMANTIC.warning,
        });
        return;
      }
      const tokens = await authApi.refresh(refreshToken);
      const { accessToken, refreshToken: newRefresh } = tokens.data.data;
      await setSecureItem(SECURE_KEY_ACCESS, accessToken);
      await setSecureItem(SECURE_KEY_REFRESH, newRefresh);
      const profile = await usersApi.getProfile();
      await completeLogin({ user: profile.data.data, accessToken, refreshToken: newRefresh });
    }
    catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        // Refresh token revoked/expired. Disable biometric so user re-enters password.
        await biometric.disable();
        showMessage({
          message: t("auth.biometric.session_expired"),
          type: "warning",
          backgroundColor: SEMANTIC.warning,
        });
        return;
      }
      // Network error / timeout / 5xx: keep biometric + tokens so the user can retry.
      showMessage({ message: t("auth.errors.server_unreachable"), type: "danger", backgroundColor: SEMANTIC.error });
    }
    finally {
      setBiometricSubmitting(false);
    }
  }

  const showBiometric = biometric.ready && biometric.isAvailable && biometric.enabled;
  const BiometricIcon
    = biometric.kind === "face"
      ? FaceMask
      : biometric.kind === "fingerprint"
        ? Fingerprint
        : LockKey;

  return (
    <AuthScreenWrapper>
      <View style={styles.header}><BrandMark size="md" /></View>
      <Text style={styles.title}>{t("auth.login")}</Text>
      <Text style={styles.subtitle}>{t("auth.welcome_back")}</Text>

      {showBiometric && (
        <>
          <Pressable
            style={[styles.biometricBtn, biometricSubmitting && styles.biometricBtnLoading]}
            onPress={onBiometricSignIn}
            disabled={biometricSubmitting}
            accessibilityRole="button"
            accessibilityLabel={t(`auth.biometric.sign_in_with.${biometric.kind}`)}
          >
            <BiometricIcon size={22} color={BRAND.gold} weight="duotone" />
            <Text style={styles.biometricBtnText}>
              {t(`auth.biometric.sign_in_with.${biometric.kind}`)}
            </Text>
          </Pressable>
          {biometric.email
            ? (
                <Text style={styles.biometricEmail}>{biometric.email}</Text>
              )
            : null}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("common.or")}</Text>
            <View style={styles.dividerLine} />
          </View>
        </>
      )}

      <LoginForm control={control} errors={errors} showPassword={showPassword} onTogglePassword={() => setShowPassword(v => !v)} onSubmitEditing={handleSubmit(onSubmit)} />
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/(auth)/forgot-password");
        }}
        style={styles.forgotRow}
        hitSlop={8}
      >
        <Text style={styles.forgotText}>{t("auth.forgot_password")}</Text>
      </Pressable>
      <GoldButton label={t("auth.login")} onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      {serverWaking
        ? <Text style={styles.wakingText} accessibilityLiveRegion="polite">{t("common.server_waking")}</Text>
        : null}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t("auth.no_account")}
          {" "}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace("/(auth)/register");
          }}
          hitSlop={8}
        >
          <Text style={styles.footerLink}>{t("auth.register")}</Text>
        </Pressable>
      </View>
      <View style={styles.bottomPad} />
    </AuthScreenWrapper>
  );
}

type LoginFormProps = {
  control: Control<LoginFormData>;
  errors: FieldErrors<LoginFormData>;
  showPassword: boolean;
  onTogglePassword: () => void;
  onSubmitEditing: () => void;
};

function LoginForm({ control, errors, showPassword, onTogglePassword, onSubmitEditing }: LoginFormProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useAppColors();
  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput label={t("auth.email")} accessibilityLabel={t("auth.email")} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email ? t(errors.email.message as string) : undefined} keyboardType="email-address" autoComplete="email" returnKeyType="next" />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput
            label={t("auth.password")}
            accessibilityLabel={t("auth.password")}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password ? t(errors.password.message as string) : undefined}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={onSubmitEditing}
            rightSlot={<Pressable onPress={onTogglePassword} hitSlop={12} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeSlash size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}</Pressable>}
          />
        )}
      />
    </View>
  );
}
