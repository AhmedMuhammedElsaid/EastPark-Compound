import type { TFunction } from "i18next";
import type { Control, FieldErrors } from "react-hook-form";
import type { TextInput } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { FaceMask, Fingerprint, LockKey } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { z } from "zod";
import { AuthInput, PasswordToggle } from "@/components/auth/auth-input";

import { AuthScreenWrapper } from "@/components/auth/auth-screen-wrapper";
import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { loginErrorKey } from "@/lib/api-error";
import { isBiometricBoundTo } from "@/lib/biometric-binding";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useBiometric } from "@/lib/hooks/use-biometric";
import { authApi } from "@/services/api/auth";
import { completeLogin, signInWithKeptBiometricSession } from "@/services/auth/session";
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
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 26, lineHeight: 40, color: colors.text, textAlign: "center" as const, marginBottom: SPACING.xs },
    subtitle: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" as const, marginBottom: SPACING.xl },
    form: { gap: SPACING.xs },
    forgotRow: { alignSelf: "flex-end" as const, minHeight: 44, justifyContent: "center" as const },
    forgotText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: "primaryText" in colors ? colors.primaryText : BRAND.gold, fontWeight: "600" },
    footer: { alignItems: "center" as const, marginTop: SPACING.lg },
    footerText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" as const },
    bottomPad: { height: SPACING["2xl"] },
    wakingText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "center" as const, marginTop: SPACING.sm },
    biometricBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.sm,
      height: 48,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: BRAND.gold,
      backgroundColor: `${BRAND.gold}1f`,
      marginBottom: SPACING.md,
    },
    biometricBtnLoading: { opacity: 0.6 },
    biometricBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 22, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    biometricEmail: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "center" as const, marginBottom: SPACING.md },
    divider: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm, marginBottom: SPACING.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  }), [colors]);
}

function useBiometricSignIn(biometric: ReturnType<typeof useBiometric>) {
  const { t } = useTranslation();
  const [biometricSubmitting, setBiometricSubmitting] = React.useState(false);

  async function onBiometricSignIn() {
    if (biometricSubmitting)
      return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBiometricSubmitting(true);
    try {
      const ok = await biometric.authenticate();
      if (!ok)
        return;
      // Refresh, identity check and token storage live in the session module:
      // the access token is only stored once the account is confirmed.
      const result = await signInWithKeptBiometricSession();
      if (result === "signed_in" || result === "aborted")
        return;
      if (result === "unreachable") {
        // Offline / timeout / 5xx: the kept session stays for a retry.
        showMessage({ message: t("auth.errors.server_unreachable"), type: "danger", backgroundColor: SEMANTIC.error });
        return;
      }
      // Expired, missing or another account's token: biometric was forgotten.
      await biometric.refresh();
      showMessage({
        message: t("auth.biometric.session_expired"),
        type: "warning",
        backgroundColor: SEMANTIC.warning,
      });
    }
    catch {
      showMessage({ message: t("auth.errors.server_unreachable"), type: "danger", backgroundColor: SEMANTIC.error });
    }
    finally {
      setBiometricSubmitting(false);
    }
  }

  return { biometricSubmitting, onBiometricSignIn };
}

type BiometricSignInProps = {
  biometric: ReturnType<typeof useBiometric>;
  submitting: boolean;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
};

function BiometricSignIn({ biometric, submitting: biometricSubmitting, onPress: onBiometricSignIn, styles }: BiometricSignInProps) {
  const { t } = useTranslation();
  const BiometricIcon
    = biometric.kind === "face"
      ? FaceMask
      : biometric.kind === "fingerprint"
        ? Fingerprint
        : LockKey;

  return (
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
  );
}

async function maybePromptEnableBiometric(biometric: ReturnType<typeof useBiometric>, t: TFunction, email: string) {
  // Read the stored binding fresh: the hook state predates this login, which
  // may have just forgotten another account's biometric sign-in.
  if (!biometric.ready || !biometric.isAvailable || await isBiometricBoundTo(email))
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

export default function LoginScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const biometric = useBiometric();
  const [showPassword, setShowPassword] = React.useState(false);
  const { biometricSubmitting, onBiometricSignIn } = useBiometricSignIn(biometric);
  const [serverWaking, setServerWaking] = React.useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit({ email, password }: LoginFormData) {
    // Render cold starts take 25-50 s: explain the wait instead of looking stuck.
    const wakingTimer = setTimeout(setServerWaking, SERVER_WAKING_HINT_MS, true);
    try {
      const res = await authApi.login({ email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      await completeLogin({ user, accessToken, refreshToken });
      // Post-login: offer biometric enrollment (does not block navigation).
      maybePromptEnableBiometric(biometric, t, user.email || email).catch(() => {});
    }
    catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        // Unverified account. Self-registration (and its email code) is gone:
        // every account is created through an admin invitation, so this is a
        // guard for legacy accounts only.
        showMessage({
          message: t("auth.errors.account_not_activated"),
          type: "warning",
          backgroundColor: SEMANTIC.warning,
        });
        return;
      }
      showMessage({ message: t(loginErrorKey(err)), type: "danger", backgroundColor: SEMANTIC.error });
    }
    finally {
      clearTimeout(wakingTimer);
      setServerWaking(false);
    }
  }

  const showBiometric = biometric.ready && biometric.isAvailable && biometric.enabled;

  return (
    <AuthScreenWrapper>
      <View style={styles.header}><BrandMark size="md" /></View>
      <Text style={styles.title}>{t("auth.login")}</Text>
      <Text style={styles.subtitle}>{t("auth.welcome_back")}</Text>

      {showBiometric && (
        <BiometricSignIn
          biometric={biometric}
          submitting={biometricSubmitting}
          onPress={onBiometricSignIn}
          styles={styles}
        />
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
        <Text style={styles.footerText}>{t("auth.join_via_unit_registration")}</Text>
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
  const passwordRef = React.useRef<TextInput>(null);
  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput label={t("auth.email")} accessibilityLabel={t("auth.email")} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email ? t(errors.email.message as string) : undefined} keyboardType="email-address" autoComplete="email" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput
            ref={passwordRef}
            label={t("auth.password")}
            accessibilityLabel={t("auth.password")}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password ? t(errors.password.message as string) : undefined}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={onSubmitEditing}
            rightSlot={<PasswordToggle visible={showPassword} onToggle={onTogglePassword} />}
          />
        )}
      />
    </View>
  );
}
