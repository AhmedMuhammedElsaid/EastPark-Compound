import { FlashList } from "@shopify/flash-list";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { House } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";

import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useApplySavedProfile, useProfileQuery } from "@/lib/hooks/use-profile-units";
import { profileSaveErrorKey } from "@/lib/profile-form";
import { canChoosePrimaryFlat, getPrimaryUnit, getUnitLabels } from "@/lib/units";
import { usersApi } from "@/services/api/users";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Colors = ReturnType<typeof useAppColors>;
type Styles = ReturnType<typeof buildStyles>;

function buildStyles(colors: Colors) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    listContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING["2xl"] },
    intro: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, marginBottom: SPACING.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 64,
      gap: SPACING.md,
      paddingHorizontal: SPACING.base,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.sm,
    },
    rowPrimary: { borderColor: BRAND.gold },
    iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${BRAND.gold}1f`, alignItems: "center", justifyContent: "center" },
    label: { flex: 1, fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, fontWeight: "600", color: colors.text },
    badge: { backgroundColor: `${BRAND.gold}1f`, paddingHorizontal: SPACING.md, paddingVertical: 2, borderRadius: RADIUS.full },
    badgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, color: gold },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    radioOn: { borderColor: BRAND.gold },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.gold },
    note: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: SPACING.sm },
    empty: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center", paddingVertical: SPACING.xl },
    skeletonRow: { marginBottom: SPACING.sm },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => buildStyles(colors), [colors]);
}

/**
 * The account's flats (`GET /user/profile` `units`). With two or more, one is
 * chosen as primary (`PUT /user { unitNumber }`): the default delivery flat.
 * Flats are added and removed by the administration only.
 */
export default function MyFlatsScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const user = useAppSelector(s => s.auth.user);
  const { profile, isError, isLoading, isRefetching, refetch } = useProfileQuery();
  const applySaved = useApplySavedProfile();

  // The fresh profile when loaded, otherwise the stored user (offline / first paint).
  const source = profile ?? user;
  const flats = getUnitLabels(source);
  const primary = getPrimaryUnit(source);
  const canChoose = canChoosePrimaryFlat(source);

  const { mutate, isPending, variables } = useMutation({
    mutationFn: (label: string) => usersApi.updateProfile({ unitNumber: label }),
    onSuccess: async (res) => {
      await applySaved(res.data?.data);
      showMessage({ message: t("profile.primary_saved"), type: "success", backgroundColor: SEMANTIC.success });
    },
    onError: (error) => {
      showMessage({ message: t(profileSaveErrorKey(error) as any), type: "danger", backgroundColor: SEMANTIC.error });
    },
  });

  const selected = isPending && variables ? variables : primary;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("profile.my_units")} />
      {isError && !profile && flats.length === 0
        ? <ErrorState onRetry={refetch} />
        : isLoading && flats.length === 0
          ? <FlatsSkeleton styles={styles} />
          : (
              <FlashList
                data={flats}
                keyExtractor={item => item}
                extraData={`${selected}-${isPending}`}
                renderItem={({ item }) => (
                  <FlatRow
                    label={item}
                    isPrimary={item === selected}
                    showBadge={flats.length > 1 && item === selected}
                    selectable={canChoose}
                    disabled={isPending}
                    onSelect={() => {
                      if (item === selected)
                        return;
                      Haptics.selectionAsync();
                      mutate(item);
                    }}
                    styles={styles}
                    iconColor={gold}
                  />
                )}
                contentContainerStyle={styles.listContent}
                onRefresh={refetch}
                refreshing={isRefetching}
                ListHeaderComponent={canChoose ? <Text style={styles.intro}>{t("profile.primary_flat_hint")}</Text> : null}
                ListEmptyComponent={<Text style={styles.empty}>{t("profile.flats_empty")}</Text>}
                ListFooterComponent={<Text style={styles.note}>{t("profile.flats_note")}</Text>}
              />
            )}
    </View>
  );
}

function FlatRow({ label, isPrimary, showBadge, selectable, disabled, onSelect, styles, iconColor }: {
  label: string;
  iconColor: string;
  isPrimary: boolean;
  showBadge: boolean;
  selectable: boolean;
  disabled: boolean;
  onSelect: () => void;
  styles: Styles;
}) {
  const { t } = useTranslation();
  const text = t("checkout.unit", { number: label });
  const content = (
    <>
      <View style={styles.iconWrap}><House size={20} color={iconColor} /></View>
      <Text style={styles.label}>{text}</Text>
      {showBadge ? <View style={styles.badge}><Text style={styles.badgeText}>{t("profile.primary_unit")}</Text></View> : null}
      {selectable
        ? <View style={[styles.radio, isPrimary && styles.radioOn]}>{isPrimary ? <View style={styles.radioDot} /> : null}</View>
        : null}
    </>
  );
  if (!selectable)
    return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, isPrimary && styles.rowPrimary, pressed && styles.pressed]}
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={text}
      accessibilityHint={t("profile.make_primary_hint")}
      accessibilityState={{ checked: isPrimary, disabled }}
    >
      {content}
    </Pressable>
  );
}

function FlatsSkeleton({ styles }: { styles: Styles }) {
  return (
    <View style={styles.listContent}>
      {["a", "b"].map(k => (
        <Skeleton key={`flat-skeleton-${k}`} width="100%" height={64} borderRadius={RADIUS.lg} style={styles.skeletonRow} />
      ))}
    </View>
  );
}
