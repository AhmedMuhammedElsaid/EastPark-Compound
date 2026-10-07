import { Tabs } from "expo-router";
import {
  Compass,
  House,
  ShoppingBag,
  User,
  Users,
} from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT } from "@/theme/tokens";

export default function TabsLayout() {
  const { t } = useTranslation();
  const colors = useAppColors();
  // Edge-to-edge: the tab bar must clear the Android navigation buttons /
  // gesture area itself — a fixed height would draw it underneath them.
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          height: 68 + bottom,
          paddingBottom: 8 + bottom,
          paddingTop: 8,
        },
        // gold-500 fails AA on the light background; LIGHT.primaryText is gold-700.
        tabBarActiveTintColor: "primaryText" in colors ? colors.primaryText : BRAND.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: FONT.sans,
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home.tab_label", "Home"),
          tabBarIcon: ({ color, focused }) => (
            <House color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: t("directory.title"),
          tabBarIcon: ({ color, focused }) => (
            <Compass color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("orders.title"),
          tabBarIcon: ({ color, focused }) => (
            <ShoppingBag color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t("community.title"),
          tabBarIcon: ({ color, focused }) => (
            <Users color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          // Short on purpose: "الملف الشخصي" truncates in the 5-tab bar.
          title: t("profile.tab_label"),
          tabBarIcon: ({ color, focused }) => (
            <User color={color} size={24} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
    </Tabs>
  );
}
