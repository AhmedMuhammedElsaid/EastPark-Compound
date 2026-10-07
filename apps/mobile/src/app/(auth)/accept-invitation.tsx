import type { Control, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams } from "expo-router";
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
import { acceptInvitationErrorKey, isInvalidInvitationError } from "@/lib/api-error";
import { invitationPasswordSchema } from "@/lib/auth/password";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { roleLabelKey } from "@/lib/roles";
import { authApi } from "@/services/api/auth";
import { completeLogin } from "@/services/auth/session";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const schema = z.object({
  name: z.string().min(2, "auth.errors.name_too_short"),
  // Not held to the strength rules here: an existing owner enters a current
  // password that may predate them. The backend checks new accounts only.
  password: invitationPasswordSchema,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: "auth.errors.passwords_no_match", path: ["confirmPassword"] });
type FormData = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    header: { alignItems: "center" as const, marginTop: SPACING.xl, marginBottom: SPACING.xl },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36, color: colors.text, textAlign: "center" as const, marginBottom: SPACING.md },
    roleBadgeRow: { alignItems: "center" as const, marginBottom: SPACING.xl },
    roleBadge: { backgroundColor: `${BRAND.gold}1f`, borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs },
    roleBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    form: { gap: SPACING.xs, marginBottom: SPACING.sm },
    existingAccountHint: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.xs },
    bottomPad: { height: SPACING["2xl"] },
    errorCard: { flex: 1, justifyContent: "center" as const, paddingHorizontal: SPACING.base },
    errorBorder: { borderStartWidth: 4, borderRadius: RADIUS.md, backgroundColor: colors.card, padding: SPACING.lg, gap: SPACING.sm },
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
  // Used, expired or unknown invitation: no retry helps, so the form is replaced.
  const [invitationInvalid, setInvitationInvalid] = React.useState(false);
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
      if (isInvalidInvitationError(err)) {
        setInvitationInvalid(true);
        return;
      }
      // 409 accountDeleted / unit alreadyOwned: contact the administration.
      // 409 without a code: the invited email already has an account and the
      // password field must contain its CURRENT password.
      showMessage({ message: t(acceptInvitationErrorKey(err)), type: "danger", backgroundColor: SEMANTIC.error });
    }
  }

  if (!token || invitationInvalid) {
    return (
      <AuthScreenWrapper scrollable={false}>
        <View style={styles.header}><BrandMark size="md" /></View>
        <View style={styles.errorCard}>
          <View style={[styles.errorBorder, { borderStartColor: SEMANTIC.error }]}>
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
            <Text style={styles.roleBadgeText}>{t(roleLabelKey(confirmedRole))}</Text>
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
      {/* The backend has no invitation lookup, so an existing account can't be
          detected up front: tell its owner to use the CURRENT password (the
          backend never changes an existing account's name or password). */}
      <Text style={styles.existingAccountHint}>{t("auth.invitation_existing_account_hint")}</Text>
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
              <PasswordToggle visible={showPwd} onToggle={() => setShowPwd(v => !v)} />
            )}
          />
        )}
      />
      {/* Guidance for a NEW password only; it never blocks submit. */}
      <Text style={styles.existingAccountHint}>{t("auth.errors.password_requirements")}</Text>
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
              <PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
            )}
          />
        )}
      />
    </View>
  );
}
