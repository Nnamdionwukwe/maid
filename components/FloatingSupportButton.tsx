import { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { API_URL, COLORS, FONTS } from "../constants";
import { FontAwesome5 } from "@expo/vector-icons";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BTN_SIZE = 56;
const EDGE_PADDING = 16;
const INITIAL_X = SCREEN_W - BTN_SIZE - EDGE_PADDING;
const INITIAL_Y = SCREEN_H - BTN_SIZE - 160; // above tab bar

interface Props {
  onPress?: () => void;
}

export default function FloatingSupportButton({ onPress }: Props) {
  const router = useRouter();
  const { token } = useAuthStore();

  // ── Unread count ────────────────────────────────────────────────
  const { data: unreadData } = useQuery({
    queryKey: ["maid-support-chat-unread"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_URL}/api/maid-support-chat/unread`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { unread: 0 };
        return res.json();
      } catch {
        return { unread: 0 };
      }
    },
    enabled: !!token,
    staleTime: 0,
    refetchInterval: 15000,
  });

  const unread = unreadData?.unread || 0;

  // ── Pulse animation ────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // ── Handle press ──────────────────────────────────────────────
  const handlePress = () => {
    console.log("🔵 Support button pressed");
    if (onPress) {
      onPress();
    } else {
      // Navigate to support chat
      router.push("/support/chat" as any);
    }
  };

  // ── Draggable ──────────────────────────────────────────────────
  const pan = useRef(
    new Animated.ValueXY({ x: INITIAL_X, y: INITIAL_Y }),
  ).current;
  const lastPos = useRef({ x: INITIAL_X, y: INITIAL_Y });
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        isDragging.current = false;
      },
      onPanResponderMove: (_, g) => {
        isDragging.current = true;
        const newX = Math.max(
          EDGE_PADDING,
          Math.min(
            lastPos.current.x + g.dx,
            SCREEN_W - BTN_SIZE - EDGE_PADDING,
          ),
        );
        const newY = Math.max(
          80,
          Math.min(lastPos.current.y + g.dy, SCREEN_H - BTN_SIZE - 100),
        );
        pan.setValue({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, g) => {
        const rawX = lastPos.current.x + g.dx;
        const rawY = Math.max(
          80,
          Math.min(lastPos.current.y + g.dy, SCREEN_H - BTN_SIZE - 100),
        );

        // Snap to nearest horizontal edge
        const snapX =
          rawX < SCREEN_W / 2
            ? EDGE_PADDING
            : SCREEN_W - BTN_SIZE - EDGE_PADDING;

        Animated.spring(pan, {
          toValue: { x: snapX, y: rawY },
          useNativeDriver: false,
          friction: 7,
        }).start();

        lastPos.current = { x: snapX, y: rawY };

        // Only trigger press if it wasn't a drag
        if (!isDragging.current) {
          handlePress();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[
        s.container,
        {
          left: pan.x,
          top: pan.y,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Pulse ring */}
      <Animated.View
        style={[
          s.pulseRing,
          {
            transform: [{ scale: pulse }],
            opacity: pulse.interpolate({
              inputRange: [1, 1.12],
              outputRange: [0.3, 0],
            }),
          },
        ]}
      />

      {/* Button */}
      <TouchableOpacity
        style={s.button}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <FontAwesome5 name="comment-dots" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Unread badge */}
      {unread > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute",
    width: BTN_SIZE,
    height: BTN_SIZE,
    zIndex: 999,
  },
  pulseRing: {
    position: "absolute",
    width: BTN_SIZE + 16,
    height: BTN_SIZE + 16,
    borderRadius: (BTN_SIZE + 16) / 2,
    backgroundColor: COLORS.navy,
    top: -8,
    left: -8,
  },
  button: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: COLORS.navy,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#e53e3e",
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2.5,
    borderColor: COLORS.cream,
  },
  badgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: "#fff",
  },
});
