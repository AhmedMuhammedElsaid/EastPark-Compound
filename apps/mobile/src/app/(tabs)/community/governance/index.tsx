import type { AxiosResponse } from "axios";
import type { Election, Poll } from "@/services/api/governance";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, CheckSquare } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { governanceApi } from "@/services/api/governance";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    navTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    tabBar: {
      flexDirection: "row" as const,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      height: 48,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: BRAND.gold },
    tabText: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, fontWeight: "500" },
    tabTextActive: { color: BRAND.gold },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, color: colors.textMuted },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    cardVoted: { borderWidth: 1, borderColor: BRAND.gold },
    cardHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
    pollBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      backgroundColor: colors.elevated,
    },
    electionBadge: { backgroundColor: BRAND.goldTint },
    pollBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, color: colors.text },
    votedBadge: { fontFamily: FONT.sans, fontSize: 11, color: BRAND.gold, fontWeight: "600" },
    cardQuestion: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.text, lineHeight: 22 },
    cardMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.xs },
    metaText: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    metaDot: { fontSize: 12, color: colors.textMuted },
  }), [colors]);
}

export default function GovernanceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();
  const [tab, setTab] = React.useState<"polls" | "elections">("polls");

  const pollsQuery = useInfiniteQuery<
    AxiosResponse<{ data: { items: Poll[]; nextCursor: string | null } }>,
    Error,
    { pages: AxiosResponse<{ data: { items: Poll[]; nextCursor: string | null } }>[] },
    string[],
    string | undefined
  >({
    queryKey: ["polls"],
    queryFn: ({ pageParam }) => governanceApi.getPolls({ cursor: pageParam, limit: 20 }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: tab === "polls",
  });

  const electionsQuery = useInfiniteQuery<
    AxiosResponse<{ data: { items: Election[]; nextCursor: string | null } }>,
    Error,
    { pages: AxiosResponse<{ data: { items: Election[]; nextCursor: string | null } }>[] },
    string[],
    string | undefined
  >({
    queryKey: ["elections"],
    queryFn: ({ pageParam }) => governanceApi.getElections({ cursor: pageParam, limit: 20 }),
    getNextPageParam: last => last.data.data.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: tab === "elections",
  });

  const polls = pollsQuery.data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];
  const elections = electionsQuery.data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("governance.title")}</Text>
      </View>

      <View style={styles.tabBar}>
        {(["polls", "elections"] as const).map(key => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {t(`governance.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "polls"
        ? (
            pollsQuery.isLoading
              ? (
                  <View style={styles.loadingPad}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={`gov-sk-${i}`} width="100%" height={96} borderRadius={RADIUS.md} style={{ marginBottom: 12 }} />
                    ))}
                  </View>
                )
              : (
                  <FlashList
                    data={polls}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <PollCard poll={item} styles={styles} />}
                    onEndReached={() => {
                      if (pollsQuery.hasNextPage && !pollsQuery.isFetchingNextPage)
                        pollsQuery.fetchNextPage();
                    }}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={(
                      <View style={styles.empty}>
                        <CheckSquare size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>{t("governance.no_polls")}</Text>
                      </View>
                    )}
                    ListFooterComponent={
                      pollsQuery.isFetchingNextPage
                        ? <Skeleton width="100%" height={96} borderRadius={RADIUS.md} style={{ marginTop: SPACING.sm }} />
                        : null
                    }
                  />
                )
          )
        : (
            electionsQuery.isLoading
              ? (
                  <View style={styles.loadingPad}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={`gov-el-sk-${i}`} width="100%" height={96} borderRadius={RADIUS.md} style={{ marginBottom: 12 }} />
                    ))}
                  </View>
                )
              : (
                  <FlashList
                    data={elections}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <ElectionCard election={item} styles={styles} />}
                    onEndReached={() => {
                      if (electionsQuery.hasNextPage && !electionsQuery.isFetchingNextPage)
                        electionsQuery.fetchNextPage();
                    }}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={(
                      <View style={styles.empty}>
                        <CheckSquare size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>{t("governance.no_elections")}</Text>
                      </View>
                    )}
                    ListFooterComponent={
                      electionsQuery.isFetchingNextPage
                        ? <Skeleton width="100%" height={96} borderRadius={RADIUS.md} style={{ marginTop: SPACING.sm }} />
                        : null
                    }
                  />
                )
          )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PollCard({ poll, styles }: { poll: Poll; styles: any }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const question = isAr ? poll.questionAr : poll.question;
  const expiry = new Date(poll.expiresAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      style={[styles.card, !!poll.myVoteOptionId && styles.cardVoted]}
      onPress={() => router.push(`/(tabs)/community/governance/polls/${poll.id}`)}
      accessibilityRole="button"
      accessibilityLabel={question}
    >
      <View style={styles.cardHeader}>
        <View style={styles.pollBadge}>
          <Text style={styles.pollBadgeText}>{t("governance.polls")}</Text>
        </View>
        {!!poll.myVoteOptionId && (
          <Text style={styles.votedBadge}>{t("governance.voted")}</Text>
        )}
      </View>
      <Text style={styles.cardQuestion} numberOfLines={3}>{question}</Text>
      <View style={styles.cardMeta}>
        {poll.totalVotes !== null && (
          <>
            <Text style={styles.metaText}>
              {poll.totalVotes}
              {" "}
              {t("governance.votes_label")}
            </Text>
            <Text style={styles.metaDot}>·</Text>
          </>
        )}
        <Text style={styles.metaText}>{t("governance.expires", { date: expiry })}</Text>
      </View>
    </Pressable>
  );
}

function ElectionCard({ election, styles }: { election: Election; styles: any }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const title = isAr ? election.titleAr : election.title;
  const expiry = new Date(election.expiresAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      style={[styles.card, !!election.myVoteCandidateId && styles.cardVoted]}
      onPress={() => router.push(`/(tabs)/community/governance/elections/${election.id}`)}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.pollBadge, styles.electionBadge]}>
          <Text style={styles.pollBadgeText}>{t("governance.elections")}</Text>
        </View>
        {!!election.myVoteCandidateId && (
          <Text style={styles.votedBadge}>{t("governance.voted")}</Text>
        )}
      </View>
      <Text style={styles.cardQuestion} numberOfLines={2}>{title}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>
          {election.candidates?.length ?? 0}
          {" "}
          {t("governance.candidates").toLowerCase()}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{t("governance.expires", { date: expiry })}</Text>
      </View>
    </Pressable>
  );
}
