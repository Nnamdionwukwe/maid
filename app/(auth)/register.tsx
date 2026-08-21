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
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAuthStore } from "../../stores/authStore";
import { useGoogleAuth } from "../../constants/google";
import { useAppToast } from "../../components/AppToast";
import { FontAwesome5 } from "@expo/vector-icons";

export default function RegisterScreen() {
  const router = useRouter();
  const { setUser, reset, logout } = useAuthStore();
  // ✅ Auto-selected "maid" role since this is a maid-only app
  const [role] = useState<"maid">("maid");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { toast } = useAppToast();

  // ── Show wrong app alert for customers ──
  const showWrongAppAlert = () => {
    Alert.alert(
      "Wrong App",
      "You are a customer. Please download the 'Deusizi Sparkle' app from the Play Store to book services.\n\nWould you like to open the Play Store now?",
      [
        {
          text: "Stay Here",
          style: "cancel",
          onPress: () => {
            reset();
            router.replace("/(auth)/register");
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
            reset();
            setTimeout(() => {
              router.replace("/(auth)/register");
            }, 500);
          },
        },
      ],
      { cancelable: false },
    );
  };

  // ── Google Auth ──
  const { startGoogleAuth, loading: googleLoading } = useGoogleAuth(
    ({ token, user: googleUser, needsPhone }) => {
      console.log("[RegisterScreen] Google auth success");
      console.log("[RegisterScreen] User role:", googleUser?.role);

      // ⚠️ ROLE CHECK: Prevent customers from using maid app
      if (googleUser.role === "customer") {
        console.log("[RegisterScreen] ❌ Customer detected, blocking access");
        logout();
        reset();
        showWrongAppAlert();
        return;
      }

      // ✅ Only proceed if user is a maid
      if (googleUser.role === "maid") {
        console.log("[RegisterScreen] ✅ Maid detected, proceeding...");
        setUser(googleUser);

        if (needsPhone) {
          router.replace({
            pathname: "/(auth)/complete-profile",
            params: { name: googleUser.name },
          });
        } else {
          router.replace("/(tabs)");
        }
      }
    },
    (errorMsg) =>
      toast({
        type: "error",
        title: "Google sign-up failed",
        message: errorMsg,
      }),
    role,
  );

  async function handleRegister() {
    if (!name.trim()) {
      toast({
        type: "warning",
        title: "Missing field",
        message: "Please enter your full name.",
      });
      return;
    }
    if (!email.includes("@")) {
      toast({
        type: "warning",
        title: "Invalid email",
        message: "Please enter a valid email.",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        type: "warning",
        title: "Weak password",
        message: "Password must be at least 8 characters.",
      });
      return;
    }
    if (password !== confirm) {
      toast({
        type: "warning",
        title: "Password mismatch",
        message: "Passwords do not match.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || null,
          role,
          country: "NG",
          language: "en",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "GOOGLE_ACCOUNT_LINKED") {
          toast({
            type: "warning",
            title: "Account exists",
            message: data.error,
          });
          return;
        }
        throw new Error(data.error || "Registration failed");
      }
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: email.trim().toLowerCase() },
      });
    } catch (err: any) {
      toast({
        type: "error",
        title: "Registration failed",
        message: err.message || "Please try again.",
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
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <FontAwesome5 name="arrow-left" size={20} color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={s.brand}>Deusizi Sparkle</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        <Text style={s.title}>Create account</Text>
        <Text style={s.sub}>Join as a professional worker</Text>

        {/* ── Maid badge ── */}
        <View style={s.maidBadge}>
          <View style={s.maidBadgeInner}>
            <FontAwesome5 name="broom" size={14} color={COLORS.blue} />
            <Text style={s.maidBadgeText}> I am a worker</Text>
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
              <FontAwesome5 name="google" size={18} color="#4285F4" />
              <Text style={s.googleText}>Sign up with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Divider ── */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR WITH EMAIL</Text>
          <View style={s.dividerLine} />
        </View>

        {/* ── Fields ── */}
        <Text style={s.label}>Full name</Text>
        <TextInput
          style={s.input}
          placeholder="Your full name"
          placeholderTextColor={COLORS.grayLight}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

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

        <Text style={s.label}>Phone number</Text>
        <TextInput
          style={s.input}
          placeholder="+234 800 000 0000"
          placeholderTextColor={COLORS.grayLight}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Text style={s.hint}>Optional — include country code</Text>

        <Text style={s.label}>Password</Text>
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="At least 8 characters"
            placeholderTextColor={COLORS.grayLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
          >
            <FontAwesome5
              name={showPassword ? "eye-slash" : "eye"}
              size={18}
              color={COLORS.gray}
            />
          </TouchableOpacity>
        </View>

        <Text style={[s.label, { marginTop: SPACING.md }]}>
          Confirm password
        </Text>
        <View
          style={[
            s.inputRow,
            confirm.length > 0 && {
              borderColor: confirm === password ? COLORS.green : COLORS.red,
            },
          ]}
        >
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Repeat password"
            placeholderTextColor={COLORS.grayLight}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setShowConfirm((v) => !v)}
          >
            <FontAwesome5
              name={showConfirm ? "eye-slash" : "eye"}
              size={18}
              color={COLORS.gray}
            />
          </TouchableOpacity>
        </View>
        {confirm.length > 0 && confirm !== password && (
          <Text style={s.errorText}>Passwords do not match</Text>
        )}

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[
            s.btn,
            loading && { opacity: 0.6 },
            { marginTop: SPACING.xl },
          ]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Create account</Text>
          )}
        </TouchableOpacity>

        <View style={s.row}>
          <Text style={s.rowText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
            <Text style={s.rowLink}>Sign in</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  backBtn: {
    width: 40,
    paddingVertical: 8,
  },
  brand: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.navy },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  maidBadgeInner: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  googleText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.navy,
  },

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
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: SPACING.md,
    marginTop: -SPACING.xs + 2,
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
    overflow: "hidden",
  },
  eyeBtn: {
    paddingHorizontal: SPACING.md,
    height: 52,
    justifyContent: "center",
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.red,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
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
