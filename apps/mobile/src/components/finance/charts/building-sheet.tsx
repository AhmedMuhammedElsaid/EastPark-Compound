import type { DashBuilding } from "./types";
import type { FinanceFlatListItem } from "@/services/api/finance";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, useBottomSheetTimingConfigs } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FinanceFlatRow, FinanceFlatRowSkeleton } from "@/components/finance/finance-ui";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

import { num } from "./geometry";
import { HBars } from "./hbars";
import { useChartColors } from "./use-chart-colors";

type Props = {
  /** The tapped building, or null when the sheet is closed. */
  building: DashBuilding | null;
  /** First page of `GET /finance/flats?building=<code>&hasBalance=true&sort=balance&asOf=D` (section 6 item 9). */
  flats: readonly FinanceFlatListItem[] | undefined;
  flatsLoading?: boolean;
  flatsError?: boolean;
  onRetryFlats?: () => void;
  onFlatPress: (flat: FinanceFlatListItem) => void;
  /** Opens the flats list filtered to this building. */
  onViewFlats: (code: string) => void;
  /** Swipe down, backdrop tap or Android back: clear the selection and return focus to the building. */
  onClose: () => void;
};

/** Building bottom sheet (mockup frame 3): grab handle, owing count, outstanding, per-floor bars, owing flats. */
export function BuildingSheet({ building, flats, flatsLoading, flatsError, onRetryFlats, onFlatPress, onViewFlats, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const { bottom } = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const timing = useBottomSheetTimingConfigs({ duration: reduceMotion ? 1 : 250 });
  const sheetRef = React.useRef<BottomSheetModal>(null);
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const lastCode = React.useRef<string | null>(null);
  const shown = building ?? undefined;
  if (building)
    lastCode.current = building.building;

  React.useEffect(() => {
    if (building)
      sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [building]);

  // Android back closes the sheet (gorhom does not handle it): consume the press while the sheet is open AND this
  // screen is focused, so a route pushed from the sheet (flat, "View flats") gets its own back press.
  // `dismiss()` animates down and fires `onDismiss` -> `onClose`, which returns focus to the building.
  useFocusEffect(React.useCallback(() => {
    if (!building)
      return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      sheetRef.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [building]));

  const floors = (shown?.floors ?? []).map(f => ({
    key: f.floor,
    label: f.floor,
    value: num(f.outstanding),
    a11y: t("finance.dash.floor_a11y", { floor: f.floor, amount: formatMoney(f.outstanding) }),
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["70%"]}
      enablePanDownToClose
      onDismiss={onClose}
      animationConfigs={timing}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={props => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} pressBehavior="close" />
      )}
    >
      <View style={styles.flex} accessibilityViewIsModal>
        <BottomSheetScrollView contentContainerStyle={styles.body}>
          {shown
            ? (
                <>
                  <View style={styles.titleRow}>
                    <Text style={styles.code} accessibilityRole="header">{shown.building}</Text>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{t("finance.dash.flats_owing_pill", { owing: formatNumber(shown.owingFlats, i18n.language), total: formatNumber(shown.totalFlats, i18n.language) })}</Text>
                    </View>
                  </View>
                  <Text style={styles.amount}>{formatMoney(shown.outstanding)}</Text>
                  <Text style={styles.muted}>{t("finance.dash.outstanding")}</Text>
                  <Text style={styles.sub}>{t("finance.dash.by_floor")}</Text>
                  <HBars items={floors} label={t("finance.dash.by_floor")} color="a3" />
                  <Text style={styles.sub}>{t("finance.dash.owing_flats")}</Text>
                  {flatsLoading
                    ? (
                        <>
                          <FinanceFlatRowSkeleton />
                          <FinanceFlatRowSkeleton />
                        </>
                      )
                    : flatsError
                      ? (
                          <View style={styles.errorBox}>
                            <Text style={styles.muted}>{t("finance.dash.flats_error")}</Text>
                            <Pressable style={styles.retry} onPress={onRetryFlats} accessibilityRole="button">
                              <Text style={styles.retryText}>{t("common.retry")}</Text>
                            </Pressable>
                          </View>
                        )
                      : (flats ?? []).length === 0
                          ? <Text style={styles.muted}>{t("finance.dash.no_owing_flats")}</Text>
                          : (flats ?? []).map(flat => <FinanceFlatRow key={flat.id} flat={flat} onPress={() => onFlatPress(flat)} />)}
                </>
              )
            : null}
        </BottomSheetScrollView>
        <View style={[styles.footer, { paddingBottom: SPACING.base + bottom }]}>
          <Pressable
            style={styles.primary}
            onPress={() => {
              Haptics.selectionAsync();
              if (shown)
                onViewFlats(shown.building);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("finance.dash.view_flats")}
          >
            <Text style={styles.primaryText}>{t("finance.dash.view_flats")}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    sheetBg: { backgroundColor: c.elev, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
    handle: { backgroundColor: c.mut, width: 40, height: 5, opacity: 0.6 },
    body: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.base },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
    code: { fontFamily: FONT.display, fontSize: 44, lineHeight: 52, color: c.gold },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.line },
    pillText: { fontFamily: FONT.sans, fontSize: 12, color: c.tx },
    amount: { fontFamily: FONT.sans, fontWeight: "300", fontSize: 26, lineHeight: 38, color: c.tx, textAlign: "left" },
    muted: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: c.mut, textAlign: "left" },
    sub: { fontFamily: FONT.sans, fontSize: 12, color: c.mut, marginTop: SPACING.base, marginBottom: 6, textAlign: "left" },
    errorBox: { gap: SPACING.sm, alignItems: "flex-start" },
    retry: { minHeight: 48, paddingHorizontal: SPACING.base, justifyContent: "center" },
    retryText: { fontFamily: FONT.sans, fontSize: 13, color: c.gold },
    footer: { flexDirection: "row", gap: 10, paddingHorizontal: SPACING.base, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.elev },
    primary: { flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: BRAND.gold, alignItems: "center", justifyContent: "center" },
    primaryText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, color: "#1a1612" },
  });
}
