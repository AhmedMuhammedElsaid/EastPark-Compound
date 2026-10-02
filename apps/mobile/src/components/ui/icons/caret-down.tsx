import type { SvgProps } from "react-native-svg";
import * as React from "react";
import Svg, { Path } from "react-native-svg";

import { useAppColors } from "@/lib/hooks/use-app-colors";

export function CaretDown({ ...props }: SvgProps) {
  const colors = useAppColors();
  return (
    <Svg
      width={12}
      height={13}
      fill="none"
      {...props}
    >
      <Path
        stroke={colors.text}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.75 4.744 6 8.494l-3.75-3.75"
      />
    </Svg>
  );
}
