import type { AxiosResponse } from "axios";
import type { Invitation, InvitationRole } from "@/services/api/admin";
import type { RootState } from "@/store";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";

import { sendInvitationErrorKey } from "@/lib/api-error";
import { showConfirm } from "@/lib/confirm-dialog";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { isSuperAdminRole, roleLabelKey } from "@/lib/roles";
import { adminApi } from "@/services/api/admin";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    newBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    newBtnActive: { backgroundColor: colors.elevated },
    scroll: { padding: SPACING.base, gap: SPACING.sm },
    form: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.xs,
      marginBottom: SPACING.md,
    },
    formLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.textMuted },
    input: {
      height: 48,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.text,
      marginTop: 4,
    },
    roleRow: { flexDirection: "row" as const, gap: SPACING.sm, marginTop: 4 },
    roleBtn: {
      flex: 1,
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: colors.bg,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roleBtnActive: { borderColor: BRAND.gold, backgroundColor: BRAND.gold },
    roleBtnText: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 13, lineHeight: 20, color: colors.textMuted },
    roleBtnTextActive: { color: BRAND.ink, fontWeight: "700" },
    sendBtn: {
      height: 48,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginTop: SPACING.sm,
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    row: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
    },
    rowMain: { flex: 1, gap: 4 },
    rowEmail: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    rowDate: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    rowRight: { gap: SPACING.xs, alignItems: "flex-end" as const },
    rolePill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f` },
    rolePillText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
    statusPillText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: colors.text },
    loadMoreBtn: { alignItems: "center" as const, justifyContent: "center" as const, minHeight: 48 },
    loadMoreText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
  }), [colors]);
}

type InviteFormProps = {
  email: string;
  onEmailChange: (value: string) => void;
  role: InvitationRole;
  onRoleChange: (role: InvitationRole) => void;
  roleOptions: InvitationRole[];
  isPending: boolean;
  onSend: () => void;
  styles: ReturnType<typeof useStyles>;
};

function InviteForm({ email, onEmailChange, role, onRoleChange, roleOptions, isPending, onSend, styles }: InviteFormProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>{t("admin.email")}</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={t("admin.email")}
      />

      <Text style={[styles.formLabel, { marginTop: SPACING.sm }]}>{t("admin.role")}</Text>
      <View style={styles.roleRow}>
        {roleOptions.map(r => (
          <Pressable
            key={r}
            style={[styles.roleBtn, role === r && styles.roleBtnActive]}
            onPress={() => onRoleChange(r)}
            accessibilityRole="button"
            accessibilityState={{ selected: role === r }}
          >
            <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
              {t(roleLabelKey(r))}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.sendBtn, (!email.trim() || isPending) && styles.sendBtnDisabled, pressed && styles.pressed]}
        accessibilityRole="button"
        onPress={onSend}
        disabled={!email.trim() || isPending}
      >
        <Text style={styles.sendBtnText}>{t("admin.send_invite")}</Text>
      </Pressable>
    </View>
  );
}

function useInvitationsQuery() {
  return useInfiniteQuery<
    AxiosResponse<{ data: { items: Invitation[]; nextCursor: string | null } }>,
    Error,
    { pages: AxiosResponse<{ data: { items: Invitation[]; nextCursor: string | null } }>[] },
    string[],
    string | undefined
  >({
    queryKey: ["admin-invitations"],
    queryFn: ({ pageParam }) => adminApi.getInvitations({ cursor: pageParam, limit: 20 }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
  });
}

export default function InvitationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const userRole = useSelector((state: RootState) => state.auth.user?.role);
  const roleOptions: InvitationRole[] = isSuperAdminRole(userRole) ? ["MERCHANT", "ADMIN"] : ["MERCHANT"];

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<InvitationRole>("MERCHANT");
  const [showForm, setShowForm] = React.useState(false);

  const { data, isError, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useInvitationsQuery();

  const { mutate: sendInvite, isPending } = useMutation({
    mutationFn: () => adminApi.sendInvitation(email.trim().toLowerCase(), role),
    onSuccess: () => {
      setEmail("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
      showMessage({ message: t("admin.invite_sent"), type: "success", backgroundColor: SEMANTIC.success });
    },
    onError: (err) => {
      showMessage({ message: t(sendInvitationErrorKey(err)), type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  async function handleSend() {
    if (!email.trim())
      return;
    const confirmed = await showConfirm({
      title: t("admin.send_invite"),
      message: `${email.trim()} · ${t(roleLabelKey(role))}`,
      confirmLabel: t("admin.send_invite"),
    });
    if (confirmed)
      sendInvite();
  }

  const invitations = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("admin.invitations")}
        right={(
          <Pressable
            style={({ pressed }) => [styles.newBtn, showForm && styles.newBtnActive, pressed && styles.pressed]}
            onPress={() => setShowForm(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={t("admin.send_invite")}
          >
            {showForm ? <X size={20} color={colors.text} /> : <Plus size={20} color={BRAND.ink} />}
          </Pressable>
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        {showForm && (
          <InviteForm
            email={email}
            onEmailChange={setEmail}
            role={role}
            onRoleChange={setRole}
            roleOptions={roleOptions}
            isPending={isPending}
            onSend={handleSend}
            styles={styles}
          />
        )}

        {isError && !data
          ? <ErrorState onRetry={() => refetch()} />
          : isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={`inv-sk-${i}`} width="100%" height={72} borderRadius={RADIUS.md} style={{ marginBottom: SPACING.sm }} />
              ))
            : invitations.map(inv => <InvitationRow key={inv.id} invitation={inv} styles={styles} />)}

        {hasNextPage && (
          <Pressable
            style={styles.loadMoreBtn}
            accessibilityRole="button"
            onPress={() => {
              if (!isFetchingNextPage)
                fetchNextPage();
            }}
            disabled={isFetchingNextPage}
          >
            <Text style={styles.loadMoreText}>{t("common.load_more")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function InvitationRow({ invitation, styles }: { invitation: Invitation; styles: any }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const isUsed = !!invitation.usedAt;
  const isExpired = !isUsed && new Date(invitation.expiresAt) < new Date();
  const statusKey = isUsed ? "admin.used" : isExpired ? "admin.expired" : "admin.pending";
  const statusColor = isUsed ? SEMANTIC.success : isExpired ? SEMANTIC.error : SEMANTIC.warning;

  const date = new Date(invitation.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowEmail} numberOfLines={1}>{invitation.email}</Text>
        <Text style={styles.rowDate}>{date}</Text>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>
            {t(roleLabelKey(invitation.role))}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}33` }]}>
          <Text style={styles.statusPillText}>{t(statusKey)}</Text>
        </View>
      </View>
    </View>
  );
}
