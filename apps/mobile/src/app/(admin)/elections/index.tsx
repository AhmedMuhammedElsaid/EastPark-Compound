import type { AxiosResponse } from "axios";
import type { Election } from "@/services/api/governance";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CaretRight, Plus, Trophy } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatExpiry } from "@/lib/expiry-date";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { governanceApi } from "@/services/api/governance";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type ElectionPage = AxiosResponse<{ data: { items: Election[]; nextCursor: string | null } }>;

const SKELETON_KEYS = ["el-sk-1", "el-sk-2", "el-sk-3", "el-sk-4"];

/** Separate cache entry from the resident tab's `["elections"]` list (different shape); prefix invalidation still reaches it. */
const ADMIN_ELECTIONS_QUERY_KEY = ["elections", "admin"];

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    listContent: { padding: SPACING.base },
    loadingPad: { padding: SPACING.base },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 72,
      gap: SPACING.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
    body: { flex: 1, gap: 2 },
    title: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 24, color: colors.text },
    meta: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    empty: { alignItems: "center", gap: SPACING.md, paddingVertical: SPACING["2xl"] },
    emptyText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" },
    newBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.full, backgroundColor: BRAND.gold },
  });
}

export default function AdminElectionsScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  const isAr = i18n.language === "ar";
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, refetch } = useInfiniteQuery<
    ElectionPage,
    Error,
    { pages: ElectionPage[] },
    string[],
    string | undefined
  >({
    queryKey: ADMIN_ELECTIONS_QUERY_KEY,
    queryFn: ({ pageParam }) => governanceApi.getElections({ cursor: pageParam, limit: 20 }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
  });

  const elections = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("admin.manage_elections")}
        right={(
          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(admin)/elections/new")}
            accessibilityRole="button"
            accessibilityLabel={t("admin.new_election")}
          >
            <Plus size={22} color={BRAND.ink} />
          </Pressable>
        )}
      />
      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.loadingPad}>
                {SKELETON_KEYS.map(key => (
                  <Skeleton key={key} width="100%" height={72} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.sm }} />
                ))}
              </View>
            )
          : (
              <FlashList
                data={elections}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const count = item.candidates.length;
                  return (
                    <Pressable
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      onPress={() => router.push(`/(admin)/elections/${item.id}/candidates`)}
                      accessibilityRole="button"
                      accessibilityLabel={isAr ? item.titleAr : item.title}
                    >
                      <View style={styles.icon}><Trophy size={20} color={gold} /></View>
                      <View style={styles.body}>
                        <Text style={styles.title} numberOfLines={2}>{isAr ? item.titleAr : item.title}</Text>
                        <Text style={styles.meta}>
                          {`${t("admin.candidates_count", { count, total: formatNumber(count, i18n.language) })} · ${t("admin.ends_at", { date: formatExpiry(new Date(item.expiresAt), i18n.language) })}`}
                        </Text>
                      </View>
                      <CaretRight mirrored={I18nManager.isRTL} size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                }}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{ ...styles.listContent, paddingBottom: insets.bottom + SPACING.xl }}
                onRefresh={refetch}
                refreshing={false}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <Trophy size={36} color={gold} />
                    <Text style={styles.emptyText}>{t("admin.no_elections")}</Text>
                  </View>
                )}
                ListFooterComponent={isFetchingNextPage ? <Skeleton width="100%" height={72} borderRadius={RADIUS.lg} /> : null}
              />
            )}
    </View>
  );
}
