import { useState, useRef } from "react";
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
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { useGoogleAuth } from "../../constants/google";
import { COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast";

export default function LoginScreen() {
  const router = useRouter();
  const {
    login,
    setUser,
    refreshUser,
    isLoading: authLoading,
    reset,
    logout,
  } = useAuthStore();

  // ✅ Auto-selected "maid" role since this is a maid-only app
  const [role] = useState<"maid">("maid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const isNavigating = useRef(false);

  const { toast } = useAppToast();

  // ── Show wrong app alert and force logout ──
  const showWrongAppAlert = () => {
    // Force logout immediately to clear any session
    logout();

    Alert.alert(
      "Wrong App",
      "You are a customer. Please download the 'Deusizi Sparkle' app from the Play Store to book services.\n\nWould you like to open the Play Store now?",
      [
        {
          text: "Stay Here",
          style: "cancel",
          onPress: () => {
            // Reset auth state and clear form
            reset();
            setEmail("");
            setPassword("");
            // Ensure we're on the login page
            router.replace("/(auth)/login");
          },
        },
        {
          text: "Open Play Store",
          onPress: () => {
            Linking.openURL(
              "market://details?id=com.deusizisparkle.customer",
            ).catch(() => {
              Linking.openURL(
                "https://play.google.com/store/apps/details?id=com.deusizisparkle.customer",
              );
            });
            // Reset auth state and clear form
            reset();
            setEmail("");
            setPassword("");
            // Return to login after opening Play Store
            setTimeout(() => {
              router.replace("/(auth)/login");
            }, 500);
          },
        },
      ],
      { cancelable: false },
    );
  };

  // ── Google Auth ──
  const { startGoogleAuth, loading: googleLoading } = useGoogleAuth(
    async ({ token, user: googleUser, needsPhone }) => {
      console.log("[LoginScreen] Google auth success callback");
      console.log("[LoginScreen] User email:", googleUser?.email);
      console.log("[LoginScreen] User role:", googleUser?.role);

      // ⚠️ STRONG ROLE CHECK: Prevent customers from using maid app
      if (googleUser.role === "customer") {
        console.log("[LoginScreen] ❌ Customer detected, blocking access");
        // Immediately clear auth state
        await logout();
        reset();
        showWrongAppAlert();
        return;
      }

      // ✅ Only proceed if user is a maid
      if (googleUser.role === "maid") {
        console.log("[LoginScreen] ✅ Maid detected, proceeding...");

        // Set user in store
        setUser(googleUser);

        // Force refresh user data
        try {
          const refreshedUser = await refreshUser();
          if (refreshedUser) {
            console.log("[LoginScreen] User refreshed successfully");
          }
        } catch (error) {
          console.error("[LoginScreen] Refresh error:", error);
        }

        // Navigate after state settles
        setTimeout(() => {
          if (needsPhone) {
            router.replace({
              pathname: "/(auth)/complete-profile",
              params: { name: googleUser.name },
            });
          } else {
            router.replace("/(tabs)");
          }
        }, 500);
      }
    },
    (errorMsg) =>
      toast({
        type: "error",
        title: "Google sign-in failed",
        message: errorMsg,
      }),
    role,
  );

  // ── Email/Password Login ──
  async function handleLogin() {
    if (!email || !password) {
      toast({
        type: "warning",
        title: "Missing fields",
        message: "Please enter your email and password.",
      });
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);

      console.log("[LoginScreen] Email login successful");
      console.log("[LoginScreen] User role:", user?.role);

      // ⚠️ STRONG ROLE CHECK: Prevent customers from using maid app
      if (user.role === "customer") {
        console.log("[LoginScreen] ❌ Customer detected, blocking access");
        setLoading(false);
        // Immediately clear auth state
        await logout();
        reset();
        showWrongAppAlert();
        return;
      }

      // ✅ Only proceed if user is a maid
      if (user.role === "maid") {
        console.log("[LoginScreen] ✅ Maid detected, proceeding...");
        router.replace("/(tabs)");
      } else {
        // Fallback: if role is neither customer nor maid
        console.log("[LoginScreen] ⚠️ Unknown role:", user.role);
        toast({
          type: "error",
          title: "Access Denied",
          message: "Invalid account type for this app.",
        });
        setLoading(false);
        // Reset auth state
        logout();
        reset();
        setEmail("");
        setPassword("");
        router.replace("/(auth)/login");
      }
    } catch (err: any) {
      if (err.message?.includes("EMAIL_NOT_VERIFIED")) {
        toast({
          type: "warning",
          title: "Email not verified",
          message: "Please check your email and click the verification link.",
        });
        try {
          const { API_URL } = await import("../../constants");
          await fetch(`${API_URL}/api/auth/resend-verification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          toast({
            type: "success",
            title: "Email sent",
            message: "Check your inbox for the verification link.",
          });
        } catch {
          // Ignore
        }
        setLoading(false);
        return;
      }
      if (err.message?.includes("NO_PASSWORD_SET")) {
        toast({
          type: "warning",
          title: "No password set",
          message:
            "This account uses Google Sign-In. Please use 'Continue with Google'.",
        });
        setLoading(false);
        return;
      }
      toast({
        type: "error",
        title: "Login failed",
        message: err.message || "Invalid email or password.",
      });
    } finally {
      setLoading(false);
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
            <Text style={s.brandSub}>Worker App</Text>
          </View>
        </SafeAreaView>

        <Text style={s.title}>Welcome back</Text>
        <Text style={s.sub}>Sign in to your worker account</Text>

        {/* ── Maid badge ── */}
        <View style={s.maidBadge}>
          <View style={s.maidBadgeInner}>
            <Text style={s.maidBadgeText}>🧹 I am a worker</Text>
          </View>
        </View>

        {/* ── Google button ── */}
        <TouchableOpacity
          style={[s.googleBtn, googleLoading && { opacity: 0.5 }]}
          activeOpacity={0.85}
          disabled={googleLoading}
          onPress={startGoogleAuth}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={COLORS.navy} />
          ) : (
            <>
              <Text style={s.googleG}>G</Text>
              <Text style={s.googleText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Divider ── */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR WITH EMAIL</Text>
          <View style={s.dividerLine} />
        </View>

        {/* ── Email ── */}
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

        {/* ── Password ── */}
        <Text style={s.label}>Password</Text>
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Your password"
            placeholderTextColor={COLORS.grayLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
          >
            <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.forgotWrap}
          onPress={() => router.push("/(auth)/forgot-password")}
        >
          <Text style={s.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* ── Sign in ── */}
        <TouchableOpacity
          style={[s.btn, (loading || authLoading) && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading || authLoading}
          activeOpacity={0.85}
        >
          {loading || authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Sign in</Text>
          )}
        </TouchableOpacity>

        <View style={s.row}>
          <Text style={s.rowText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={s.rowLink}>Create one</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.terms}>
          By continuing, you agree to our{" "}
          <Text
            style={s.termsLink}
            onPress={() => router.push("/(auth)/terms")}
          >
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text
            style={s.termsLink}
            onPress={() => router.push("/(auth)/privacy")}
          >
            Privacy Policy
          </Text>
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.xl },
  topBar: {
    alignItems: "center",
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  brand: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.navy },
  brandSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 30,
    color: COLORS.navy,
    marginBottom: SPACING.xs,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: SPACING.xl,
  },

  maidBadge: {
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  maidBadgeInner: {
    backgroundColor: "#e8f0fe",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  maidBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.blue,
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    height: 52,
  },
  googleG: { fontSize: 18, fontWeight: "700", color: "#4285F4" },
  googleText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.navy },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
    letterSpacing: 0.8,
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
    marginBottom: SPACING.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  eyeBtn: {
    paddingHorizontal: SPACING.md,
    height: 52,
    justifyContent: "center",
  },

  forgotWrap: { alignSelf: "flex-end", marginBottom: SPACING.lg },
  forgotText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.navy,
    textDecorationLine: "underline",
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

  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  rowText: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.navy },
  rowLink: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    textDecorationLine: "underline",
  },

  terms: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 18,
  },
  termsLink: { textDecorationLine: "underline" },
});
