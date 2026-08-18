import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast"; // ← add

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);

  const { toast } = useAppToast(); // ← add

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.code === "ALREADY_VERIFIED") {
        toast({
          type: "info",
          title: "Already verified",
          message: "This email is already verified. Just sign in.",
        });
      } else {
        toast({
          type: "success",
          title: "Email sent",
          message:
            data.message ||
            "A new verification link has been sent to your inbox",
        });
      }
    } catch {
      toast({
        type: "error",
        title: "Error",
        message: "Failed to resend. Please try again.",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.emoji}>📧</Text>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.sub}>We've sent a verification link to:</Text>
        <Text style={s.email}>{email}</Text>
        <Text style={s.body}>
          Click the link in the email to verify your account, check Spam if not
          found. then come back here to sign in.
        </Text>

        <TouchableOpacity
          style={s.btn}
          onPress={() => router.replace("/(auth)/login")}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>Go to Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.resendBtn}
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator size="small" color={COLORS.navy} />
          ) : (
            <Text style={s.resendText}>Didn't get the email? Resend</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  emoji: { fontSize: 64, marginBottom: SPACING.xl },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.navy,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.gray,
    textAlign: "center",
  },
  email: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.navy,
    textAlign: "center",
    marginVertical: SPACING.sm,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACING.xxxl,
  },
  btn: {
    width: "100%",
    height: 52,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  btnText: { fontFamily: FONTS.bold, fontSize: 16, color: "#fff" },
  resendBtn: { padding: SPACING.md },
  resendText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    textDecorationLine: "underline",
  },
});
