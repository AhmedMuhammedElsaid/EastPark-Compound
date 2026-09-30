import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { SPACING } from "@/theme/tokens";

type Props = {
  children: React.ReactNode;
  scrollable?: boolean;
};

/**
 * Shared wrapper for all auth screens.
 * Dark #0d0c0b background, safe-area aware, keyboard-avoiding.
 */
export function AuthScreenWrapper({ children, scrollable = true }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useStyles(colors);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.bg, { paddingBottom: insets.bottom }]}>
        {scrollable
          ? (
              <ScrollView
                contentContainerStyle={[
                  styles.scroll,
                  { paddingTop: insets.top + SPACING.lg },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            )
          : (
              <View
                style={[
                  styles.scroll,
                  { paddingTop: insets.top + SPACING.lg },
                ]}
              >
                {children}
              </View>
            )}
      </View>
    </KeyboardAvoidingView>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        bg: { flex: 1, backgroundColor: colors.bg },
        scroll: { flexGrow: 1, paddingHorizontal: SPACING.base },
      }),
    [colors],
  );
}
