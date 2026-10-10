import type { Control } from "react-hook-form";
import type { ProfileFormValues } from "@/lib/profile-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { ImageSquare, Trash } from "phosphor-react-native";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadErrorKey, uploadLimitParams, validateAsset } from "@/lib/feedback-attachments";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useDiscardGuard } from "@/lib/hooks/use-discard-guard";
import { useApplySavedProfile, useProfileQuery } from "@/lib/hooks/use-profile-units";
import { profileFormDefaults, profileFormSchema, profileSaveErrorKey, toProfileUpdate } from "@/lib/profile-form";
import { uploadsApi } from "@/services/api/uploads";
import { usersApi } from "@/services/api/users";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;
type Styles = ReturnType<typeof buildStyles>;
type Photo = { uri: string; mime: string };

/** The photo upload failed (told apart from a failed profile save). */
class AvatarUploadError extends Error {
  constructor(readonly original: unknown) {
    super("avatar_upload");
  }
}

const startText = {
  writingDirection: I18nManager.isRTL ? ("rtl" as const) : ("ltr" as const),
  textAlign: I18nManager.isRTL ? ("right" as const) : ("left" as const),
};

function buildStyles(colors: Colors) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    section: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.md,
    },
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: gold },
    photoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.base },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${BRAND.gold}1f`,
      borderWidth: 2,
      borderColor: BRAND.gold,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarInitial: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 30, lineHeight: 44, color: gold },
    photoActions: { flex: 1, gap: SPACING.sm },
    photoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      minHeight: 48,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 21, color: colors.text },
    removeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 21, color: SEMANTIC.error },
    hint: { ...startText, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    label: { ...startText, fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, marginBottom: SPACING.xs },
    input: {
      ...startText,
      minHeight: 48,
      backgroundColor: colors.bg,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      fontFamily: FONT.sans,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // Phone numbers read left to right in both languages.
    inputLtr: { writingDirection: "ltr", textAlign: I18nManager.isRTL ? "right" : "left" },
    inputError: { borderColor: SEMANTIC.error },
    errorText: { ...startText, fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error, marginTop: SPACING.xs },
    readonly: { ...startText, fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.text, writingDirection: "ltr" },
    saveBtn: {
      minHeight: 52,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      alignItems: "center",
      justifyContent: "center",
      marginTop: SPACING.sm,
    },
    saveBtnDisabled: { opacity: 0.5 },
    // Ink on gold passes AA in both themes.
    saveBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: BRAND.ink },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

/** Name, phone and profile photo (`PUT /user`, photo via `POST /uploads/image?purpose=avatar`). */
export default function EditProfileScreen() {
  const { styles, colors } = useStyles();
  const { profile, isError, refetch } = useProfileQuery();

  if (isError && !profile)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (!profile)
    return <EditProfileSkeleton styles={styles} />;
  // Keyed by id: the form's defaults are the loaded profile.
  return <EditProfileForm key={profile.id} profile={profile} styles={styles} colors={colors} />;
}

type LoadedProfile = NonNullable<ReturnType<typeof useProfileQuery>["profile"]>;

function EditProfileForm({ profile, styles, colors }: { profile: LoadedProfile; styles: Styles; colors: Colors }) {
  const { t, i18n } = useTranslation();
  const limits = uploadLimitParams(i18n.language);
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = React.useState<Photo | null>(null);
  const [removePhoto, setRemovePhoto] = React.useState(false);
  const allowLeaveRef = React.useRef(false);

  const { control, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileFormDefaults(profile),
  });
  const changed = isDirty || photo !== null || removePhoto;
  useDiscardGuard(changed, allowLeaveRef);

  const { mutate: save, isPending } = useSaveProfile({
    photo,
    removePhoto,
    limits,
    onSaved: () => {
      // Saved on purpose: leave without the discard prompt.
      allowLeaveRef.current = true;
      if (router.canGoBack())
        router.back();
    },
  });

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("profile.edit")} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <PhotoSection
          shownPhoto={photo?.uri ?? (removePhoto ? null : profile.avatarUrl)}
          initial={(profile.name.trim().charAt(0) || "?").toUpperCase()}
          disabled={isPending}
          limits={limits}
          onPicked={(picked) => {
            setPhoto(picked);
            setRemovePhoto(false);
          }}
          onRemove={() => {
            setPhoto(null);
            setRemovePhoto(Boolean(profile.avatarUrl));
          }}
          styles={styles}
          colors={colors}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{t("profile.personal_details")}</Text>
          <FormField name="name" label={t("auth.name")} control={control} error={errors.name?.message} styles={styles} colors={colors} autoComplete="name" />
          <FormField
            name="phone"
            label={`${t("auth.phone")} (${t("common.optional")})`}
            control={control}
            error={errors.phone?.message}
            styles={styles}
            colors={colors}
            ltr
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Text style={styles.hint}>{t("profile.phone_hint")}</Text>
          <View>
            <Text style={styles.label}>{t("auth.email")}</Text>
            <Text style={styles.readonly} selectable>{profile.email}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, (!changed || isPending) && styles.saveBtnDisabled, pressed && styles.pressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleSubmit(values => save(values), () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))();
          }}
          disabled={!changed || isPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed || isPending, busy: isPending }}
        >
          <Text style={styles.saveBtnText}>{t(isPending ? "profile.saving" : "profile.save_changes")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

type Limits = ReturnType<typeof uploadLimitParams>;

/** Uploads a new photo first (when there is one), then saves `PUT /user`. */
function useSaveProfile({ photo, removePhoto, limits, onSaved }: {
  photo: Photo | null;
  removePhoto: boolean;
  limits: Limits;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const applySaved = useApplySavedProfile();
  return useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      let avatarUrl: string | null | undefined;
      if (photo) {
        try {
          avatarUrl = await uploadsApi.uploadImage(photo.uri, photo.mime, "avatar");
        }
        catch (error) {
          throw new AvatarUploadError(error);
        }
      }
      else if (removePhoto) {
        avatarUrl = null;
      }
      return usersApi.updateProfile(toProfileUpdate(values, avatarUrl));
    },
    onSuccess: async (res) => {
      await applySaved(res.data?.data);
      showMessage({ message: t("profile.saved"), type: "success", backgroundColor: SEMANTIC.success });
      onSaved();
    },
    onError: (error) => {
      const message = error instanceof AvatarUploadError
        ? t(uploadErrorKey(error.original) as any, limits)
        : t(profileSaveErrorKey(error) as any);
      showMessage({ message, type: "danger", backgroundColor: SEMANTIC.error });
    },
  });
}

function PhotoSection({ shownPhoto, initial, disabled, limits, onPicked, onRemove, styles, colors }: {
  shownPhoto: string | null;
  initial: string;
  disabled: boolean;
  limits: Limits;
  onPicked: (photo: Photo) => void;
  onRemove: () => void;
  styles: Styles;
  colors: Colors;
}) {
  const { t } = useTranslation();

  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets[0])
        return;
      const asset = result.assets[0];
      const check = validateAsset({ uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize });
      if (!check.ok) {
        showMessage({ message: t(check.errorKey as any, limits), type: "danger", backgroundColor: SEMANTIC.error });
        return;
      }
      onPicked({ uri: asset.uri, mime: check.mime });
    }
    catch {
      showMessage({ message: t("feedback.upload_failed"), type: "danger", backgroundColor: SEMANTIC.error });
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{t("profile.avatar")}</Text>
      <View style={styles.photoRow}>
        <View style={styles.avatar}>
          {shownPhoto
            ? <Image source={{ uri: shownPhoto }} style={styles.avatarImage} contentFit="cover" accessibilityIgnoresInvertColors />
            : <Text style={styles.avatarInitial}>{initial}</Text>}
        </View>
        <View style={styles.photoActions}>
          <Pressable
            style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              pickPhoto();
            }}
            disabled={disabled}
            accessibilityRole="button"
          >
            <ImageSquare size={20} color={"primaryText" in colors ? colors.primaryText : BRAND.gold} />
            <Text style={styles.photoBtnText}>{t(shownPhoto ? "profile.change_photo" : "profile.choose_photo")}</Text>
          </Pressable>
          {shownPhoto
            ? (
                <Pressable
                  style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onRemove();
                  }}
                  disabled={disabled}
                  accessibilityRole="button"
                >
                  <Trash size={20} color={SEMANTIC.error} />
                  <Text style={styles.removeText}>{t("profile.remove_photo")}</Text>
                </Pressable>
              )
            : null}
        </View>
      </View>
      <Text style={styles.hint}>{t("profile.avatar_hint", limits)}</Text>
    </View>
  );
}

function FormField({ name, label, control, error, styles, colors, ltr = false, keyboardType = "default", autoComplete, placeholder }: {
  name: keyof ProfileFormValues;
  label: string;
  control: Control<ProfileFormValues>;
  error?: string;
  styles: Styles;
  colors: Colors;
  ltr?: boolean;
  keyboardType?: "default" | "phone-pad";
  autoComplete?: "name" | "tel";
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, ltr && styles.inputLtr, error ? styles.inputError : null]}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType={keyboardType}
            autoComplete={autoComplete}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={label}
          />
        )}
      />
      {error ? <Text style={styles.errorText}>{t(error as any)}</Text> : null}
    </View>
  );
}

function EditProfileSkeleton({ styles }: { styles: Styles }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("profile.edit")} />
      <View style={styles.scroll}>
        <Skeleton width="100%" height={150} borderRadius={RADIUS.lg} />
        <Skeleton width="100%" height={260} borderRadius={RADIUS.lg} />
      </View>
    </View>
  );
}
