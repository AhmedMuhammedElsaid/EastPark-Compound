import { router } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
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

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppSelector } from "@/store";
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
    navTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    scroll: { padding: SPACING.base, gap: SPACING.lg },
    section: { gap: SPACING.sm },
    label: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text },
    optional: { fontFamily: FONT.sans, fontWeight: "400", fontSize: 13, color: colors.textMuted },
    unitBox: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unitLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 16, color: colors.text },
    unitHint: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    notesInput: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      fontFamily: FONT.sans,
      fontSize: 14,
      color: colors.text,
      height: 100,
      textAlignVertical: "top" as const,
    },
    nextBtn: {
      height: 52,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    nextBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
  }), [colors]);
}

export default function AddressScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(s => s.auth.user);
  const [notes, setNotes] = React.useState("");
  const styles = useStyles();
  const colors = useAppColors();

  function handleNext() {
    router.push({ pathname: "/checkout/payment", params: { notes } });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.nav, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("checkout.title")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.label}>{t("checkout.address")}</Text>
          <View style={styles.unitBox}>
            <Text style={styles.unitLabel}>{t("checkout.unit", { number: user?.unitNumber ?? "" })}</Text>
          </View>
          <Text style={styles.unitHint}>
            {t("auth.unit_number")}
            :
            {" "}
            {user?.unitNumber}
          </Text>
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
            style={styles.notesInput}
          />
        </View>

        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>{t("common.next")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
