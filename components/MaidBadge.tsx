import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS, FONTS } from "../constants";

const PLAN_LABELS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pro: { label: "PRO", color: "#fff", bg: "#1e3a8a" },
  pro_plus: { label: "PRO+", color: "#fff", bg: "#7c3aed" },
  basic: { label: "BASIC", color: "#1e3a8a", bg: "#dbeafe" },
  verified: { label: "VERIFIED", color: "#fff", bg: "#16a34a" },
};

interface Props {
  plan?: string | null;
  isVerified?: boolean;
  hasProBadge?: boolean;
  size?: "sm" | "md";
}

export function SubscriptionBadge({
  plan,
  size = "md",
}: {
  plan?: string | null;
  size?: "sm" | "md";
}) {
  if (!plan || plan === "free" || plan === "null") return null;
  const cfg = PLAN_LABELS[plan] || {
    label: plan.toUpperCase(),
    color: "#fff",
    bg: COLORS.navy,
  };
  return (
    <View
      style={[s.pill, { backgroundColor: cfg.bg }, size === "sm" && s.pillSm]}
    >
      <Text
        style={[
          s.pillText,
          { color: cfg.color },
          size === "sm" && s.pillTextSm,
        ]}
      >
        {cfg.label}
      </Text>
    </View>
  );
}

export function VerifiedBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 9 : 12;
  return (
    <View style={[s.verifiedBadge, size === "sm" && s.verifiedBadgeSm]}>
      <FontAwesome5 name="check" size={iconSize} color="#fff" />
    </View>
  );
}

export function ProBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 10 : 13;
  return (
    <View style={[s.proBadge, size === "sm" && s.proBadgeSm]}>
      <FontAwesome5 name="medal" size={iconSize} color="#92400e" />
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  pillSm: { paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 0.5 },
  pillTextSm: { fontSize: 9 },

  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  verifiedBadgeSm: { width: 16, height: 16, borderRadius: 8 },

  proBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fbbf24",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  proBadgeSm: { width: 18, height: 18, borderRadius: 9 },
});
