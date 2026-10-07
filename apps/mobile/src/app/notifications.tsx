import type { InfiniteData } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import type { Href } from "expo-router";
import type { AppNotification, NotificationPage } from "@/services/api/notifications";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { BellSlash } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { notificationsApi } from "@/services/api/notifications";
import { getNotificationHref } from "@/services/notifications/routing";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    markAllBtn: { minHeight: 44, paddingHorizontal: SPACING.md, justifyContent: "center" as const },
    markAllBtnDisabled: { opacity: 0.4 },
    markAllText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    listContent: { padding: SPACING.base },
    card: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      marginBottom: SPACING.sm,
      gap: SPACING.sm,
    },
    cardUnread: { backgroundColor: colors.elevated, borderColor: `${BRAND.gold}55` },
    typeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 8,
      flexShrink: 0,
    },
    cardContent: { flex: 1, gap: 4 },
    cardTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: SPACING.sm },
    cardTitle: { flex: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    cardTime: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted, flexShrink: 0 },
    cardBody: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 21 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: BRAND.gold,
      marginTop: 8,
      flexShrink: 0,
    },
    emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text, textAlign: "center" as const },
    emptySubtitle: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
    skeletonPad: { padding: SPACING.base },
  }), [colors]);
}

const TYPE_COLOR: Record<string, string> = {
  ORDER_UPDATE: BRAND.gold,
  ANNOUNCEMENT: SEMANTIC.info,
  POLL: SEMANTIC.success,
  ELECTION: SEMANTIC.warning,
  FEEDBACK_UPDATE: SEMANTIC.info,
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, isRefetching, refetch }
    = useInfiniteQuery<
      AxiosResponse<{ data: NotificationPage }>,
      Error,
      { pages: AxiosResponse<{ data: NotificationPage }>[] },
      string[],
      string | undefined
    >({
      queryKey: ["notifications"],
      queryFn: ({ pageParam }) =>
        notificationsApi.getNotifications({ cursor: pageParam, limit: 25 }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
      enabled: isAuthenticated,
    });

  const { mutate: markAllRead, isPending: markingAll } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMarkNotificationRead();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const notifications = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];
  // Server-side count covers every page, not just the ones loaded so far.
  const unreadCount = data?.pages.at(-1)?.data.data.unreadCount ?? 0;

  function handleNotificationPress(notification: AppNotification) {
    if (!notification.isRead)
      markRead(notification.id);
    const href = getNotificationHref(notification.type, notification.data);
    if (href)
      router.push(href as Href);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={t("notifications.title")}
        safeTop={false}
        right={unreadCount > 0
          ? (
              <Pressable
                style={[styles.markAllBtn, markingAll && styles.markAllBtnDisabled]}
                onPress={() => markAllRead()}
                disabled={markingAll}
                accessibilityRole="button"
                accessibilityLabel={t("notifications.mark_all_read")}
              >
                <Text style={styles.markAllText}>{t("notifications.mark_all_read")}</Text>
              </Pressable>
            )
          : undefined}
      />

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? <NotificationsSkeleton styles={styles} />
          : (
              <FlashList
                data={notifications}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <NotificationItem notification={item} onPress={() => handleNotificationPress(item)} styles={styles} colors={colors} />
                )}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                  }
                }}
                onEndReachedThreshold={0.5}
                onRefresh={refetch}
                refreshing={isRefetching}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + SPACING.xl }]}
                ListEmptyComponent={<EmptyState styles={styles} />}
                ListFooterComponent={
                  isFetchingNextPage
                    ? <Skeleton width="100%" height={72} borderRadius={RADIUS.md} style={{ marginTop: SPACING.sm }} />
                    : null
                }
              />
            )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onPress,
  styles,
  colors,
}: {
  notification: AppNotification;
  onPress: () => void;
  styles: any;
  colors: any;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const title = (isAr ? notification.titleAr : notification.title) || notification.title;
  const body = (isAr ? notification.bodyAr : notification.body) || notification.body;
  const timeAgo = formatRelativeTime(notification.createdAt, (key, opts) => String(t(key as any, opts as any)));
  const typeColor = TYPE_COLOR[notification.type] ?? colors.textMuted;

  return (
    <Pressable
      style={[styles.card, !notification.isRead && styles.cardUnread]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardTime}>{timeAgo}</Text>
        </View>
        <Text style={styles.cardBody} numberOfLines={2}>{body}</Text>
      </View>
      {!notification.isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

function EmptyState({ styles }: { styles: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <BellSlash size={44} color={BRAND.gold} weight="duotone" />
      </View>
      <Text style={styles.emptyTitle}>{t("notifications.empty")}</Text>
      <Text style={styles.emptySubtitle}>{t("notifications.empty_subtitle")}</Text>
    </View>
  );
}

function NotificationsSkeleton({ styles }: { styles: any }) {
  return (
    <View style={styles.skeletonPad}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={`notif-sk-${i}`} width="100%" height={72} borderRadius={RADIUS.md} style={{ marginBottom: SPACING.sm }} />
      ))}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flips one item locally instead of refetching every loaded page. */
function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: (id: string) => {
      queryClient.setQueryData<InfiniteData<AxiosResponse<{ data: NotificationPage }>>>(
        ["notifications"],
        old => old && markNotificationRead(old, id),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] }),
    onError: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return mutate;
}

/** Marks one notification read in every loaded page; each page carries the server-wide unread count. */
function markNotificationRead(
  data: InfiniteData<AxiosResponse<{ data: NotificationPage }>>,
  id: string,
): InfiniteData<AxiosResponse<{ data: NotificationPage }>> {
  return {
    ...data,
    pages: data.pages.map((page) => {
      const current = page.data.data;
      const items = current.items.map(n => (n.id === id ? { ...n, isRead: true } : n));
      const unreadCount = Math.max(0, current.unreadCount - 1);
      return { ...page, data: { ...page.data, data: { ...current, items, unreadCount } } };
    }),
  };
}

function formatRelativeTime(iso: string, t: (key: string, opts?: object) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)
    return t("notifications.time_now");
  if (mins < 60)
    return t("notifications.time_minutes", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)
    return t("notifications.time_hours", { count: hrs });
  const days = Math.floor(hrs / 24);
  return t("notifications.time_days", { count: days });
}
