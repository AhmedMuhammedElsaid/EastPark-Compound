import type { Poll, PollOption } from "@/services/api/governance";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { CheckCircle, CircleIcon } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { pickErrorKey, VOTE_ERROR_KEYS } from "@/lib/api-error";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { governanceApi, votePercent } from "@/services/api/governance";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, paddingBottom: SPACING.xl },
    question: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 20,
      color: colors.text,
      lineHeight: 32,
      marginBottom: SPACING.sm,
    },
    hint: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 22, marginBottom: SPACING.lg },
    sealedBanner: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      marginBottom: SPACING.md,
      borderStartWidth: 3,
      borderStartColor: BRAND.gold,
    },
    sealedText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 22, color: colors.textMuted },
    options: { gap: SPACING.sm },
    option: {
      minHeight: 56,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.card,
      overflow: "hidden" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    optionSelected: { borderColor: BRAND.gold },
    optionDisabled: { opacity: 0.85 },
    resultBar: {
      position: "absolute" as const,
      start: 0,
      top: 0,
      bottom: 0,
      backgroundColor: `${BRAND.gold}22`,
    },
    optionContent: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.sm,
    },
    optionText: { flex: 1, fontFamily: FONT.sans, fontWeight: "500", fontSize: 14, lineHeight: 22, color: colors.text },
    optionTextSelected: { color: gold },
    optionVotes: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    meta: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.lg, textAlign: "center" as const },
  }), [colors, gold]);
}

export default function PollDetailScreen() {
  const { pollId } = useLocalSearchParams<{ pollId: string }>();
  const { t, i18n } = useTranslation();
  const { requireAuth } = useAuthGuard();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();
  const role = useAppSelector(s => s.auth.user?.role);

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => governanceApi.getPoll(pollId),
    enabled: !!pollId,
  });

  const poll = data?.data.data;
  const isAr = i18n.language === "ar";

  const { mutate, isPending } = useMutation({
    mutationFn: (optionId: string) => governanceApi.votePoll(pollId, optionId),
    onSuccess: () => {
      showMessage({ message: t("governance.vote_submitted"), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (error) => {
      showMessage({ message: t(pickErrorKey(error, VOTE_ERROR_KEYS, "common.error")), type: "danger" });
      // Already voted / expired: refetch so the screen shows the true state.
      queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
    },
  });

  function handleVote(optionId: string, optionText: string) {
    requireAuth(() => {
      Alert.alert(
        t("governance.vote"),
        t("governance.vote_confirm", { option: optionText }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("governance.vote"), onPress: () => mutate(optionId) },
        ],
      );
    });
  }

  if (isError && !poll)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !poll)
    return <PollSkeleton />;

  const question = isAr ? poll.questionAr : poll.question;
  // Backend only includes voteCount once the poll has expired.
  const showResults = poll.resultsVisible;
  const totalVotes = poll.totalVotes;
  const votingClosed = poll.isExpired || new Date(poll.expiresAt).getTime() <= Date.now();
  // Voting is resident-only on the backend; a signed-in admin/merchant would only get a 403.
  const isNonResident = !!role && role !== "RESIDENT";
  const canVote = !poll.myVoteOptionId && !votingClosed && !isNonResident;
  const hint = votingClosed
    ? t("governance.voting_closed")
    : isNonResident
      ? t("governance.residents_only")
      : poll.myVoteOptionId
        ? null
        : t("governance.pick_option");

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("governance.polls")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.question}>{question}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : <View style={{ height: SPACING.lg }} />}

        {poll.myVoteOptionId && !showResults && (
          <View style={styles.sealedBanner}>
            <Text style={styles.sealedText}>{t("governance.sealed")}</Text>
          </View>
        )}

        <OptionsList
          poll={poll}
          isAr={isAr}
          showResults={showResults}
          totalVotes={totalVotes}
          canVote={canVote}
          onVote={handleVote}
          isPending={isPending}
          styles={styles}
          colors={colors}
        />

        <Text style={styles.meta}>
          {totalVotes !== null && `${totalVotes.toLocaleString(isAr ? "ar-EG" : "en-GB")} ${t("governance.votes_label")} · `}
          {t("governance.expires", {
            date: new Date(poll.expiresAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
              month: "short",
              day: "numeric",
            }),
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionsList({
  poll,
  isAr,
  showResults,
  totalVotes,
  canVote,
  onVote,
  isPending,
  styles,
  colors,
}: {
  poll: Poll;
  isAr: boolean;
  showResults: boolean;
  totalVotes: number | null;
  canVote: boolean;
  onVote: (id: string, text: string) => void;
  isPending: boolean;
  styles: any;
  colors: ReturnType<typeof useAppColors>;
}) {
  return (
    <View style={styles.options}>
      {poll.options.map((option: PollOption) => {
        const text = isAr ? option.labelAr : option.label;
        const isSelected = poll.myVoteOptionId === option.id;
        const pct = showResults ? votePercent(option.voteCount, totalVotes) : 0;

        return (
          <Pressable
            key={option.id}
            style={({ pressed }) => [
              styles.option,
              isSelected && styles.optionSelected,
              !canVote && styles.optionDisabled,
              pressed && canVote && styles.optionPressed,
            ]}
            onPress={() => {
              if (canVote)
                onVote(option.id, text);
            }}
            disabled={!canVote || isPending}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, disabled: !canVote }}
          >
            {showResults && (
              <View style={[styles.resultBar, { width: `${pct}%` }]} />
            )}
            <View style={styles.optionContent}>
              {isSelected
                ? <CheckCircle size={22} color={BRAND.gold} weight="fill" />
                : <CircleIcon size={22} color={canVote ? BRAND.gold : colors.textMuted} />}
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {text}
              </Text>
              {showResults && option.voteCount !== undefined && (
                <Text style={styles.optionVotes}>
                  {option.voteCount.toLocaleString(isAr ? "ar-EG" : "en-GB")}
                  {" "}
                  (
                  {pct.toLocaleString(isAr ? "ar-EG" : "en-GB")}
                  %)
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function PollSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("governance.polls")} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="90%" height={28} />
        <Skeleton width="100%" height={56} borderRadius={RADIUS.lg} />
        <Skeleton width="100%" height={56} borderRadius={RADIUS.lg} />
        <Skeleton width="100%" height={56} borderRadius={RADIUS.lg} />
      </View>
    </View>
  );
}
