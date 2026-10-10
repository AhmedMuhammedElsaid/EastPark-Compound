import type { ColorSchemeType } from "@/lib/hooks/use-selected-theme";
import type { LIGHT } from "@/theme/tokens";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { CaretRight, ChatCircle, FaceMask, Fingerprint, Heart, LockKey, Package, ShieldCheck, SignOut, Storefront, User, WarningOctagon } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/ui/app-header";
import { isSameEmail } from "@/lib/biometric-binding";
import { showConfirm } from "@/lib/confirm-dialog";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useBiometric } from "@/lib/hooks/use-biometric";
import { useRefreshProfileUnits } from "@/lib/hooks/use-profile-units";
import { useSelectedTheme } from "@/lib/hooks/use-selected-theme";
import { useSelectedLanguage } from "@/lib/i18n";
import { isAdminRole, roleLabelKey } from "@/lib/roles";
import { getPrimaryUnit, getUnitLabels } from "@/lib/units";
import { usersApi } from "@/services/api/users";
import { endDeletedAccountSession, signOut } from "@/services/auth/session";
import { useAppSelector } from "@/store";
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppColors = typeof DARK | typeof LIGHT;
type AppStyles = ReturnType<typeof buildStyles>;

// ─── Style factory (pure — no hook calls) ─────────────────────────────────────

// eslint-disable-next-line max-lines-per-function -- one flat style sheet
function buildStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.md, paddingBottom: SPACING["2xl"] },
    guestCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      alignItems: "center" as const,
      gap: SPACING.sm,
    },
    guestIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    guestPrompt: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: colors.text, textAlign: "center" as const },
    guestSubtitle: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
    signInBtn: {
      minHeight: 48,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginTop: SPACING.sm,
    },
    signInBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    avatarCard: {
      flexDirection: "row" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.base,
      alignItems: "center" as const,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${BRAND.gold}1f`,
      borderWidth: 2,
      borderColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    avatarInitial: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 26, lineHeight: 40, color: gold(colors) },
    avatarInfo: { flex: 1, gap: 2 },
    userName: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: colors.text },
    userEmail: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    badgeRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.xs, marginTop: SPACING.xs },
    badge: { backgroundColor: `${BRAND.gold}1f`, paddingHorizontal: SPACING.md, paddingVertical: 2, borderRadius: RADIUS.full },
    badgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, color: gold(colors) },
    userUnit: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: gold(colors), fontWeight: "600" },
    section: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.xs,
    },
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginBottom: SPACING.xs },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      minHeight: 52,
      gap: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    unitRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      minHeight: 48,
      gap: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    rowIconWrapDanger: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${SEMANTIC.error}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    rowLabel: { flex: 1, fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.text, fontWeight: "500" },
    rowLabelDanger: { flex: 1, fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.textMuted, fontWeight: "500" },
    segmentRow: {
      flexDirection: "row" as const,
      backgroundColor: colors.bg,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      height: 44,
      borderRadius: RADIUS.sm,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    segmentActive: { backgroundColor: BRAND.gold },
    segmentText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "500" },
    segmentTextActive: { color: BRAND.ink, fontWeight: "700" },
    securityRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      minHeight: 56,
      gap: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    securityCol: { flex: 1 },
    securityLabel: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.text, fontWeight: "500" },
    securitySubtitle: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  });
}

function gold(colors: AppColors): string {
  return "primaryText" in colors ? colors.primaryText : BRAND.gold;
}

// ─── Single hook — called once at the top level ───────────────────────────────

function useStyles(): { styles: AppStyles; colors: AppColors } {
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  return { styles, colors };
}

// ─── Root screen — only place useStyles() is called ──────────────────────────

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useStyles();
  const user = useAppSelector(s => s.auth.user);
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Same name as the tab ("حسابي" / "Profile"): one name per screen. */}
      <AppHeader title={t("profile.tab_label")} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {isAuthenticated && user
          ? <AuthenticatedProfile user={user} styles={styles} colors={colors} />
          : <GuestProfile styles={styles} colors={colors} />}
      </ScrollView>
    </View>
  );
}

// ─── Auth/Guest views ─────────────────────────────────────────────────────────

function GuestProfile({ styles, colors }: { styles: AppStyles; colors: AppColors }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.guestCard}>
        <View style={styles.guestIcon}><User size={30} color={gold(colors)} weight="duotone" /></View>
        <Text style={styles.guestPrompt}>{t("profile.guest_prompt")}</Text>
        <Text style={styles.guestSubtitle}>{t("profile.guest_subtitle")}</Text>
        <Pressable
          style={({ pressed }) => [styles.signInBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(auth)/login");
          }}
          accessibilityRole="button"
          accessibilityLabel={t("auth.login")}
        >
          <Text style={styles.signInBtnText}>{t("auth.login")}</Text>
        </Pressable>
      </View>
      <PreferencesSection styles={styles} />
    </>
  );
}

function AuthenticatedProfile({ user, styles, colors }: { user: any; styles: AppStyles; colors: AppColors }) {
  const { t } = useTranslation();
  useRefreshProfileUnits();
  const biometric = useBiometric();
  const { mutate: deleteAccount } = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    // Local teardown always runs, even if clearing the biometric preference fails.
    onSuccess: () => endDeletedAccountSession(),
    onError: () => {
      showMessage({ message: t("profile.delete_account_error"), type: "danger" });
    },
  });

  async function handleLogout() {
    // Dismiss first, the sign-out action last and destructive.
    const confirmed = await showConfirm({
      title: t("auth.logout_confirm_title"),
      message: t("auth.logout_confirm_body"),
      confirmLabel: t("auth.logout"),
      destructive: true,
    });
    // Keeps the refresh token only when biometric sign-in is on for this
    // account; otherwise revokes it server-side and deletes it.
    if (confirmed)
      signOut(user.email);
  }

  async function handleDeleteAccount() {
    const confirmed = await showConfirm({
      title: t("profile.delete_account"),
      message: t("profile.delete_account_confirm"),
      confirmLabel: t("profile.delete_account_button"),
      destructive: true,
    });
    if (confirmed)
      deleteAccount();
  }

  return (
    <>
      <UserAvatar name={user.name} unitNumber={getPrimaryUnit(user)} email={user.email} role={user.role} styles={styles} />
      <UnitsSection units={getUnitLabels(user)} primary={getPrimaryUnit(user)} styles={styles} />
      <ManagementSection role={user.role} styles={styles} colors={colors} />
      <AccountSection role={user.role} styles={styles} colors={colors} />
      {biometric.ready && biometric.isAvailable && (
        <SecuritySection
          biometric={biometric}
          enabledForAccount={biometric.enabled && isSameEmail(biometric.email, user.email)}
          userEmail={user.email}
          styles={styles}
          colors={colors}
        />
      )}
      <PreferencesSection styles={styles} />
      <DangerSection onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} styles={styles} />
    </>
  );
}

// ─── Section sub-components ───────────────────────────────────────────────────

function UserAvatar({ name, unitNumber, email, role, styles }: { name: string; unitNumber?: string; email: string; role: string; styles: AppStyles }) {
  const { t } = useTranslation();
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <View style={styles.avatarCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
      <View style={styles.avatarInfo}>
        <Text style={styles.userName} numberOfLines={1}>{name}</Text>
        <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t(roleLabelKey(role))}</Text>
          </View>
          {unitNumber
            ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t("checkout.unit", { number: unitNumber })}</Text>
                </View>
              )
            : null}
        </View>
      </View>
    </View>
  );
}

function UnitsSection({ units, primary, styles }: { units: string[]; primary: string; styles: AppStyles }) {
  const { t } = useTranslation();
  if (units.length < 2)
    return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("profile.my_units")}</Text>
      {units.map(label => (
        <View key={label} style={styles.unitRow}>
          <Text style={styles.rowLabel}>{t("checkout.unit", { number: label })}</Text>
          {label === primary ? <Text style={styles.userUnit}>{t("profile.primary_unit")}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function ManagementSection({ role, styles, colors }: { role: string; styles: AppStyles; colors: AppColors }) {
  const { t } = useTranslation();
  const admin = isAdminRole(role);
  if (!admin && role !== "MERCHANT")
    return null;
  const g = gold(colors);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("profile.management")}</Text>
      {admin && (
        <ProfileRow icon={<ShieldCheck size={20} color={g} />} label={t("profile.admin_dashboard")} onPress={() => router.push("/(admin)")} styles={styles} colors={colors} />
      )}
      {role === "MERCHANT" && (
        <ProfileRow icon={<Storefront size={20} color={g} />} label={t("profile.merchant_dashboard")} onPress={() => router.push("/(merchant)/dashboard")} styles={styles} colors={colors} />
      )}
    </View>
  );
}

function AccountSection({ role, styles, colors }: { role: string; styles: AppStyles; colors: AppColors }) {
  const { t } = useTranslation();
  const g = gold(colors);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("profile.account")}</Text>
      <ProfileRow icon={<Package size={20} color={g} />} label={t("profile.my_orders")} onPress={() => router.push("/(tabs)/orders")} styles={styles} colors={colors} />
      <ProfileRow icon={<ChatCircle size={20} color={g} />} label={t("profile.my_feedback")} onPress={() => router.push("/(tabs)/community/feedback?from=profile")} styles={styles} colors={colors} />
      {/* Saving shops is RESIDENT-only (the shop heart is hidden for other roles too). */}
      {role === "RESIDENT" && (
        <ProfileRow icon={<Heart size={20} color={g} />} label={t("profile.saved_shops")} onPress={() => router.push("/(tabs)/profile/saved-shops")} styles={styles} colors={colors} />
      )}
    </View>
  );
}

function PreferencesSection({ styles }: { styles: AppStyles }) {
  const { t } = useTranslation();
  const { language, setLanguage } = useSelectedLanguage();
  const { selectedTheme, setSelectedTheme } = useSelectedTheme();

  const themes: { value: ColorSchemeType; label: string }[] = [
    { value: "dark", label: t("profile.dark") },
    { value: "light", label: t("profile.light") },
    { value: "system", label: t("profile.system") },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("profile.language")}</Text>
      <View style={styles.segmentRow}>
        {(["en", "ar"] as const).map(lang => (
          <Pressable
            key={lang}
            style={({ pressed }) => [styles.segment, language === lang && styles.segmentActive, pressed && { opacity: 0.85 }]}
            onPress={async () => {
              if (lang === language)
                return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // The switch restarts the app: ask first.
              const confirmed = await showConfirm({
                title: t("profile.language_restart_title"),
                message: t("profile.language_restart_body"),
                confirmLabel: t("profile.language_restart_confirm"),
              });
              if (confirmed)
                setLanguage(lang);
            }}
            accessibilityRole="radio"
            accessibilityLabel={lang === "en" ? t("profile.english") : t("profile.arabic")}
            accessibilityState={{ checked: language === lang }}
          >
            <Text style={[styles.segmentText, language === lang && styles.segmentTextActive]}>
              {lang === "en" ? t("profile.english") : t("profile.arabic")}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>{t("profile.theme")}</Text>
      <View style={styles.segmentRow}>
        {themes.map(({ value, label }) => (
          <Pressable
            key={value}
            style={({ pressed }) => [styles.segment, selectedTheme === value && styles.segmentActive, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTheme(value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selectedTheme === value }}
          >
            <Text style={[styles.segmentText, selectedTheme === value && styles.segmentTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DangerSection({ onLogout, onDeleteAccount, styles }: { onLogout: () => void; onDeleteAccount: () => void; styles: AppStyles }) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Pressable
        style={({ pressed }) => [styles.row, { borderTopWidth: 0 }, pressed && styles.pressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onLogout();
        }}
        accessibilityRole="button"
        accessibilityLabel={t("auth.logout")}
      >
        <View style={styles.rowIconWrapDanger}><SignOut mirrored={I18nManager.isRTL} size={20} color={SEMANTIC.error} /></View>
        <Text style={styles.rowLabelDanger}>{t("auth.logout")}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onDeleteAccount();
        }}
        accessibilityRole="button"
        accessibilityLabel={t("profile.delete_account")}
      >
        <View style={styles.rowIconWrapDanger}><WarningOctagon size={20} color={SEMANTIC.error} /></View>
        <Text style={styles.rowLabelDanger}>{t("profile.delete_account")}</Text>
      </Pressable>
    </View>
  );
}

function ProfileRow({ icon, label, onPress, styles, colors }: { icon: React.ReactNode; label: string; onPress: () => void; styles: AppStyles; colors: AppColors }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <CaretRight mirrored={I18nManager.isRTL} size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function SecuritySection({
  biometric,
  enabledForAccount,
  userEmail,
  styles,
  colors,
}: {
  biometric: ReturnType<typeof useBiometric>;
  /** Biometric sign-in is on AND bound to the signed-in account. */
  enabledForAccount: boolean;
  userEmail: string;
  styles: AppStyles;
  colors: AppColors;
}) {
  const { t } = useTranslation();
  const Icon
    = biometric.kind === "face"
      ? FaceMask
      : biometric.kind === "fingerprint"
        ? Fingerprint
        : LockKey;
  const labelKey = `auth.biometric.kind.${biometric.kind}`;

  async function handleToggle(next: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next) {
      const ok = await biometric.enable(userEmail);
      if (!ok) {
        showMessage({
          message: t("profile.biometric_setup_failed"),
          type: "warning",
          backgroundColor: SEMANTIC.warning,
        });
      }
    }
    else {
      await biometric.disable();
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("profile.security")}</Text>
      <View style={styles.securityRow}>
        <View style={styles.rowIconWrap}>
          <Icon size={20} color={gold(colors)} weight="duotone" />
        </View>
        <View style={styles.securityCol}>
          <Text style={styles.securityLabel}>
            {t("profile.biometric_login", { kind: t(labelKey) })}
          </Text>
          <Text style={styles.securitySubtitle}>
            {enabledForAccount
              ? t("profile.biometric_login_subtitle_on")
              : t("profile.biometric_login_subtitle_off")}
          </Text>
        </View>
        <Switch
          value={enabledForAccount}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: BRAND.gold }}
          thumbColor={enabledForAccount ? DARK.text : colors.textMuted}
          accessibilityLabel={t("profile.biometric_login", { kind: t(labelKey) })}
        />
      </View>
    </View>
  );
}
