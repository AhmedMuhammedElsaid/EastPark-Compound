import * as React from "react";
import { useImperativeHandle } from "react";
import { Animated, Easing, View } from "react-native";
import { twMerge } from "tailwind-merge";

type Props = {
  initialProgress?: number;
  className?: string;
};

export type ProgressBarRef = {
  setProgress: (value: number) => void;
};

export function ProgressBar({ ref, initialProgress = 0, className = "" }: Props & { ref?: React.RefObject<ProgressBarRef | null> }) {
  const progress = React.useRef(new Animated.Value(initialProgress ?? 0)).current;

  const widthPercent = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  useImperativeHandle(ref, () => {
    return {
      setProgress: (value: number) => {
        Animated.timing(progress, {
          toValue: value,
          duration: 250,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }).start();
      },
    };
  }, [progress]);

  return (
    <View className={twMerge(`bg-[#EAEAEA]`, className)}>
      <Animated.View style={{ width: widthPercent, backgroundColor: "#000", height: 2 }} />
    </View>
  );
}
