import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { completeProfile, isLoading } = useAuthStore();
  const { toast } = useAppToast();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    if (!/^\+?[\d\s\-()]{7,15}$/.test(phone)) {
      setError("Enter a valid phone number with country code");
      return;
    }
    setError("");

    try {
      await completeProfile(phone);
      toast({
        type: "success",
        title: "Profile updated",
        message: "Your phone number has been saved.",
      });
      router.replace("/(tabs)");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Update failed",
        message: err.message || "Failed to save your phone number.",
      });
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.cream }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={["top"]}>
          <View style={s.topBar}>
            <Text style={s.brand}>Deusizi Sparkle</Text>
          </View>
        </SafeAreaView>

        <Text style={s.title}>One last step</Text>
        <Text style={s.sub}>
          {name ? `Welcome, ${name}!` : "Welcome!"} Add your phone number so
          customers can reach you.
        </Text>

        <Text style={s.label}>Phone number</Text>
        <TextInput
          style={[s.input, error && s.inputError]}
          placeholder="+234 800 000 0000"
          placeholderTextColor={COLORS.grayLight}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (error) setError("");
          }}
          keyboardType="phone-pad"
          autoFocus
        />
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <Text style={s.hint}>Include country code — e.g. +234 for Nigeria</Text>

        <TouchableOpacity
          style={[s.btn, isLoading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Continue →</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  topBar: {
    alignItems: "center",
    paddingBottom: SPACING.xl,
  },
  brand: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.navy },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: SPACING.xl,
    lineHeight: 20,
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
    fontSize: 15,
    color: COLORS.navy,
    backgroundColor: COLORS.white,
  },
  inputError: { borderColor: "#d9534f" },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#d9534f",
    marginTop: SPACING.xs,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.grayLight,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  btn: {
    height: 52,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  btnText: { fontFamily: FONTS.bold, fontSize: 16, color: "#fff" },
});
