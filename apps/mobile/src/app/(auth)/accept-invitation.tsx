import type { Control, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
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
import { newPasswordSchema } from "@/lib/auth/password";
import { isAdminRole } from "@/lib/roles";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { authApi } from "@/services/api/auth";
import { completeLogin } from "@/services/auth/session";
import { BRAND, FONT, SEMANTIC, SPACING } from "@/theme/tokens";

const schema = z.object({
  name: z.string().min(2, "auth.errors.name_too_short"),
  password: newPasswordSchema,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: "auth.errors.passwords_no_match", path: ["confirmPassword"] });
type FormData = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    header: { alignItems: "center" as const, marginTop: SPACING.xl, marginBottom: SPACING.xl },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, color: colors.text, textAlign: "center" as const, marginBottom: SPACING.md },
    roleBadgeRow: { alignItems: "center" as const, marginBottom: SPACING.xl },
    roleBadge: { borderWidth: 1.5, borderColor: BRAND.gold, borderRadius: 9999, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs },
    roleBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, color: BRAND.gold, letterSpacing: 1 },
    form: { gap: SPACING.xs, marginBottom: SPACING.sm },
    bottomPad: { height: SPACING["2xl"] },
    errorCard: { flex: 1, justifyContent: "center" as const, paddingHorizontal: SPACING.base },
    errorBorder: { borderLeftWidth: 4, borderRadius: 8, backgroundColor: colors.card, padding: SPACING.lg, gap: SPACING.sm },
    errorTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    errorBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  }), [colors]);
}

export default function AcceptInvitationScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string; role?: string }>();
  const styles = useStyles();
  // confirmedRole is set from the API response, not from the URL param, to reflect what the backend actually assigned
  const [confirmedRole, setConfirmedRole] = React.useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  async function onSubmit({ name, password }: FormData) {
    if (!token)
      return;
    try {
      const res = await authApi.acceptInvitation(token, name, password);
      const { user, accessToken, refreshToken } = res.data.data;
      setConfirmedRole(user.role);
      // Routes MERCHANT → merchant dashboard, ADMIN → admin, else tabs.
      await completeLogin({ user, accessToken, refreshToken });
    }
    catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // 409: the invited email already has an account — the password field
      // must contain that account's CURRENT password.
      const message = status === 409
        ? t("auth.errors.invitation_existing_account")
        : t("common.error");
      showMessage({ message, type: "danger", backgroundColor: SEMANTIC.error });
    }
  }

  if (!token) {
    return (
      <AuthScreenWrapper scrollable={false}>
        <View style={styles.header}><BrandMark size="md" /></View>
        <View style={styles.errorCard}>
          <View style={[styles.errorBorder, { borderLeftColor: SEMANTIC.error }]}>
            <Text style={styles.errorTitle}>{t("auth.invitation_invalid")}</Text>
            <Text style={styles.errorBody}>{t("auth.contact_administrator")}</Text>
          </View>
        </View>
      </AuthScreenWrapper>
    );
  }

  return (
    <AuthScreenWrapper>
      <View style={styles.header}><BrandMark size="md" /></View>
      <Text style={styles.title}>{t("auth.accept_invitation")}</Text>
      {confirmedRole != null && (
        <View style={styles.roleBadgeRow}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{isAdminRole(confirmedRole) ? t("auth.role_admin") : t("auth.role_merchant")}</Text>
          </View>
        </View>
      )}
      <InvitationForm control={control} errors={errors} onSubmitEditing={handleSubmit(onSubmit)} />
      <GoldButton label={t("auth.complete_setup")} onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      <View style={styles.bottomPad} />
    </AuthScreenWrapper>
  );
}

function InvitationForm({ control, errors, onSubmitEditing }: { control: Control<FormData>; errors: FieldErrors<FormData>; onSubmitEditing: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useAppColors();
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput label={t("auth.name")} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name ? t(errors.name.message as string) : undefined} autoComplete="name" returnKeyType="next" />
        )}
      />
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
            returnKeyType="next"
            rightSlot={(
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPwd(v => !v); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPwd ? t("auth.hide_password") : t("auth.show_password")}>
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
            onSubmitEditing={onSubmitEditing}
            rightSlot={(
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowConfirm(v => !v); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={showConfirm ? t("auth.hide_password") : t("auth.show_password")}>
                {showConfirm ? <EyeSlash size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
              </Pressable>
            )}
          />
        )}
      />
    </View>
  );
}
