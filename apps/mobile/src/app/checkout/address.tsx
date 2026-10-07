import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { MapPin } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { showMessage } from "react-native-flash-message";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoldButton } from "@/components/auth/gold-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useEmptyCartGuard } from "@/lib/hooks/use-empty-cart-guard";
import { useRefreshProfileUnits } from "@/lib/hooks/use-profile-units";
import { getDeliveryUnitOptions, resolveDeliveryUnit } from "@/lib/units";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  const goldText = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.lg },
    section: { gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: colors.text },
    optional: { fontFamily: FONT.sans, fontWeight: "400", fontSize: 13, color: colors.textMuted },
    unitBox: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.md,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unitBoxEmpty: { borderColor: `${BRAND.gold}66` },
    unitLabel: { flex: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 16, lineHeight: 24, color: colors.text },
    unitOption: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      minHeight: 52,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.md,
    },
    unitOptionSelected: { borderColor: BRAND.gold, backgroundColor: `${BRAND.gold}14` },
    unitOptionText: { flex: 1, fontFamily: FONT.sans, fontWeight: "500", fontSize: 15, lineHeight: 24, color: colors.textMuted },
    unitOptionTextSelected: { color: colors.text },
    unitTag: {
      fontFamily: FONT.sans,
      fontSize: 12,
      lineHeight: 18,
      color: goldText,
      fontWeight: "600",
      backgroundColor: `${BRAND.gold}1f`,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
      overflow: "hidden" as const,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    radioSelected: { borderColor: BRAND.gold },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.gold },
    unitHint: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    notesInput: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.base,
      paddingTop: SPACING.md,
      fontFamily: FONT.sans,
      fontSize: 14,
      lineHeight: 22,
      color: colors.text,
      height: 110,
      textAlignVertical: "top" as const,
    },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

// eslint-disable-next-line max-lines-per-function
export default function AddressScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(s => s.auth.user);
  const [notes, setNotes] = React.useState("");
  const [chosenUnit, setChosenUnit] = React.useState<string | null>(null);
  useRefreshProfileUnits();
  useEmptyCartGuard();
  const unitOptions = getDeliveryUnitOptions(user);
  const deliveryUnit = resolveDeliveryUnit(user, chosenUnit);
  const { styles, colors } = useStyles();

  function handleNext() {
    if (!deliveryUnit) {
      // Never a dead button: explain why we can't continue.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showMessage({ message: t("checkout.unit_missing"), type: "warning" });
      return;
    }
    router.push({ pathname: "/checkout/payment", params: { notes, deliveryUnit } });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title={t("checkout.title")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.label}>{t("checkout.address")}</Text>
          {unitOptions.length > 1
            ? (
                <>
                  <Text style={styles.unitHint}>{t("checkout.choose_unit")}</Text>
                  {unitOptions.map((label, index) => {
                    const selected = label === deliveryUnit;
                    return (
                      <Pressable
                        key={label}
                        style={({ pressed }) => [styles.unitOption, selected && styles.unitOptionSelected, pressed && { opacity: 0.85 }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setChosenUnit(label);
                        }}
                        accessibilityRole="radio"
                        accessibilityLabel={t("checkout.unit", { number: label })}
                        accessibilityState={{ checked: selected }}
                      >
                        <Text style={[styles.unitOptionText, selected && styles.unitOptionTextSelected]}>
                          {t("checkout.unit", { number: label })}
                        </Text>
                        {index === 0 ? <Text style={styles.unitTag}>{t("checkout.unit_primary_tag")}</Text> : null}
                        <View style={[styles.radio, selected && styles.radioSelected]}>
                          {selected && <View style={styles.radioInner} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              )
            : deliveryUnit
              ? (
                  <View style={styles.unitBox}>
                    <MapPin size={22} color={BRAND.gold} weight="duotone" />
                    <Text style={styles.unitLabel}>{t("checkout.unit", { number: deliveryUnit })}</Text>
                  </View>
                )
              : (
                  <>
                    <View style={[styles.unitBox, styles.unitBoxEmpty]}>
                      <MapPin size={22} color={colors.textMuted} />
                      <Text style={[styles.unitLabel, { fontWeight: "400", fontSize: 14 }]}>{t("checkout.unit_missing")}</Text>
                    </View>
                    <GoldButton
                      label={t("checkout.go_profile")}
                      variant="outline"
                      onPress={() => router.push("/(tabs)/profile")}
                    />
                  </>
                )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>
            {t("checkout.notes")}
            {" "}
            <Text style={styles.optional}>
              (
              {t("common.optional")}
              )
            </Text>
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t("checkout.notes_placeholder")}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={300}
            style={styles.notesInput}
          />
        </View>

        <GoldButton label={t("common.next")} onPress={handleNext} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
