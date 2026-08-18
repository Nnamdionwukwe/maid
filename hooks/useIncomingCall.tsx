import { useState, useEffect, useRef } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../constants";
import { FontAwesome5 } from "@expo/vector-icons";

export function useIncomingCall() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const pollRef = useRef<any>(null);
  const processing = useRef(false);

  useEffect(() => {
    if (!token) return;

    const poll = async () => {
      if (processing.current) return;
      try {
        const res = await fetch(`${API_URL}/api/bookings/active-call`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.call) {
          setIncomingCall(data.call);
          setShowModal(true);
        } else {
          setShowModal(false);
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [token]);

  const acceptCall = () => {
    if (!incomingCall) return;
    processing.current = true;
    setShowModal(false);
    router.push({
      pathname: "/bookings/[id]",
      params: { id: incomingCall.booking_id },
    } as any);
    // The booking detail screen will read state.incomingCall from the navigation
    // We can pass it via navigation params or global state; easiest: pass as params
    // We'll use a global store or context, but for simplicity we can pass as route params.
    // We'll also need to handle the call start in the booking detail.
    // We can store the call data in a global store like Zustand.
    // For this example, we'll use a global state (Zustand) to hold the incoming call.
    // Alternatively, we can navigate and pass as params.
    // We'll assume we have a global store for incomingCall.
    setTimeout(() => {
      processing.current = false;
    }, 5000);
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    try {
      await fetch(
        `${API_URL}/api/bookings/${incomingCall.booking_id}/video-call`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch {}
    setShowModal(false);
    setIncomingCall(null);
  };

  const IncomingCallModal = () => {
    if (!showModal || !incomingCall) return null;
    return (
      <Modal transparent visible={showModal} animationType="fade">
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
  };

  return { IncomingCallModal };
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
