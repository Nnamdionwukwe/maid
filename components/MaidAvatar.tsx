import { View, Image, Text, StyleSheet } from "react-native";
import { VerifiedBadge, ProBadge } from "./MaidBadge";
import { COLORS, FONTS } from "../constants";

interface Props {
  uri?: string | null;
  name?: string;
  size?: number;
  isVerified?: boolean;
  hasProBadge?: boolean;
  plan?: string | null;
}

export default function MaidAvatar({
  uri,
  name,
  size = 52,
  isVerified,
  hasProBadge,
  plan,
}: Props) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const badgeSize = size < 48 ? "sm" : "md";

  return (
    <View style={{ width: size, height: size }}>
      {/* Avatar */}
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={[
            s.placeholder,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[s.initials, { fontSize: size * 0.32 }]}>
            {initials}
          </Text>
        </View>
      )}

      {/* Verified badge — bottom right */}
      {isVerified && (
        <View style={[s.badgeBR, badgeSize === "sm" && s.badgeBRSm]}>
          <VerifiedBadge size={badgeSize} />
        </View>
      )}

      {/* Pro badge — top right, only when has_pro_badge is true */}
      {hasProBadge === true && (
        <View style={[s.badgeTR, badgeSize === "sm" && s.badgeTRSm]}>
          <ProBadge size={badgeSize} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  placeholder: {
    backgroundColor: COLORS.blueLight,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { fontFamily: FONTS.bold, color: COLORS.navy },
  badgeBR: { position: "absolute", bottom: -2, right: -2 },
  badgeBRSm: { bottom: -1, right: -1 },
  badgeTR: { position: "absolute", top: -2, right: -2 },
  badgeTRSm: { top: -1, right: -1 },
});
