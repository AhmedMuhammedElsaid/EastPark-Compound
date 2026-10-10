import type { TeaserPalette } from "./use-teaser-palette";
import { Check, Lock } from "phosphor-react-native";
import * as React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { SPACING } from "@/theme/tokens";

import { TEASER_TYPE } from "./teaser-type";
import { useTeaserPalette } from "./use-teaser-palette";

export type TimelineStatus = "live" | "preparing" | "next" | "step";

export type TimelineItem = {
  key: string;
  label: string;
  /** Small line above the label: the phase status ("Live", "Preparing", …). */
  kicker?: string;
  /** Optional sentence under the label (join-flow steps). */
  caption?: string;
  status: TimelineStatus;
};

const NODE = 32;

/**
 * The teaser timeline shared by the rollout phases and the join steps (web `TeaserTimeline`, phone
 * layout: vertical). `live` gets a check, `preparing` pulses, `next` is locked and `step` shows its
 * number. Labels only — never dates or progress numbers.
 */
export function TeaserTimeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <View accessibilityRole="list" accessibilityLabel={label} style={styles.list}>
      {items.map((item, index) => (
        <TimelineStep key={item.key} item={item} index={index} last={index === items.length - 1} />
      ))}
    </View>
  );
}

function TimelineStep({ item, index, last }: { item: TimelineItem; index: number; last: boolean }) {
  const palette = useTeaserPalette();
  const { status } = item;
  const highlighted = status === "live" || status === "preparing";
  return (
    <View style={[styles.step, !last && styles.stepGap]}>
      {!last && (
        <View
          style={[styles.connector, { backgroundColor: status === "live" ? palette.node : palette.track }]}
        />
      )}
      <StepNode status={status} index={index} palette={palette} />
      <View style={styles.body}>
        {item.kicker
          ? <Text style={[TEASER_TYPE.caption, { color: highlighted ? palette.gold : palette.textMuted }]}>{item.kicker}</Text>
          : null}
        <Text style={[styles.label, { color: palette.text }]}>{item.label}</Text>
        {item.caption
          ? <Text style={[TEASER_TYPE.label, styles.caption, { color: palette.textMuted }]}>{item.caption}</Text>
          : null}
      </View>
    </View>
  );
}

function StepNode({ status, index, palette }: { status: TimelineStatus; index: number; palette: TeaserPalette }) {
  switch (status) {
    case "live":
      return (
        <View style={[styles.node, { backgroundColor: palette.node, borderColor: palette.node }]}>
          <Check size={16} weight="bold" color={palette.nodeForeground} />
        </View>
      );
    case "preparing":
      return (
        <View style={[styles.node, { borderColor: palette.node }]}>
          <PulseDot color={palette.node} />
        </View>
      );
    case "next":
      return (
        <View style={[styles.node, styles.nodeLocked, { borderColor: palette.track }]}>
          <Lock size={14} color={palette.textMuted} />
        </View>
      );
    default:
      return (
        <View style={[styles.node, { borderColor: palette.track }]}>
          <Text style={[TEASER_TYPE.label, styles.number, { color: palette.text }]}>{index + 1}</Text>
        </View>
      );
  }
}

/** The current phase's breathing dot; still under reduced motion. */
function PulseDot({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const [pulse] = React.useState(() => new Animated.Value(1));
  React.useEffect(() => {
    if (reduced) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return <Animated.View style={[styles.pulse, { backgroundColor: color, opacity: pulse }]} />;
}

const styles = StyleSheet.create({
  list: { marginTop: SPACING.base },
  step: { flexDirection: "row", gap: SPACING.base },
  stepGap: { paddingBottom: 28 },
  connector: { position: "absolute", start: NODE / 2 - 1, top: NODE + 4, bottom: 4, width: 2, borderRadius: 1 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLocked: { opacity: 0.75 },
  number: { fontWeight: "700" },
  pulse: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1, minWidth: 0, paddingTop: 4 },
  label: { ...TEASER_TYPE.body, fontWeight: "700", lineHeight: 22, marginTop: 2 },
  caption: { marginTop: 6, lineHeight: 22 },
});
