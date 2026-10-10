import type { NotificationPreference } from "@/services/api/notifications";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { BellSimple, ChatCircle, CheckSquare, Medal, Megaphone, Package } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { normalizePreferences, withPreference } from "@/lib/notification-preferences";
import { notificationsApi } from "@/services/api/notifications";
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const PREFERENCES_QUERY_KEY = ["notification-preferences"];

type Colors = ReturnType<typeof useAppColors>;
type Styles = ReturnType<typeof buildStyles>;

function buildStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    listContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING["2xl"] },
    intro: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, marginBottom: SPACING.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 64,
      gap: SPACING.md,
      paddingHorizontal: SPACING.base,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.sm,
    },
    iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
    label: { flex: 1, fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, fontWeight: "500", color: colors.text },
    note: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: SPACING.sm },
    skeletonRow: { marginBottom: SPACING.sm },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

const TYPE_ICONS: Record<string, typeof BellSimple> = {
  ORDER_UPDATE: Package,
  ANNOUNCEMENT: Megaphone,
  POLL: CheckSquare,
  ELECTION: Medal,
  FEEDBACK_UPDATE: ChatCircle,
};

/** Per-type notification switches (`GET/PUT /notifications/preferences`). */
export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { styles, colors } = useStyles();
  const queryClient = useQueryClient();

  const { data, isError, isLoading, isRefetching, refetch } = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: () => notificationsApi.getPreferences(),
  });
  const saved = React.useMemo(() => (data ? normalizePreferences(data.data.data) : []), [data]);

  // The switch moves at once; it snaps back if the save fails.
  const [optimistic, setOptimistic] = React.useState<Record<string, boolean>>({});
  const rows = React.useMemo(
    () => Object.entries(optimistic).reduce((list, [type, enabled]) => withPreference(list, type, enabled), saved),
    [saved, optimistic],
  );

  const { mutate, isPending } = useMutation({
    mutationFn: ({ type, enabled }: NotificationPreference) => notificationsApi.updatePreference(type, enabled),
    onMutate: ({ type, enabled }) => setOptimistic(current => ({ ...current, [type]: enabled })),
    onSuccess: (res, { type, enabled }) => {
      // The saved row is authoritative; fall back to the requested value.
      const stored = res.data?.data?.enabled ?? enabled;
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, (old: typeof data) =>
        old ? { ...old, data: { ...old.data, data: withPreference(normalizePreferences(old.data.data), type, stored) } } : old);
    },
    onError: () => {
      showMessage({ message: t("profile.notifications_error"), type: "danger", backgroundColor: SEMANTIC.error });
    },
    onSettled: (_res, _err, { type }) => {
      setOptimistic(({ [type]: _done, ...rest }) => rest);
    },
  });

  function toggle(row: NotificationPreference, enabled: boolean) {
    Haptics.selectionAsync();
    mutate({ type: row.type, enabled });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("profile.notification_prefs")} />
      {isError && !data
        ? <ErrorState onRetry={refetch} />
        : isLoading
          ? <PreferencesSkeleton styles={styles} />
          : (
              <FlashList
                data={rows}
                keyExtractor={item => item.type}
                renderItem={({ item }) => (
                  <PreferenceRow
                    row={item}
                    disabled={isPending}
                    onChange={enabled => toggle(item, enabled)}
                    styles={styles}
                    colors={colors}
                  />
                )}
                contentContainerStyle={styles.listContent}
                onRefresh={refetch}
                refreshing={isRefetching}
                ListHeaderComponent={<Text style={styles.intro}>{t("profile.notifications_subtitle")}</Text>}
                ListFooterComponent={<Text style={styles.note}>{t("profile.notifications_note")}</Text>}
              />
            )}
    </View>
  );
}

function PreferenceRow({ row, disabled, onChange, styles, colors }: {
  row: NotificationPreference;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();
  const Icon = TYPE_ICONS[row.type] ?? BellSimple;
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const label = t(`notifications.type_${row.type}` as any);
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}><Icon size={20} color={gold} /></View>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={row.enabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: BRAND.gold }}
        thumbColor={row.enabled ? DARK.text : colors.textMuted}
        accessibilityLabel={label}
        accessibilityState={{ checked: row.enabled, disabled }}
      />
    </View>
  );
}

function PreferencesSkeleton({ styles }: { styles: Styles }) {
  return (
    <View style={styles.listContent}>
      <Skeleton width="80%" height={18} style={styles.skeletonRow} />
      {["a", "b", "c", "d", "e"].map(k => (
        <Skeleton key={`pref-skeleton-${k}`} width="100%" height={64} borderRadius={RADIUS.lg} style={styles.skeletonRow} />
      ))}
    </View>
  );
}
