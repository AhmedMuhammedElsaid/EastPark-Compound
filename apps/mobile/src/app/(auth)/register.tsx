import type { Control, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { authApi } from "@/services/api/auth";
import { BRAND, FONT, SEMANTIC, SPACING } from "@/theme/tokens";

const schema = z.object({
  name: z.string().min(2, "auth.errors.name_too_short"),
  email: z.string().email("auth.errors.invalid_email"),
  phone: z.string().min(8, "auth.errors.invalid_phone"),
  unitNumber: z.string().min(1, "auth.errors.unit_required"),
  password: newPasswordSchema,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: "auth.errors.passwords_no_match", path: ["confirmPassword"] });
type FormData = z.infer<typeof schema>;

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    header: { alignItems: "center" as const, marginTop: SPACING.md, marginBottom: SPACING.lg },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, color: colors.text, textAlign: "center" as const, marginBottom: SPACING.xs },
    subtitle: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, marginBottom: SPACING.lg },
    form: { gap: SPACING.xs },
    footer: { flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, marginTop: SPACING.lg },
    footerText: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted },
    footerLink: { fontFamily: FONT.sans, fontSize: 14, color: BRAND.gold, fontWeight: "600" },
    bottomPad: { height: SPACING["2xl"] },
  }), [colors]);
}

const errorMap: Record<string, string> = {
  EMAIL_TAKEN: "auth.errors.email_taken",
  INVALID_PHONE: "auth.errors.invalid_phone",
  INVALID_UNIT: "auth.errors.invalid_unit",
};

export default function RegisterScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const [showPassword, setShowPassword] = React.useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", unitNumber: "", password: "", confirmPassword: "" },
  });

  async function onSubmit({ name, email, phone, unitNumber, password }: FormData) {
    try {
      await authApi.register({ name, email, phone, unitNumber, password });
      router.push({ pathname: "/(auth)/verify-otp", params: { email } });
    }
    catch (err: any) {
      const serverMsg = err?.response?.data?.message;
      const key = (serverMsg && errorMap[serverMsg]) ? errorMap[serverMsg] : "common.error";
      showMessage({ message: t(key), type: "danger", backgroundColor: SEMANTIC.error });
    }
  }

  return (
    <AuthScreenWrapper>
      <View style={styles.header}><BrandMark size="sm" /></View>
      <Text style={styles.title}>{t("auth.register")}</Text>
      <Text style={styles.subtitle}>{t("auth.register_subtitle")}</Text>
      <RegisterFormIdentity control={control} errors={errors} />
      <RegisterFormPassword control={control} errors={errors} showPassword={showPassword} onTogglePassword={() => setShowPassword(v => !v)} onSubmitEditing={handleSubmit(onSubmit)} />
      <GoldButton label={t("auth.register")} onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t("auth.already_have_account")}
          {" "}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace("/(auth)/login");
          }}
          hitSlop={8}
        >
          <Text style={styles.footerLink}>{t("auth.login")}</Text>
        </Pressable>
      </View>
      <View style={styles.bottomPad} />
    </AuthScreenWrapper>
  );
}

function RegisterFormIdentity({ control, errors }: { control: Control<FormData>; errors: FieldErrors<FormData> }) {
  const { t } = useTranslation();
  const styles = useStyles();
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
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput label={t("auth.email")} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email ? t(errors.email.message as string) : undefined} keyboardType="email-address" autoComplete="email" returnKeyType="next" />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput label={t("auth.phone")} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.phone ? t(errors.phone.message as string) : undefined} keyboardType="phone-pad" returnKeyType="next" />
        )}
      />
      <Controller
        control={control}
        name="unitNumber"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput label={t("auth.unit_number")} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.unitNumber ? t(errors.unitNumber.message as string) : undefined} returnKeyType="next" />
        )}
      />
    </View>
  );
}

type PwProps = { control: Control<FormData>; errors: FieldErrors<FormData>; showPassword: boolean; onTogglePassword: () => void; onSubmitEditing: () => void };
function RegisterFormPassword({ control, errors, showPassword, onTogglePassword, onSubmitEditing }: PwProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useAppColors();
  return (
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
            secureTextEntry={!showPassword}
            returnKeyType="next"
            rightSlot={<Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onTogglePassword(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeSlash size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}</Pressable>}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthInput label={t("auth.confirm_password")} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.confirmPassword ? t(errors.confirmPassword.message as string) : undefined} secureTextEntry={!showPassword} returnKeyType="done" onSubmitEditing={onSubmitEditing} />
        )}
      />
    </View>
  );
}
