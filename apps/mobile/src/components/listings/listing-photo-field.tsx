import type { ListingPhoto } from "@/lib/listings";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Image as ImageIcon, Star, X } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { LISTING_MAX_PHOTOS, listingPhotoParams, makeCover, validateListingAsset } from "@/lib/listings";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;
type Props = {
  photos: ListingPhoto[];
  onChange: (next: ListingPhoto[]) => void;
  /** Uploading: thumbnails dim and cannot be changed. */
  busy: boolean;
  disabled: boolean;
  error?: string;
};

const THUMB = 96;

function buildStyles(colors: Colors) {
  return StyleSheet.create({
    section: { gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    hint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: colors.textMuted },
    errorText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    actionBtn: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.base,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    actionText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    off: { opacity: 0.5 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    thumbs: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
    thumb: { width: THUMB, height: THUMB, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: colors.elevated },
    thumbCover: { borderWidth: 2, borderColor: BRAND.gold },
    thumbImg: { width: "100%", height: "100%" },
    busyVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: `${BRAND.ink}99` },
    coverBadge: {
      position: "absolute",
      bottom: SPACING.xs,
      start: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.full,
      backgroundColor: BRAND.gold,
    },
    coverText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 11, lineHeight: 18, color: BRAND.ink },
    cornerBtn: { position: "absolute", width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    topEnd: { top: 0, end: 0 },
    bottomStart: { bottom: 0, start: 0 },
    dot: {
      width: 26,
      height: 26,
      borderRadius: RADIUS.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${BRAND.ink}cc`,
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

/** Library / camera picker: validates each asset, skips duplicates and caps the total at 8. */
function useListingPhotoPicker(photos: ListingPhoto[], onChange: (next: ListingPhoto[]) => void) {
  const { t, i18n } = useTranslation();
  const params = listingPhotoParams(i18n.language);

  return async function add(source: "library" | "camera") {
    const remaining = LISTING_MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      showMessage({ message: t("listings.photo_limit", params), type: "warning", backgroundColor: SEMANTIC.warning });
      return;
    }
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.7,
        ...(source === "library" ? { allowsMultipleSelection: true, selectionLimit: remaining } : {}),
      };
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled)
        return;
      const known = new Set(photos.map(p => p.uri));
      const picked: ListingPhoto[] = [];
      for (const asset of result.assets) {
        if (known.has(asset.uri))
          continue;
        const check = validateListingAsset({ uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize });
        if (check.ok) {
          picked.push({ uri: asset.uri, mime: check.mime });
          known.add(asset.uri);
        }
        else {
          showMessage({ message: t(check.errorKey as any, params), type: "danger", backgroundColor: SEMANTIC.error });
        }
      }
      if (picked.length > remaining)
        showMessage({ message: t("listings.photo_limit", params), type: "warning", backgroundColor: SEMANTIC.warning });
      if (picked.length)
        onChange([...photos, ...picked].slice(0, LISTING_MAX_PHOTOS));
    }
    catch {
      showMessage({ message: t("feedback.upload_failed"), type: "danger", backgroundColor: SEMANTIC.error });
    }
  };
}

/** 1–8 photos: pick from the library or the camera, remove, and choose the cover (index 0). */
export function ListingPhotoField({ photos, onChange, busy, disabled, error }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const params = listingPhotoParams(i18n.language);
  const full = photos.length >= LISTING_MAX_PHOTOS;
  const locked = disabled || busy;
  const add = useListingPhotoPicker(photos, onChange);

  const actionButton = (source: "library" | "camera") => {
    const label = t(source === "library" ? "feedback.add_photo" : "feedback.take_photo");
    const off = full || locked;
    return (
      <Pressable
        style={({ pressed }) => [styles.actionBtn, off && styles.off, pressed && styles.pressed]}
        onPress={() => add(source)}
        disabled={off}
        accessibilityRole="button"
        accessibilityState={{ disabled: off }}
        accessibilityLabel={label}
      >
        {source === "library" ? <ImageIcon size={20} color={gold} /> : <Camera size={20} color={gold} />}
        <Text style={styles.actionText}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("listings.photos")}</Text>
      <Text style={styles.hint}>{t("listings.photos_hint", params)}</Text>
      <View style={styles.actions}>
        {actionButton("library")}
        {actionButton("camera")}
      </View>
      {photos.length > 0 && (
        <View style={styles.thumbs}>
          {photos.map((photo, index) => (
            <PhotoThumb
              key={photo.uri}
              photo={photo}
              index={index}
              total={photos.length}
              busy={busy}
              locked={locked}
              onRemove={() => onChange(photos.filter(p => p.uri !== photo.uri))}
              onMakeCover={() => onChange(makeCover(photos, index))}
              styles={styles}
            />
          ))}
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function PhotoThumb({ photo, index, total, busy, locked, onRemove, onMakeCover, styles }: {
  photo: ListingPhoto;
  index: number;
  total: number;
  busy: boolean;
  locked: boolean;
  onRemove: () => void;
  onMakeCover: () => void;
  styles: Styles;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.thumb, index === 0 && styles.thumbCover]}>
      <Image
        source={{ uri: photo.uri }}
        style={styles.thumbImg}
        contentFit="cover"
        accessibilityLabel={t("listings.photo_position", { current: index + 1, total })}
      />
      {index === 0 && (
        <View style={styles.coverBadge} pointerEvents="none">
          <Text style={styles.coverText}>{t("listings.cover")}</Text>
        </View>
      )}
      {busy
        ? <View style={styles.busyVeil} />
        : (
            <>
              <Pressable
                style={[styles.cornerBtn, styles.topEnd]}
                onPress={onRemove}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={t("feedback.remove_photo")}
              >
                <View style={styles.dot}><X size={14} color={BRAND.gold} weight="bold" /></View>
              </Pressable>
              {index > 0 && (
                <Pressable
                  style={[styles.cornerBtn, styles.bottomStart]}
                  onPress={onMakeCover}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={t("listings.make_cover")}
                >
                  <View style={styles.dot}><Star size={14} color={BRAND.gold} weight="bold" /></View>
                </Pressable>
              )}
            </>
          )}
    </View>
  );
}
