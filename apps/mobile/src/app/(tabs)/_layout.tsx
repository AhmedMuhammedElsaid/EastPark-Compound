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

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND } from "@/theme/tokens";

export default function TabsLayout() {
  const { t } = useTranslation();
  const colors = useAppColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: BRAND.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: "Cairo",
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home.tab_label", "Home"),
          tabBarIcon: ({ color, size }) => (
            <House color={color} size={size ?? 24} weight="fill" />
          ),
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: t("directory.title"),
          tabBarIcon: ({ color, size }) => (
            <Compass color={color} size={size ?? 24} weight="fill" />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("orders.title"),
          tabBarIcon: ({ color, size }) => (
            <ShoppingBag color={color} size={size ?? 24} weight="fill" />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t("community.title"),
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={size ?? 24} weight="fill" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile.title"),
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size ?? 24} weight="fill" />
          ),
        }}
      />
    </Tabs>
  );
}
