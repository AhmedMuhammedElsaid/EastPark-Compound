import type { Candidate } from "@/services/api/governance";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
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
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 22, color: colors.text, lineHeight: 34, marginBottom: SPACING.sm },
    description: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 24, marginBottom: SPACING.sm },
    hint: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 22, marginBottom: SPACING.md },
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
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, marginBottom: SPACING.md },
    candidates: { gap: SPACING.md },
    candidateCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    candidatePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    candidateSelected: { borderColor: BRAND.gold },
    candidateDisabled: { opacity: 0.9 },
    candidateTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.md },
    avatar: { width: 56, height: 56, borderRadius: 28 },
    avatarFallback: { backgroundColor: `${BRAND.gold}1f`, justifyContent: "center" as const, alignItems: "center" as const },
    avatarInitial: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, lineHeight: 30, color: gold },
    candidateInfo: { flex: 1 },
    candidateName: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 26, color: colors.text },
    candidateNameSelected: { color: gold },
    candidateStatement: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 22, marginTop: 2 },
    voteBar: {
      minHeight: 28,
      backgroundColor: colors.elevated,
      borderRadius: RADIUS.sm,
      overflow: "hidden" as const,
      justifyContent: "center" as const,
      paddingHorizontal: SPACING.sm,
    },
    voteBarFill: {
      position: "absolute" as const,
      start: 0,
      top: 0,
      bottom: 0,
      backgroundColor: `${BRAND.gold}33`,
    },
    voteBarText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: colors.text, fontWeight: "600" },
    meta: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.lg, textAlign: "center" as const },
  }), [colors, gold]);
}

// eslint-disable-next-line max-lines-per-function
export default function ElectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { requireAuth } = useAuthGuard();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const role = useAppSelector(s => s.auth.user?.role);

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["election", id],
    queryFn: () => governanceApi.getElection(id),
    enabled: !!id,
  });

  const election = data?.data.data;
  const isAr = i18n.language === "ar";
  const locale = isAr ? "ar-EG" : "en-GB";

  // Snapshot taken once on mount: Date.now() is impure and must not run during render.
  const [mountedAt] = React.useState(() => Date.now());

  const { mutate, isPending } = useMutation({
    mutationFn: (candidateId: string) => governanceApi.voteElection(id, candidateId),
    onSuccess: () => {
      showMessage({ message: t("governance.vote_submitted"), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["election", id] });
      queryClient.invalidateQueries({ queryKey: ["elections"] });
    },
    onError: (error) => {
      showMessage({ message: t(pickErrorKey(error, VOTE_ERROR_KEYS, "common.error")), type: "danger" });
      queryClient.invalidateQueries({ queryKey: ["election", id] });
    },
  });

  function handleVote(candidateId: string, candidateName: string) {
    requireAuth(() => {
      Alert.alert(
        t("governance.vote"),
        t("governance.vote_confirm", { option: candidateName }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("governance.vote"), onPress: () => mutate(candidateId) },
        ],
      );
    });
  }

  if (isError && !election)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !election)
    return <ElectionSkeleton />;

  const title = isAr ? election.titleAr : election.title;
  const description = isAr ? election.descriptionAr : election.description;
  // Backend includes voteCount when resultsOpen or visibilityMode is LIVE_COUNT.
  const showVotes = election.resultsVisible;
  const totalVotes = election.totalVotes;
  const votingClosed = election.isExpired || new Date(election.expiresAt).getTime() <= mountedAt;
  // Voting is resident-only on the backend; a signed-in admin/merchant would only get a 403.
  const isNonResident = !!role && role !== "RESIDENT";
  const canVote = !election.myVoteCandidateId && !votingClosed && !isNonResident;
  const hint = votingClosed
    ? t("governance.voting_closed")
    : isNonResident
      ? t("governance.residents_only")
      : election.myVoteCandidateId
        ? null
        : t("governance.pick_candidate");

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("governance.elections")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : <View style={{ height: SPACING.md }} />}

        {election.myVoteCandidateId && !showVotes && (
          <View style={styles.sealedBanner}>
            <Text style={styles.sealedText}>{t("governance.sealed")}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t("governance.candidates")}</Text>

        <CandidateList
          candidates={election.candidates}
          isAr={isAr}
          myVote={election.myVoteCandidateId}
          canVote={canVote}
          showVotes={showVotes}
          totalVotes={totalVotes}
          onVote={handleVote}
          isPending={isPending}
          styles={styles}
        />

        <Text style={styles.meta}>
          {totalVotes !== null && `${totalVotes.toLocaleString(locale)} ${t("governance.votes_label")} · `}
          {t("governance.expires", {
            date: new Date(election.expiresAt).toLocaleDateString(locale, {
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

function CandidateList({
  candidates,
  isAr,
  myVote,
  canVote,
  showVotes,
  totalVotes,
  onVote,
  isPending,
  styles,
}: {
  candidates: Candidate[];
  isAr: boolean;
  myVote: string | null;
  canVote: boolean;
  showVotes: boolean;
  totalVotes: number | null;
  onVote: (id: string, name: string) => void;
  isPending: boolean;
  styles: any;
}) {
  return (
    <View style={styles.candidates}>
      {candidates.map((candidate) => {
        const name = isAr ? candidate.nameAr : candidate.name;
        const statement = isAr ? candidate.statementAr : candidate.statement;
        const pct = showVotes ? votePercent(candidate.voteCount, totalVotes) : 0;

        return (
          <CandidateCard
            key={candidate.id}
            name={name}
            statement={statement}
            photoUrl={candidate.photoUrl}
            isSelected={myVote === candidate.id}
            canVote={canVote}
            showVotes={showVotes}
            votes={candidate.voteCount}
            pct={pct}
            isAr={isAr}
            disabled={!canVote || isPending}
            onVote={() => {
              if (canVote && !isPending)
                onVote(candidate.id, name);
            }}
            styles={styles}
          />
        );
      })}
    </View>
  );
}

function CandidateCard({
  name,
  statement,
  photoUrl,
  isSelected,
  canVote,
  showVotes,
  votes,
  pct,
  isAr,
  disabled,
  onVote,
  styles,
}: {
  name: string;
  statement: string | null;
  photoUrl: string | null;
  isSelected: boolean;
  canVote: boolean;
  showVotes: boolean;
  votes: number | undefined;
  pct: number;
  isAr: boolean;
  disabled: boolean;
  onVote: () => void;
  styles: any;
}) {
  const colors = useAppColors();
  const locale = isAr ? "ar-EG" : "en-GB";
  return (
    <Pressable
      style={({ pressed }) => [
        styles.candidateCard,
        isSelected && styles.candidateSelected,
        !canVote && styles.candidateDisabled,
        pressed && canVote && styles.candidatePressed,
      ]}
      onPress={onVote}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ checked: isSelected, disabled: !canVote }}
    >
      <View style={styles.candidateTop}>
        {isSelected
          ? <CheckCircle size={22} color={BRAND.gold} weight="fill" />
          : <CircleIcon size={22} color={canVote ? BRAND.gold : colors.textMuted} />}
        {photoUrl
          ? <Image source={{ uri: photoUrl }} style={styles.avatar} contentFit="cover" />
          : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
        <View style={styles.candidateInfo}>
          <Text style={[styles.candidateName, isSelected && styles.candidateNameSelected]}>{name}</Text>
          {statement ? <Text style={styles.candidateStatement} numberOfLines={3}>{statement}</Text> : null}
        </View>
      </View>

      {showVotes && votes !== undefined && (
        <View style={styles.voteBar}>
          <View style={[styles.voteBarFill, { width: `${pct}%` }]} />
          <Text style={styles.voteBarText}>
            {votes.toLocaleString(locale)}
            {" "}
            (
            {pct.toLocaleString(locale)}
            %)
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function ElectionSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("governance.elections")} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="70%" height={28} />
        <Skeleton width="100%" height={100} borderRadius={RADIUS.lg} />
        <Skeleton width="100%" height={100} borderRadius={RADIUS.lg} />
      </View>
    </View>
  );
}
