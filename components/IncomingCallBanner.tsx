import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useCallStore } from "../stores/callStore";
import { useAuthStore } from "../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../constants";

export default function IncomingCallBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuthStore();
  const { incomingCall, clearIncomingCall, setProcessing, isProcessing } =
    useCallStore();

  // Don't show on video-call screen
  if (pathname === "/video-call") return null;

  async function declineCall() {
    if (!incomingCall || isProcessing) return;
    setProcessing(true);
    try {
      await fetch(
        `${API_URL}/api/bookings/${incomingCall.booking_id}/video-call`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch {}
    clearIncomingCall();
  }

  function acceptCall() {
    if (!incomingCall || isProcessing) return;
    setProcessing(true);
    const callData = incomingCall;
    clearIncomingCall();
    setProcessing(true); // re-set to true
    router.push({
      pathname: "/video-call",
      params: {
        booking_id: callData.booking_id,
        channel: callData.channel,
        token: callData.token,
        app_id: callData.app_id,
        caller_name: callData.caller_name,
      },
    } as any);
    setTimeout(() => {
      setProcessing(false);
    }, 10000);
  }

  if (!incomingCall) return null;

  return (
    <Modal transparent visible={!!incomingCall} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <FontAwesome5
              name="phone"
              size={24}
              color="#22c55e"
              style={styles.ringingIcon}
            />
            <TouchableOpacity onPress={declineCall} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={18} color="#aaa" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Incoming Video Call</Text>
          <Text style={styles.caller}>
            {incomingCall.caller_name} is calling you
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.declineBtn]}
              onPress={declineCall}
            >
              <Text style={styles.btnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn]}
              onPress={acceptCall}
            >
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1a1a2e",
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: "85%",
    maxWidth: 340,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: SPACING.md,
  },
  ringingIcon: { transform: [{ rotate: "15deg" }] },
  closeBtn: { padding: 4 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: "#fff",
    marginBottom: 4,
  },
  caller: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: "#ccc",
    marginBottom: SPACING.lg,
  },
  actions: { flexDirection: "row", gap: 16, width: "100%" },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  declineBtn: { backgroundColor: "#dc2626" },
  acceptBtn: { backgroundColor: "#22c55e" },
  btnText: { fontFamily: FONTS.bold, fontSize: 16, color: "#fff" },
});
