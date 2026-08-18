import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { toast } = useAppToast();

  async function handleSubmit() {
    if (!email.includes("@")) {
      toast({
        type: "warning",
        title: "Invalid email",
        message: "Please enter a valid email address.",
      });
      return;
    }
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
    } catch {
      toast({
        type: "error",
        title: "Error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {sent ? (
          <>
            <Text style={s.emoji}>✉️</Text>
            <Text style={s.title}>Check your email</Text>
            <Text style={s.body}>
              If an account exists for {email}, you'll receive a password reset
              link shortly.
            </Text>
            <TouchableOpacity
              style={s.btn}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={s.btnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.title}>Reset password</Text>
            <Text style={s.sub}>
              Enter your email and we'll send a reset link
            </Text>

            <Text style={s.label}>Email address</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.grayLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>Send reset link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={s.row}>
              <Text style={s.rowText}>Remember your password? </Text>
              <Text style={s.rowLink}>Sign in</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  container: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  backBtn: { marginBottom: SPACING.xl },
  backText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.navy },
  emoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: SPACING.lg,
    marginTop: SPACING.xxxl,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.navy,
    marginBottom: SPACING.sm,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: SPACING.xxxl,
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
    marginBottom: SPACING.xl,
  },
  btn: {
    height: 52,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  btnText: { fontFamily: FONTS.bold, fontSize: 16, color: "#fff" },
  row: { flexDirection: "row", justifyContent: "center" },
  rowText: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.navy },
  rowLink: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    textDecorationLine: "underline",
  },
});
