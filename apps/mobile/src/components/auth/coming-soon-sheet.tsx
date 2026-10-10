import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LandingButton } from "@/components/teaser/landing-button";
import { closeComingSoon, useComingSoonState } from "@/lib/coming-soon";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, SPACING } from "@/theme/tokens";

const MARK = require("../../../assets/brand/mark.png");

/**
 * Global "Coming soon" bottom sheet for guests (web `ComingSoonDialog`), opened through
 * `useGuestGate()` / `openComingSoon()`. Dismiss is the primary action like on the web; Sign in
 * is offered underneath because signed-in residents get every feature.
 */
export function ComingSoonSheet() {
  const { t } = useTranslation();
  const { visible, feature } = useComingSoonState();
  const sheetRef = React.useRef<BottomSheetModal>(null);
  const colors = useAppColors();
  const { bottom } = useSafeAreaInsets();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);

  React.useEffect(() => {
    if (visible)
      sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  function handleSignIn() {
    closeComingSoon();
    router.push("/(auth)/login");
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      onDismiss={closeComingSoon}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={props => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: SPACING.xl + bottom }]}>
        <View style={styles.markWrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={styles.markGlow} />
          <Image source={MARK} style={styles.mark} contentFit="contain" accessible={false} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>{t("access.coming_soon_title")}</Text>
        <Text style={styles.body}>
          {feature ? t(`home.teaser.popup_${feature}`) : t("access.coming_soon_body")}
        </Text>
        <View style={styles.actions}>
          <LandingButton label={t("access.coming_soon_dismiss")} onPress={closeComingSoon} fullWidth />
          <LandingButton label={t("landing.sign_in_cta")} onPress={handleSignIn} variant="outline" fullWidth />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: colors.elevated },
    handle: { backgroundColor: colors.border, width: 40 },
    content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, alignItems: "center" },
    markWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
    markGlow: { position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: `${BRAND.gold}26` },
    mark: { width: 72, height: 72 },
    title: { marginTop: SPACING.base, fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, lineHeight: 30, color: colors.text, textAlign: "center" },
    body: { marginTop: SPACING.sm, fontFamily: FONT.sans, fontSize: 14, lineHeight: 24, color: colors.textMuted, textAlign: "center" },
    actions: { alignSelf: "stretch", marginTop: SPACING.xl, gap: SPACING.sm },
  });
}
