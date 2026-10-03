import type { FeedbackReply, FeedbackStatus } from "@/services/api/community";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  SUBMITTED: "", // filled at runtime with colors.elevated
  ACKNOWLEDGED: SEMANTIC.info,
  IN_PROGRESS: SEMANTIC.warning,
  RESOLVED: SEMANTIC.success,
};

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
    metaSection: { gap: SPACING.sm, marginBottom: SPACING.md },
    badges: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    badgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, color: colors.text },
    fbTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, color: colors.text, lineHeight: 28 },
    fbBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 24 },
    fbDate: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: SPACING.lg },
    sectionTitle: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 16,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    replyCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.sm,
      borderLeftWidth: 3,
      borderLeftColor: BRAND.gold,
      marginBottom: SPACING.md,
    },
    replyHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    adminBadge: {
      backgroundColor: BRAND.goldTint,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
    },
    adminBadgeText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 11, color: BRAND.goldText },
    replySpacer: { flex: 1 },
    replyDate: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    replyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  }), [colors]);
}

export default function FeedbackDetailScreen() {
  const { feedbackId } = useLocalSearchParams<{ feedbackId: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAr = i18n.language === "ar";
  const styles = useStyles();
  const colors = useAppColors();

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["feedback", feedbackId],
    queryFn: () => communityApi.getFeedbackItem(feedbackId),
    enabled: !!feedbackId,
  });

  const fb = data?.data.data;

  if (isError && !fb)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !fb)
    return <FeedbackDetailSkeleton insets={insets} />;

  const date = new Date(fb.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft mirrored={I18nManager.isRTL} size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("feedback.title")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <FeedbackMeta feedback={fb} date={date} styles={styles} colors={colors} />
        <View style={styles.divider} />

        {(fb.replies?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t("feedback.reply")}</Text>
            {fb.replies?.map(reply => (
              <ReplyCard key={reply.id} reply={reply} styles={styles} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeedbackMeta({ feedback, date, styles, colors }: { feedback: any; date: string; styles: any; colors: any }) {
  const { t } = useTranslation();
  const statusColor = feedback.status === "SUBMITTED"
    ? colors.elevated
    : (STATUS_COLOR[feedback.status as FeedbackStatus] ?? colors.elevated);

  return (
    <View style={styles.metaSection}>
      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: colors.elevated }]}>
          <Text style={styles.badgeText}>{t(`feedback.${feedback.category}`)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{t(`feedback.${feedback.status}`)}</Text>
        </View>
        {feedback.isAnonymous && (
          <View style={[styles.badge, { backgroundColor: colors.elevated }]}>
            <Text style={styles.badgeText}>{t("feedback.anonymous")}</Text>
          </View>
        )}
      </View>
      <Text style={styles.fbBody}>{feedback.body}</Text>
      <Text style={styles.fbDate}>{date}</Text>
    </View>
  );
}

function ReplyCard({ reply, styles }: { reply: FeedbackReply; styles: any }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const date = new Date(reply.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={styles.replyCard}>
      <View style={styles.replyHeader}>
        <View style={styles.adminBadge}>
          {/* Replies come from compound management; the API exposes only authorId. */}
          <Text style={styles.adminBadgeText}>{t("feedback.management")}</Text>
        </View>
        <View style={styles.replySpacer} />
        <Text style={styles.replyDate}>{date}</Text>
      </View>
      <Text style={styles.replyBody}>{reply.body}</Text>
    </View>
  );
}

function FeedbackDetailSkeleton({ insets }: { insets: { top: number } }) {
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top + 56, backgroundColor: colors.card }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="40%" height={20} />
        <Skeleton width="80%" height={24} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="70%" height={14} />
      </View>
    </View>
  );
}
