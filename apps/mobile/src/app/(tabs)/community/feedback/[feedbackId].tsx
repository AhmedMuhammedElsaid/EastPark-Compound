import type { FeedbackReply, FeedbackStatus } from "@/services/api/community";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  SUBMITTED: BRAND.gold,
  ACKNOWLEDGED: SEMANTIC.info,
  IN_PROGRESS: SEMANTIC.warning,
  RESOLVED: SEMANTIC.success,
};

function useStyles() {
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, paddingBottom: SPACING.xl },
    metaSection: { gap: SPACING.sm, marginBottom: SPACING.md },
    badges: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
    badgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: colors.text },
    fbBody: { fontFamily: FONT.sans, fontSize: 15, color: colors.text, lineHeight: 26 },
    thumbs: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.md, marginVertical: SPACING.sm },
    thumb: { width: 104, height: 104, borderRadius: RADIUS.md, overflow: "hidden" as const, backgroundColor: colors.elevated },
    thumbImg: { width: 104, height: 104 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    fbDate: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: SPACING.lg },
    sectionTitle: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    replyCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      gap: SPACING.sm,
      borderStartWidth: 3,
      borderStartColor: BRAND.gold,
      marginBottom: SPACING.md,
    },
    replyHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    adminBadge: {
      backgroundColor: `${BRAND.gold}1f`,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
    },
    adminBadgeText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 11, lineHeight: 18, color: gold },
    replySpacer: { flex: 1 },
    replyDate: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    replyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, lineHeight: 24 },
  }), [colors, gold]);
}

export default function FeedbackDetailScreen() {
  const { feedbackId } = useLocalSearchParams<{ feedbackId: string }>();
  const { t, i18n } = useTranslation();
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
    return <FeedbackDetailSkeleton />;

  const date = new Date(fb.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("feedback.title")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
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
  const tint = STATUS_COLOR[feedback.status as FeedbackStatus] ?? BRAND.gold;

  return (
    <View style={styles.metaSection}>
      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: colors.elevated }]}>
          <Text style={styles.badgeText}>{t(`feedback.${feedback.category}`)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${tint}33` }]}>
          <Text style={styles.badgeText}>{t(`feedback.${feedback.status}`)}</Text>
        </View>
        {feedback.isAnonymous && (
          <View style={[styles.badge, { backgroundColor: colors.elevated }]}>
            <Text style={styles.badgeText}>{t("feedback.anonymous")}</Text>
          </View>
        )}
      </View>
      <Text style={styles.fbBody}>{feedback.body}</Text>
      {(feedback.attachments?.length ?? 0) > 0 && (
        <View style={styles.thumbs}>
          {(feedback.attachments as string[]).map((url, index) => (
            <Pressable
              key={url}
              style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
              onPress={() => void Linking.openURL(url).catch(() => undefined)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${t("feedback.attachment")} ${index + 1}`}
            >
              <Image source={{ uri: url }} style={styles.thumbImg} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      )}
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

function FeedbackDetailSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("feedback.title")} />
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
