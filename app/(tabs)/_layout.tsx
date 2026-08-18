import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS } from "../../constants";
import { FontAwesome5 } from "@expo/vector-icons";

export default function MaidTabLayout() {
  const { token } = useAuthStore();
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setUnreadNotifs(d.count || 0);
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 20000);
    return () => clearInterval(iv);
  }, [token]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.navy,
        tabBarInactiveTintColor: COLORS.grayLight,
        tabBarLabelStyle: {
          fontFamily: FONTS.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="home" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="money-bill-wave" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="wallet" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: "Reviews",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="star" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="user" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
