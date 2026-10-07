import type { Comment } from "@/services/api/community";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ChatCircle, FilePdf, PaperPlaneTilt } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { I18nManager, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { COMMENT_ERROR_KEYS, pickErrorKey } from "@/lib/api-error";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { openDocument } from "@/lib/utils";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, paddingBottom: SPACING.xl },
    metaRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm, marginBottom: SPACING.md },
    catBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f` },
    catBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: gold },
    dateText: { flexShrink: 1, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 22, color: colors.text, lineHeight: 34, marginBottom: SPACING.md },
    body: { fontFamily: FONT.sans, fontSize: 15, color: colors.textMuted, lineHeight: 26 },
    pdfRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
      minHeight: 56,
      marginTop: SPACING.lg,
      padding: SPACING.base,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    pdfLabel: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: gold, fontWeight: "600" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: SPACING.lg },
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, marginBottom: SPACING.md },
    commentsWrap: { gap: SPACING.sm },
    noComments: {
      alignItems: "center" as const,
      gap: SPACING.sm,
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.base,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
    },
    noCommentsText: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center" as const },
    commentRow: { flexDirection: "row" as const, gap: SPACING.sm },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${BRAND.gold}1f`,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      flexShrink: 0,
    },
    commentAvatarText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: gold },
    commentContent: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
    },
    commentName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    commentBody: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 22, marginTop: 2 },
    commentBar: {
      flexDirection: "row" as const,
      alignItems: "flex-end" as const,
      gap: SPACING.sm,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.sm,
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    commentInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 22,
      color: colors.text,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    sendBtnDisabled: { opacity: 0.4 },
  }), [colors, gold]);
}

export default function AnnouncementDetailScreen() {
  const { announcementId } = useLocalSearchParams<{ announcementId: string }>();
  const { t, i18n } = useTranslation();
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
  const date = ann
    ? new Date(ann.publishedAt ?? ann.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  if (isError && !ann)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !ann)
    return <AnnouncementSkeleton />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title={t("community.announcements")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.metaRow}>
          <View style={styles.catBadge}>
            <Text style={styles.catBadgeText}>{t(`community.${ann.category}`)}</Text>
          </View>
          <Text style={styles.dateText}>{date}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {ann.pdfUrl && (
          <Pressable
            style={({ pressed }) => [styles.pdfRow, pressed && styles.pressed]}
            accessibilityRole="button"
            onPress={() => openDocument(ann.pdfUrl!, () => showMessage({ message: t("community.pdf_open_failed"), type: "danger" }))}
          >
            <FilePdf size={24} color={styles.pdfLabel.color} />
            <Text style={styles.pdfLabel}>{t("community.view_pdf")}</Text>
          </Pressable>
        )}

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>{t("community.comments")}</Text>
        <CommentsSection comments={ann.comments ?? []} styles={styles} />
      </ScrollView>

      <AddCommentBar announcementId={announcementId} styles={styles} />
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CommentsSection({ comments, styles }: { comments: Comment[]; styles: any }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  if (comments.length === 0) {
    return (
      <View style={styles.noComments}>
        <ChatCircle size={32} color={colors.textMuted} />
        <Text style={styles.noCommentsText}>{t("community.no_comments")}</Text>
      </View>
    );
  }
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

function AddCommentBar({ announcementId, styles }: { announcementId: string; styles: any }) {
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
    // Inside the tab navigator: the tab bar already clears the system bar, so no bottom inset here.
    <View style={styles.commentBar}>
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
        <PaperPlaneTilt mirrored={I18nManager.isRTL} size={20} color={BRAND.ink} />
      </Pressable>
    </View>
  );
}

function AnnouncementSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("community.announcements")} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="40%" height={20} />
        <Skeleton width="80%" height={28} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="70%" height={14} />
      </View>
    </View>
  );
}
