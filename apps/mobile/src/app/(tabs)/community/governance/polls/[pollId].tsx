import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
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
    scroll: { padding: SPACING.base },
    question: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 20,
      color: colors.text,
      lineHeight: 30,
      marginBottom: SPACING.xl,
    },
    sealedBanner: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderLeftWidth: 3,
      borderLeftColor: BRAND.gold,
    },
    sealedText: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    options: { gap: SPACING.sm },
    option: {
      height: 56,
      borderRadius: RADIUS.md,
      backgroundColor: colors.card,
      overflow: "hidden" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionSelected: { borderColor: BRAND.gold },
    optionDisabled: { opacity: 0.85 },
    resultBar: {
      position: "absolute" as const,
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: `${BRAND.gold}22`,
    },
    optionContent: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: SPACING.md,
    },
    optionText: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 14, color: colors.text },
    optionTextSelected: { color: BRAND.gold },
    optionVotes: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    meta: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, marginTop: SPACING.lg, textAlign: "center" as const },
  }), [colors]);
}

export default function PollDetailScreen() {
  const { pollId } = useLocalSearchParams<{ pollId: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { requireAuth } = useAuthGuard();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const { data, isLoading } = useQuery({
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

  if (isLoading || !poll)
    return <PollSkeleton insets={insets} />;

  const question = isAr ? poll.questionAr : poll.question;
  const showResults = poll.resultsOpen && poll.myVote !== null;
  const totalVotes = poll.totalVotes ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("governance.polls")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.question}>{question}</Text>

        {poll.myVote && !showResults && (
          <View style={styles.sealedBanner}>
            <Text style={styles.sealedText}>{t("governance.sealed")}</Text>
          </View>
        )}

        <OptionsList
          poll={poll}
          isAr={isAr}
          showResults={showResults}
          totalVotes={totalVotes}
          onVote={handleVote}
          isPending={isPending}
          styles={styles}
        />

        <Text style={styles.meta}>
          {poll.totalVotes}
          {" "}
          {t("governance.votes_label")}
          {" · "}
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
  onVote,
  isPending,
  styles,
}: {
  poll: ReturnType<typeof useQuery<any>>["data"] extends undefined ? never : any;
  isAr: boolean;
  showResults: boolean;
  totalVotes: number;
  onVote: (id: string, text: string) => void;
  isPending: boolean;
  styles: any;
}) {
  return (
    <View style={styles.options}>
      {poll.options?.map((option: any) => {
        const text = isAr ? option.textAr : option.text;
        const isSelected = poll.myVote === option.id;
        const pct = showResults && option.votes !== undefined && totalVotes > 0
          ? Math.round((option.votes / totalVotes) * 100)
          : 0;

        return (
          <Pressable
            key={option.id}
            style={[
              styles.option,
              isSelected && styles.optionSelected,
              poll.myVote !== null && styles.optionDisabled,
            ]}
            onPress={() => {
              if (!poll.myVote)
                onVote(option.id, text);
            }}
            disabled={!!poll.myVote || isPending}
          >
            {showResults && (
              <View style={[styles.resultBar, { width: `${pct}%` }]} />
            )}
            <View style={styles.optionContent}>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {text}
              </Text>
              {showResults && option.votes !== undefined && (
                <Text style={styles.optionVotes}>
                  {option.votes}
                  {" "}
                  (
                  {pct}
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

function PollSkeleton({ insets }: { insets: { top: number } }) {
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top + 56, backgroundColor: colors.card }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="90%" height={28} />
        <Skeleton width="100%" height={56} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={56} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={56} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
}
