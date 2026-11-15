import type { ReactNode } from "react";
import * as Haptics from "expo-haptics";
import { CaretRight } from "phosphor-react-native";
import * as React from "react";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import { useChartColors } from "@/components/finance/charts/use-chart-colors";
import { Skeleton } from "@/components/ui/skeleton";
import { FONT, RADIUS, SPACING } from "@/theme/tokens";

/** A dashboard section card (mockup `.card.p16`). */
export function DashCard({ children, style, testID }: { children: ReactNode; style?: object; testID?: string }) {
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  return <View style={[styles.card, style]} testID={testID}>{children}</View>;
}

/** Section title row (mockup `.mh .h2`) with an optional trailing node. */
export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

/** A 48 dp tappable row: leading icon, title + detail, RTL-safe chevron. */
export function DashRow({ icon, accent, title, detail, onPress, a11y }: {
  icon: ReactNode;
  accent: string;
  title: string;
  detail: string;
  onPress?: () => void;
  a11y?: string;
}) {
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: `${accent}26` }]}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      {onPress ? <CaretRight mirrored={I18nManager.isRTL} size={18} color={c.mut} /> : null}
    </>
  );
  if (!onPress)
    return <View style={styles.row} accessible accessibilityLabel={a11y ?? `${title}. ${detail}`}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? `${title}. ${detail}`}
    >
      {content}
    </Pressable>
  );
}

/** Skeleton in the shape of the dashboard (hero, KPI card, list card): never a spinner. */
export function DashboardSkeleton() {
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  return (
    <View style={styles.skeleton} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="dashboard-skeleton">
      <DashCard style={styles.skeletonHero}>
        <Skeleton width={132} height={132} borderRadius={66} />
        <View style={styles.skeletonLines}>
          <Skeleton width="60%" height={12} />
          <Skeleton width="90%" height={22} />
          <Skeleton width="75%" height={14} />
        </View>
      </DashCard>
      <DashCard>
        <Skeleton width="45%" height={14} />
        <Skeleton width="70%" height={28} style={{ marginTop: SPACING.sm }} />
        <Skeleton width="100%" height={34} style={{ marginTop: SPACING.sm }} />
      </DashCard>
      <DashCard>
        <Skeleton width="50%" height={16} />
        <Skeleton height={48} style={{ marginTop: SPACING.md }} />
        <Skeleton height={48} style={{ marginTop: SPACING.sm }} />
        <Skeleton height={48} style={{ marginTop: SPACING.sm }} />
      </DashCard>
    </View>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: RADIUS.lg, padding: SPACING.base, marginHorizontal: SPACING.base, marginTop: SPACING.md },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md, marginBottom: SPACING.sm, minHeight: 28 },
    title: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 24, color: c.tx, textAlign: "left", flexShrink: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 56, paddingVertical: SPACING.sm },
    pressed: { opacity: 0.8 },
    rowIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 14, lineHeight: 22, color: c.tx, textAlign: "left" },
    rowDetail: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: c.mut, textAlign: "left" },
    skeleton: { paddingBottom: SPACING.base },
    skeletonHero: { flexDirection: "row", alignItems: "center", gap: SPACING.base },
    skeletonLines: { flex: 1, gap: SPACING.sm },
  });
}
