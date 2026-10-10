import type { Candidate, Election } from "@/services/api/governance";
import { zodResolver } from "@hookform/resolvers/zod";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { ImageSquare, UserCircle, X } from "phosphor-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { BilingualFields } from "@/components/admin/bilingual-fields";

import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { showConfirm } from "@/lib/confirm-dialog";
import { canOpenResults, resultsStatusKey } from "@/lib/election-results";
import { formatExpiry } from "@/lib/expiry-date";
import { uploadErrorKey, uploadLimitParams, validateAsset } from "@/lib/feedback-attachments";
import { formatNumber } from "@/lib/format-number";
import { buildCandidatePayload } from "@/lib/governance-payload";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { governanceApi } from "@/services/api/governance";
import { uploadsApi } from "@/services/api/uploads";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

// Same limits as the web admin candidate form (apps/web lib/validation/admin.ts).
// Messages are translation keys, rendered with t().
const schema = z.object({
  name: z.string().trim().min(3, "validation.min_3").max(200, "validation.max_200"),
  nameAr: z.string().trim().min(3, "validation.min_3").max(200, "validation.max_200"),
  statement: z.string().trim().max(5000, "validation.max_5000").optional(),
  statementAr: z.string().trim().max(5000, "validation.max_5000").optional(),
});
type FormValues = z.infer<typeof schema>;
const EMPTY_FORM: FormValues = { name: "", nameAr: "", statement: "", statementAr: "" };

type Photo = { uri: string; mime: string };

class UploadFailedError extends Error {
  constructor(readonly original: unknown) {
    super("upload_failed");
  }
}

type Styles = ReturnType<typeof buildStyles>;
type Colors = ReturnType<typeof useAppColors>;

function buildStyles(colors: Colors) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    listContent: { padding: SPACING.base },
    loadingPad: { padding: SPACING.base, gap: SPACING.md },
    summary: { padding: SPACING.base, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: SPACING.xs, marginBottom: SPACING.lg },
    summaryTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 17, lineHeight: 26, color: colors.text },
    meta: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    sectionLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginBottom: SPACING.sm },
    row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, marginBottom: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarImg: { width: 44, height: 44 },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 24, color: colors.text },
    empty: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, paddingVertical: SPACING.md },
    form: { marginTop: SPACING.lg, gap: SPACING.xs },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: SPACING.md, marginBottom: SPACING.xs },
    input: { backgroundColor: colors.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: 48, paddingVertical: SPACING.sm, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text, borderWidth: 1, borderColor: colors.border },
    inputError: { borderColor: SEMANTIC.error },
    textarea: { minHeight: 80, textAlignVertical: "top" },
    errorText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error, marginTop: SPACING.xs },
    photoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    photoBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 44, paddingHorizontal: SPACING.base, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated },
    photoBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: gold },
    preview: { width: 64, height: 64, borderRadius: RADIUS.md },
    removeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    submitBtn: { height: 52, borderRadius: RADIUS.md, backgroundColor: BRAND.gold, justifyContent: "center", alignItems: "center", marginTop: SPACING.xl },
    submitBtnDisabled: { opacity: 0.5 },
    resultsBtn: { minHeight: 48, marginTop: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: BRAND.gold, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACING.base },
    resultsBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: gold },
    submitBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}

function OpenResultsButton({ electionId, styles }: { electionId: string; styles: Styles }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => governanceApi.openElectionResults(electionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election", electionId] });
      queryClient.invalidateQueries({ queryKey: ["elections"] });
      showMessage({ message: t("admin.results_opened"), type: "success", backgroundColor: SEMANTIC.success });
    },
    onError: () => {
      showMessage({ message: t("common.error"), type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  const confirm = async () => {
    if (await showConfirm({ title: t("admin.open_results"), message: t("admin.open_results_confirm"), confirmLabel: t("admin.open_results") }))
      mutate();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.resultsBtn, isPending && styles.submitBtnDisabled, pressed && styles.pressed]}
      onPress={confirm}
      disabled={isPending}
      accessibilityRole="button"
      accessibilityState={{ disabled: isPending, busy: isPending }}
    >
      <Text style={styles.resultsBtnText}>{isPending ? t("common.loading") : t("admin.open_results")}</Text>
    </Pressable>
  );
}

function ElectionSummary({ election, styles }: { election: Election; styles: Styles }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const count = election.candidates.length;
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{isAr ? election.titleAr : election.title}</Text>
      <Text style={styles.meta}>{t("admin.ends_at", { date: formatExpiry(new Date(election.expiresAt), i18n.language) })}</Text>
      <Text style={styles.meta}>{`${t("admin.visibility_mode")}: ${t(`admin.visibility_${election.visibilityMode.toLowerCase()}` as any)}`}</Text>
      <Text style={styles.meta}>{t(resultsStatusKey(election) as any)}</Text>
      <Text style={styles.meta}>{t("admin.candidates_count", { count, total: formatNumber(count, i18n.language) })}</Text>
      {canOpenResults(election) ? <OpenResultsButton electionId={election.id} styles={styles} /> : null}
    </View>
  );
}

function CandidateRow({ candidate, styles, colors }: { candidate: Candidate; styles: Styles; colors: Colors }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const statement = isAr ? (candidate.statementAr ?? candidate.statement) : (candidate.statement ?? candidate.statementAr);
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        {candidate.photoUrl
          ? <Image source={{ uri: candidate.photoUrl }} style={styles.avatarImg} contentFit="cover" recyclingKey={candidate.id} />
          : <UserCircle size={28} color={colors.textMuted} />}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{isAr ? candidate.nameAr : candidate.name}</Text>
        {statement ? <Text style={styles.meta} numberOfLines={2}>{statement}</Text> : null}
      </View>
    </View>
  );
}

function CandidatesSkeleton({ styles }: { styles: Styles }) {
  return (
    <View style={styles.loadingPad}>
      <Skeleton width="100%" height={140} borderRadius={RADIUS.lg} />
      <Skeleton width="100%" height={68} borderRadius={RADIUS.md} />
      <Skeleton width="100%" height={68} borderRadius={RADIUS.md} />
      <Skeleton width="100%" height={240} borderRadius={RADIUS.md} />
    </View>
  );
}

type PhotoFieldProps = { photo: Photo | null; onChange: (photo: Photo | null) => void; styles: Styles; colors: Colors };

function CandidatePhotoField({ photo, onChange, styles, colors }: PhotoFieldProps) {
  const { t } = useTranslation();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;

  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets[0])
        return;
      const asset = result.assets[0];
      const check = validateAsset({ uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize });
      if (check.ok)
        onChange({ uri: asset.uri, mime: check.mime });
      else
        showMessage({ message: t(check.errorKey as any), type: "danger", backgroundColor: SEMANTIC.error });
    }
    catch {
      showMessage({ message: t("feedback.upload_failed"), type: "danger", backgroundColor: SEMANTIC.error });
    }
  }

  if (photo) {
    return (
      <View style={styles.photoRow}>
        <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
        <Pressable style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]} onPress={() => onChange(null)} accessibilityRole="button" accessibilityLabel={t("admin.remove_photo")}>
          <X size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.photoRow}>
      <Pressable style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]} onPress={pickPhoto} accessibilityRole="button">
        <ImageSquare size={20} color={gold} />
        <Text style={styles.photoBtnText}>{t("admin.choose_photo")}</Text>
      </Pressable>
    </View>
  );
}

type AddCandidateFormProps = { electionId: string; styles: Styles; colors: Colors };

function AddCandidateForm({ electionId, styles, colors }: AddCandidateFormProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [photo, setPhoto] = React.useState<Photo | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      let photoUrl: string | undefined;
      if (photo) {
        try {
          photoUrl = await uploadsApi.uploadImage(photo.uri, photo.mime, "candidate");
        }
        catch (error) {
          throw new UploadFailedError(error);
        }
      }
      return governanceApi.addCandidate(electionId, buildCandidatePayload(values, photoUrl));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election", electionId] });
      queryClient.invalidateQueries({ queryKey: ["elections"] });
      reset(EMPTY_FORM);
      setPhoto(null);
      showMessage({ message: t("admin.candidate_added"), type: "success", backgroundColor: SEMANTIC.success });
    },
    onError: (error) => {
      const message = error instanceof UploadFailedError ? t(uploadErrorKey(error.original) as any, uploadLimitParams(i18n.language)) : t("common.error");
      showMessage({ message, type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  return (
    <View style={styles.form}>
      <Text style={styles.sectionLabel}>{t("admin.add_candidate")}</Text>

      <BilingualFields control={control} enName="name" arName="nameAr" enLabel={t("admin.name_en")} arLabel={t("admin.name_ar")} enError={errors.name?.message} arError={errors.nameAr?.message} styles={styles} />
      <BilingualFields control={control} enName="statement" arName="statementAr" enLabel={t("admin.statement_en")} arLabel={t("admin.statement_ar")} enError={errors.statement?.message} arError={errors.statementAr?.message} multiline styles={styles} />

      <Text style={styles.label}>{t("admin.candidate_photo")}</Text>
      <CandidatePhotoField photo={photo} onChange={setPhoto} styles={styles} colors={colors} />

      <Pressable
        style={({ pressed }) => [styles.submitBtn, isPending && styles.submitBtnDisabled, pressed && styles.pressed]}
        onPress={handleSubmit(values => mutate(values))}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPending, busy: isPending }}
      >
        <Text style={styles.submitBtnText}>{isPending ? t("common.loading") : t("admin.add_candidate")}</Text>
      </Pressable>
    </View>
  );
}

export default function ElectionCandidatesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);

  const { data: election, isError, isLoading, refetch } = useQuery({
    queryKey: ["election", id],
    queryFn: () => governanceApi.getElection(id),
    select: res => res.data.data,
    enabled: !!id,
  });

  if (isError && !election)
    return <DetailErrorScreen onRetry={() => refetch()} />;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("admin.manage_election")} />
      {isLoading || !election
        ? <CandidatesSkeleton styles={styles} />
        : (
            <FlashList
              data={election.candidates}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <CandidateRow candidate={item} styles={styles} colors={colors} />}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ ...styles.listContent, paddingBottom: insets.bottom + SPACING.xl }}
              ListHeaderComponent={(
                <View>
                  <ElectionSummary election={election} styles={styles} />
                  <Text style={styles.sectionLabel}>{t("admin.candidates")}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>{t("admin.no_candidates")}</Text>}
              ListFooterComponent={<AddCandidateForm electionId={election.id} styles={styles} colors={colors} />}
            />
          )}
    </View>
  );
}
