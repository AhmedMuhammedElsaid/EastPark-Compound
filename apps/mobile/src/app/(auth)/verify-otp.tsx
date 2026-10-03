import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import OTPTextInput from "react-native-otp-textinput";
import { AuthScreenWrapper } from "@/components/auth/auth-screen-wrapper";

import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { authApi } from "@/services/api/auth";
import { completeLogin } from "@/services/auth/session";
import { BRAND, FONT, SEMANTIC, SPACING } from "@/theme/tokens";

const RESEND_COOLDOWN = 60;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    header: { alignItems: "center" as const, marginTop: SPACING.xl, marginBottom: SPACING["2xl"] },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, color: colors.text, textAlign: "center" as const, marginBottom: SPACING.sm },
    subtitle: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const },
    emailHint: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: BRAND.gold, textAlign: "center" as const, marginTop: SPACING.xs, marginBottom: SPACING["2xl"] },
    otpContainer: { alignItems: "center" as const, marginBottom: SPACING.xl },
    otpRow: { justifyContent: "center" as const, gap: SPACING.sm },
    otpBox: { width: 48, height: 56, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, color: colors.text, fontFamily: FONT.sans, fontSize: 22, fontWeight: "700" },
    resendRow: { alignItems: "center" as const, marginTop: SPACING.lg },
    resendLink: { fontFamily: FONT.sans, fontSize: 14, color: BRAND.gold, fontWeight: "600" },
    resendTimer: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted },
    resendDisabled: { opacity: 0.5 },
  }), [colors]);
}

export default function VerifyOtpScreen() {
  const { t } = useTranslation();
  const { email, resent } = useLocalSearchParams<{ email: string; resent?: string }>();
  const colors = useAppColors();
  const styles = useStyles();
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  // Arriving from login already triggered a resend: start the cooldown.
  const [cooldown, setCooldown] = React.useState(resent === "1" ? RESEND_COOLDOWN : 0);

  React.useEffect(() => {
    if (!email) {
      router.replace("/(auth)/register");
    }
  }, [email]);

  React.useEffect(() => {
    if (cooldown <= 0)
      return;
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleVerify(code?: string) {
    const otpToVerify = code ?? otp;
    if (otpToVerify.length < 6 || !email)
      return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email, otpToVerify);
      const { user, accessToken, refreshToken } = res.data.data;
      await completeLogin({ user, accessToken, refreshToken });
    }
    catch {
      showMessage({ message: t("auth.errors.invalid_otp"), type: "danger", backgroundColor: SEMANTIC.error });
    }
    finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending || !email)
      return;
    setResending(true);
    try {
      await authApi.resendOtp(email);
      setCooldown(RESEND_COOLDOWN);
      showMessage({ message: t("auth.otp_resent"), type: "success", backgroundColor: SEMANTIC.success });
    }
    catch {
      showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });
    }
    finally {
      setResending(false);
    }
  }

  if (!email)
    return null;

  return (
    <AuthScreenWrapper>
      <View style={styles.header}><BrandMark size="sm" /></View>
      <Text style={styles.title}>{t("auth.verify_otp")}</Text>
      <Text style={styles.subtitle}>{t("auth.otp_sent")}</Text>
      <Text style={styles.emailHint}>{email}</Text>
      <View style={styles.otpContainer}>
        <OTPTextInput
          inputCount={6}
          handleTextChange={(code) => {
            setOtp(code);
            if (code.length === 6)
              handleVerify(code);
          }}
          tintColor={BRAND.gold}
          offTintColor={colors.border}
          textInputStyle={styles.otpBox as any}
          containerStyle={styles.otpRow}
          keyboardType="numeric"
        />
      </View>
      <GoldButton label={t("common.confirm")} onPress={() => handleVerify()} loading={loading} disabled={otp.length < 6} />
      <View style={styles.resendRow}>
        {cooldown > 0
          ? <Text style={styles.resendTimer}>{t("auth.resend_in", { seconds: cooldown })}</Text>
          : <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleResend(); }} disabled={resending} hitSlop={8}><Text style={[styles.resendLink, resending && styles.resendDisabled]}>{t("auth.resend_otp")}</Text></Pressable>}
      </View>
    </AuthScreenWrapper>
  );
}
