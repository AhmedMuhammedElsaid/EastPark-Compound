import type { Comment } from "@/services/api/community";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, FilePdf, PaperPlaneTilt } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { I18nManager, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { COMMENT_ERROR_KEYS, pickErrorKey } from "@/lib/api-error";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { openDocument } from "@/lib/utils";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: SPACING.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    navTitle: { flex: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 16, color: colors.text },
    scroll: { padding: SPACING.base },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 22, color: colors.text, lineHeight: 32, marginBottom: SPACING.md },
    body: { fontFamily: FONT.sans, fontSize: 15, color: colors.textMuted, lineHeight: 26 },
    pdfRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
      marginTop: SPACING.md,
      padding: SPACING.md,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
    },
    pdfLabel: { fontFamily: FONT.sans, fontSize: 14, color: BRAND.gold, fontWeight: "600" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: SPACING.lg },
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text, marginBottom: SPACING.md },
    commentsWrap: { gap: SPACING.sm },
    commentRow: { flexDirection: "row" as const, gap: SPACING.sm },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      flexShrink: 0,
    },
    commentAvatarText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, color: BRAND.gold },
    commentContent: { flex: 1, backgroundColor: colors.card, borderRadius: RADIUS.sm, padding: SPACING.sm },
    commentName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, color: colors.text },
    commentBody: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 20, marginTop: 2 },
    loadMoreBtn: { alignItems: "center" as const, paddingVertical: SPACING.sm },
    loadMoreText: { fontFamily: FONT.sans, fontSize: 13, color: BRAND.gold, fontWeight: "600" },
    commentBar: {
      flexDirection: "row" as const,
      alignItems: "flex-end" as const,
      gap: SPACING.sm,
      paddingHorizontal: SPACING.base,
      paddingTop: SPACING.sm,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    commentInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      backgroundColor: colors.elevated,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.text,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    sendBtnDisabled: { opacity: 0.4 },
  }), [colors]);
}

export default function AnnouncementDetailScreen() {
  const { announcementId } = useLocalSearchParams<{ announcementId: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["announcement", announcementId],
    queryFn: () => communityApi.getAnnouncement(announcementId),
    enabled: !!announcementId,
  });

  const ann = data?.data.data;
  const isAr = i18n.language === "ar";
  const title = ann ? (isAr ? ann.titleAr : ann.title) : "";
  const body = ann ? (isAr ? ann.bodyAr : ann.body) : "";

  if (isError && !ann)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !ann)
    return <AnnouncementSkeleton insets={insets} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.nav, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft mirrored={I18nManager.isRTL} size={18} color={styles.navTitle.color} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {ann.pdfUrl && (
          <Pressable style={styles.pdfRow} onPress={() => openDocument(ann.pdfUrl!, () => showMessage({ message: t("community.pdf_open_failed"), type: "danger" }))}>
            <FilePdf size={24} color={BRAND.gold} />
            <Text style={styles.pdfLabel}>{t("community.view_pdf")}</Text>
          </Pressable>
        )}

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>{t("community.comments")}</Text>
        <CommentsSection comments={ann.comments ?? []} styles={styles} />
      </ScrollView>

      <AddCommentBar announcementId={announcementId} bottomInset={insets.bottom} styles={styles} />
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CommentsSection({ comments, styles }: { comments: Comment[]; styles: any }) {
  return (
    <View style={styles.commentsWrap}>
      {comments.map(c => <CommentRow key={c.id} comment={c} styles={styles} />)}
    </View>
  );
}

function CommentRow({ comment, styles }: { comment: Comment; styles: any }) {
  return (
    <View style={styles.commentRow}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentAvatarText}>{(comment.user?.name ?? "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.commentContent}>
        <Text style={styles.commentName}>{comment.user?.name ?? ""}</Text>
        <Text style={styles.commentBody}>{comment.body}</Text>
      </View>
    </View>
  );
}

function AddCommentBar({ announcementId, bottomInset, styles }: { announcementId: string; bottomInset: number; styles: any }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const { requireAuth } = useAuthGuard();
  const queryClient = useQueryClient();
  const [text, setText] = React.useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => communityApi.addComment(announcementId, text),
    onSuccess: () => {
      setText("");
      // Comments are embedded in the announcement detail response.
      queryClient.invalidateQueries({ queryKey: ["announcement", announcementId] });
    },
    onError: (error) => {
      showMessage({ message: t(pickErrorKey(error, COMMENT_ERROR_KEYS, "common.error")), type: "danger" });
    },
  });

  function handleSubmit() {
    if (!text.trim())
      return;
    requireAuth(() => mutate());
  }

  return (
    <View style={[styles.commentBar, { paddingBottom: bottomInset + SPACING.sm }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t("community.comment_placeholder")}
        placeholderTextColor={colors.textMuted}
        style={styles.commentInput}
        multiline
        maxLength={500}
      />
      <Pressable
        style={[styles.sendBtn, (!text.trim() || isPending) && styles.sendBtnDisabled]}
        onPress={handleSubmit}
        disabled={!text.trim() || isPending}
        accessibilityRole="button"
        accessibilityLabel={t("community.send_comment")}
      >
        <PaperPlaneTilt mirrored={I18nManager.isRTL} size={20} color={colors.bg} />
      </Pressable>
    </View>
  );
}

function AnnouncementSkeleton({ insets }: { insets: { top: number } }) {
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top + 56, backgroundColor: colors.card }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="80%" height={28} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="70%" height={14} />
      </View>
    </View>
  );
}
