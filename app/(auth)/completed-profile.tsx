import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { useAppToast } from "../../components/AppToast";

import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { refreshUser } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const { toast } = useAppToast();

  async function handleSubmit() {
    if (!phone.trim()) {
      toast({
        type: "warning",
        title: "Required",
        message: "Please enter your phone number.",
      });
      return;
    }
    const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;
    if (!phoneRegex.test(phone)) {
      toast({
        type: "warning",
        title: "Invalid phone",
        message:
          "Please enter a valid phone number with country code, e.g. +234 800 000 0000",
      });
      return;
    }
    setLoading(true);
    try {
      // ...existing fetch code...
      await refreshUser();
      router.replace("/(tabs)");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Error",
        message: err.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.cream }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.container}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.emoji}>📱</Text>
            <Text style={s.title}>One last step</Text>
            <Text style={s.sub}>
              Hi {name ? name.split(" ")[0] : "there"}! Add your phone number so
              maids can reach you about your bookings.
            </Text>
          </View>

          {/* Input */}
          <View style={s.card}>
            <Text style={s.label}>Phone number</Text>
            <TextInput
              style={s.input}
              placeholder="+234 800 000 0000"
              placeholderTextColor={COLORS.grayLight}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
            />
            <Text style={s.hint}>Include your country code</Text>

            {/* Submit */}
            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>Save & Continue</Text>
              )}
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
              <Text style={s.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>

          {/* Why */}
          <View style={s.whyCard}>
            <Text style={s.whyTitle}>Why we ask for your number</Text>
            <Text style={s.whyItem}>
              📞 Maid can call if they can't find your location
            </Text>
            <Text style={s.whyItem}>🔔 SMS updates on your booking status</Text>
            <Text style={s.whyItem}>
              🚨 Emergency contact during SOS alerts
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  header: { alignItems: "center", marginBottom: SPACING.xl },
  emoji: { fontSize: 56, marginBottom: SPACING.lg },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.navy,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 24,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  label: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontFamily: FONTS.regular,
    fontSize: 18,
    color: COLORS.navy,
    backgroundColor: COLORS.cream,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  btn: {
    height: 52,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  btnText: { fontFamily: FONTS.bold, fontSize: 16, color: "#fff" },
  skipBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  skipText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    textDecorationLine: "underline",
  },

  whyCard: {
    backgroundColor: COLORS.blueLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.blue + "33",
  },
  whyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.blue,
    marginBottom: SPACING.md,
  },
  whyItem: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.navy,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
});
