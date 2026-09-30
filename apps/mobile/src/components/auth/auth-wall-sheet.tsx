import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/auth/brand-mark";
import { GoldButton } from "@/components/auth/gold-button";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppDispatch, useAppSelector } from "@/store";
import { hideAuthWall } from "@/store/slices/auth-slice";
import { FONT, SPACING } from "@/theme/tokens";

/**
 * Global auth-wall bottom sheet.
 * Rendered once in _layout.tsx, controlled by Redux authSlice.showAuthWall.
 * When the user logs in via this sheet, the pending redirectAction auto-replays.
 */
export function AuthWallSheet() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const showAuthWall = useAppSelector(s => s.auth.showAuthWall);
  const authWallConfig = useAppSelector(s => s.auth.authWallConfig);
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const colors = useAppColors();
  const styles = useStyles(colors);

  React.useEffect(() => {
    if (showAuthWall) {
      bottomSheetRef.current?.present();
    }
    else {
      bottomSheetRef.current?.dismiss();
    }
  }, [showAuthWall]);

  function handleDismiss() {
    dispatch(hideAuthWall());
  }

  function handleLogin() {
    handleDismiss();
    router.push("/(auth)/login");
  }

  function handleRegister() {
    handleDismiss();
    router.push("/(auth)/register");
  }

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={["42%"]}
      enablePanDownToClose
      onDismiss={handleDismiss}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={props => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.6}
        />
      )}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.logoRow}>
          <BrandMark size="sm" />
        </View>

        {authWallConfig?.message
          ? (
              <Text style={styles.message}>{authWallConfig.message}</Text>
            )
          : null}

        <GoldButton
          label={t("auth.login")}
          onPress={handleLogin}
          variant="filled"
        />

        <GoldButton
          label={t("auth.register")}
          onPress={handleRegister}
          variant="outline"
        />

        <GoldButton
          label={t("auth.continue_as_guest")}
          onPress={handleDismiss}
          variant="ghost"
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        sheetBg: { backgroundColor: colors.elevated },
        handle: { backgroundColor: colors.border, width: 40 },
        content: {
          flex: 1,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          gap: SPACING.sm,
        },
        logoRow: {
          alignItems: "center",
          paddingVertical: SPACING.lg,
        },
        message: {
          fontFamily: FONT.sans,
          fontSize: 14,
          color: colors.textMuted,
          textAlign: "center",
          marginBottom: SPACING.xs,
        },
      }),
    [colors],
  );
}
