import type { FeedbackCategory } from "@/services/api/community";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Camera, Image as ImageIcon, X } from "phosphor-react-native";
import * as React from "react";
import { useController, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { showMessage } from "react-native-flash-message";
import { z } from "zod";

import { GoldButton } from "@/components/auth/gold-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { MAX_ATTACHMENTS, uploadErrorKey, uploadLimitParams, validateAsset } from "@/lib/feedback-attachments";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { communityApi } from "@/services/api/community";
import { uploadsApi } from "@/services/api/uploads";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const CATEGORIES: FeedbackCategory[] = [
  "MAINTENANCE",
  "SECURITY",
  "CLEANLINESS",
  "NOISE",
  "SUGGESTION",
  "OTHER",
];

const schema = z.object({
  category: z.enum(["MAINTENANCE", "SECURITY", "CLEANLINESS", "NOISE", "SUGGESTION", "OTHER"]),
  // Messages are translation keys, rendered with t().
  body: z.string().trim().min(10, "feedback.body_too_short").max(2000, "feedback.body_too_long"),
  isAnonymous: z.boolean(),
});

type FormData = z.infer<typeof schema>;
type Photo = { uri: string; mime: string };

/** Wraps an upload failure so onError can pick upload-specific copy. */
class UploadFailedError extends Error {
  readonly original: unknown;
  constructor(original: unknown) {
    super("upload_failed");
    this.original = original;
  }
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.lg, paddingBottom: SPACING.xl },
    section: { gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    categoryGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    catChip: {
      minHeight: 44,
      justifyContent: "center" as const,
      paddingHorizontal: SPACING.base,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    catChipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    catChipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "600" },
    catChipTextActive: { color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    input: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 22,
      color: colors.text,
      minHeight: 48,
    },
    inputMultiline: { minHeight: 140, textAlignVertical: "top" as const, paddingTop: SPACING.md },
    inputFocused: { borderColor: BRAND.gold },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error },
    hint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: colors.textMuted },
    photoActions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    photoBtn: {
      minHeight: 48,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.sm,
      paddingHorizontal: SPACING.base,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    photoBtnDisabled: { opacity: 0.5 },
    photoBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    thumbs: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.md },
    thumb: { width: 96, height: 96, borderRadius: RADIUS.md, overflow: "hidden" as const, backgroundColor: colors.elevated },
    thumbImg: { width: 96, height: 96 },
    thumbBusy: { ...StyleSheet.absoluteFillObject, backgroundColor: `${BRAND.ink}99` },
    removeBtn: {
      position: "absolute" as const,
      top: 0,
      end: 0,
      width: 44,
      height: 44,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    removeDot: {
      width: 24,
      height: 24,
      borderRadius: RADIUS.full,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: `${BRAND.ink}cc`,
    },
    anonymousRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
    },
    anonymousText: { flex: 1, gap: 2 },
    anonymousLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    anonymousSubtitle: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: colors.textMuted },
  }), [colors]);
}

function usePhotoPicker() {
  const { t, i18n } = useTranslation();
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [uploading, setUploading] = React.useState(false);

  async function addPhotos(source: "library" | "camera") {
    const remaining = MAX_ATTACHMENTS - photos.length;
    if (remaining <= 0) {
      showMessage({ message: t("feedback.photo_limit", uploadLimitParams(i18n.language)), type: "warning", backgroundColor: SEMANTIC.warning });
      return;
    }
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.7,
        ...(source === "library" ? { allowsMultipleSelection: true, selectionLimit: remaining } : {}),
      };
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted)
          return;
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled)
        return;
      const next: Photo[] = [];
      for (const asset of result.assets.slice(0, remaining)) {
        const check = validateAsset({ uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize });
        if (check.ok)
          next.push({ uri: asset.uri, mime: check.mime });
        else
          showMessage({ message: t(check.errorKey as any), type: "danger", backgroundColor: SEMANTIC.error });
      }
      if (next.length)
        setPhotos(current => [...current, ...next].slice(0, MAX_ATTACHMENTS));
    }
    catch {
      showMessage({ message: t("feedback.upload_failed"), type: "danger", backgroundColor: SEMANTIC.error });
    }
  }

  return { photos, setPhotos, uploading, setUploading, addPhotos };
}

export default function NewFeedbackScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "MAINTENANCE", body: "", isAnonymous: false },
  });

  const { photos, setPhotos, uploading, setUploading, addPhotos } = usePhotoPicker();

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const attachments: string[] = [];
      if (photos.length) {
        setUploading(true);
        try {
          for (const photo of photos)
            attachments.push(await uploadsApi.uploadImage(photo.uri, photo.mime, "feedback"));
        }
        catch (error) {
          throw new UploadFailedError(error);
        }
        finally {
          setUploading(false);
        }
      }
      return communityApi.submitFeedback({ ...data, attachments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] });
      router.back();
    },
    onError: (error) => {
      const message = error instanceof UploadFailedError ? t(uploadErrorKey(error.original) as any, uploadLimitParams(i18n.language)) : t("common.error");
      showMessage({ message, type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title={t("feedback.new")} />

      {/* Inside the tab navigator: the tab bar clears the system bar, so no bottom inset. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <CategoryPickerField control={control} styles={styles} />
        <RhfTextInput
          control={control}
          name="body"
          label={t("feedback.feedback_body")}
          placeholder={t("feedback.body_placeholder")}
          error={errors.body?.message ? t(errors.body.message as any) : undefined}
          multiline
          styles={styles}
          colors={colors}
        />
        <PhotoField
          photos={photos}
          busy={uploading}
          disabled={isPending}
          onAdd={addPhotos}
          onRemove={uri => setPhotos(current => current.filter(p => p.uri !== uri))}
          styles={styles}
          colors={colors}
        />
        <AnonymousToggleField control={control} styles={styles} colors={colors} />

        <GoldButton
          label={uploading ? t("feedback.uploading") : isPending ? t("common.loading") : t("common.submit")}
          onPress={handleSubmit(d => mutate(d))}
          loading={isPending}
          disabled={isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Form field sub-components ────────────────────────────────────────────────

function CategoryPickerField({ control, styles }: { control: any; styles: any }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: "category" });

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("feedback.category")}</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const active = field.value === cat;
          return (
            <Pressable
              key={cat}
              style={({ pressed }) => [styles.catChip, active && styles.catChipActive, pressed && styles.pressed]}
              onPress={() => field.onChange(cat)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {t(`feedback.${cat}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RhfTextInput({
  control,
  name,
  label,
  placeholder,
  error,
  multiline,
  styles,
  colors,
}: {
  control: any;
  name: string;
  label: string;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  styles: any;
  colors: any;
}) {
  const { field } = useController({ control, name });
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={field.value as string}
        onChangeText={field.onChange}
        onBlur={() => {
          field.onBlur();
          setIsFocused(false);
        }}
        onFocus={() => setIsFocused(true)}
        placeholderTextColor={colors.textMuted}
        placeholder={placeholder ?? label}
        multiline={multiline}
        maxLength={2000}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function PhotoField({ photos, busy, disabled, onAdd, onRemove, styles, colors }: {
  photos: Photo[];
  busy: boolean;
  disabled: boolean;
  onAdd: (source: "library" | "camera") => void;
  onRemove: (uri: string) => void;
  styles: any;
  colors: any;
}) {
  const { t, i18n } = useTranslation();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const off = photos.length >= MAX_ATTACHMENTS || disabled;

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("feedback.attachments")}</Text>
      <Text style={styles.hint}>{t("feedback.attachments_hint", uploadLimitParams(i18n.language))}</Text>
      <View style={styles.photoActions}>
        <Pressable
          style={({ pressed }) => [styles.photoBtn, off && styles.photoBtnDisabled, pressed && styles.pressed]}
          onPress={() => onAdd("library")}
          disabled={off}
          accessibilityRole="button"
          accessibilityLabel={t("feedback.add_photo")}
        >
          <ImageIcon size={20} color={gold} />
          <Text style={styles.photoBtnText}>{t("feedback.add_photo")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.photoBtn, off && styles.photoBtnDisabled, pressed && styles.pressed]}
          onPress={() => onAdd("camera")}
          disabled={off}
          accessibilityRole="button"
          accessibilityLabel={t("feedback.take_photo")}
        >
          <Camera size={20} color={gold} />
          <Text style={styles.photoBtnText}>{t("feedback.take_photo")}</Text>
        </Pressable>
      </View>
      {photos.length > 0 && (
        <View style={styles.thumbs}>
          {photos.map((photo, index) => (
            <View key={photo.uri} style={styles.thumb}>
              <Image
                source={{ uri: photo.uri }}
                style={styles.thumbImg}
                contentFit="cover"
                accessibilityLabel={`${t("feedback.attachment")} ${index + 1}`}
              />
              {busy && <View style={styles.thumbBusy} />}
              {!busy && (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => onRemove(photo.uri)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={t("feedback.remove_photo")}
                >
                  <View style={styles.removeDot}>
                    <X size={14} color={BRAND.gold} weight="bold" />
                  </View>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function AnonymousToggleField({ control, styles, colors }: { control: any; styles: any; colors: any }) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: "isAnonymous" });
  const on = field.value as boolean;

  return (
    <View style={styles.anonymousRow}>
      <View style={styles.anonymousText}>
        <Text style={styles.anonymousLabel}>{t("feedback.anonymous")}</Text>
        <Text style={styles.anonymousSubtitle}>{t("feedback.anonymous_subtitle")}</Text>
      </View>
      <Switch
        value={on}
        onValueChange={field.onChange}
        trackColor={{ true: BRAND.gold, false: colors.elevated }}
        thumbColor={on ? BRAND.ink : colors.textMuted}
        accessibilityLabel={t("feedback.anonymous")}
      />
    </View>
  );
}
