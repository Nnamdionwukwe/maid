// apps/maid/app/oauth2redirect.tsx

import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { useAuthStore } from "../stores/authStore";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../constants";

export default function OAuthRedirect() {
  const router = useRouter();
  const { setUser, refreshUser, reset, logout } = useAuthStore();
  const isProcessing = useRef(false);

  // ── Show wrong app alert for customers ──
  const showWrongAppAlert = () => {
    logout();
    reset();

    Alert.alert(
      "🚫 Access Denied",
      "You are trying to access the Worker App with a Customer account.\n\n" +
        "📱 Please download the DEUSIZI SPARKLE app to book services:\n\n" +
        "• Book professional cleaning services\n" +
        "• Manage your bookings\n" +
        "• Track your service history\n" +
        "• Connect with verified workers\n\n" +
        "Would you like to download the Customer App now?",
      [
        {
          text: "Dismiss",
          style: "cancel",
          onPress: () => {
            reset();
            router.replace("/(auth)/login");
          },
        },
        {
          text: "📲 Download Customer App",
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
              router.replace("/(auth)/login");
            }, 500);
          },
        },
      ],
      { cancelable: false },
    );
  };

  useEffect(() => {
    console.log("[OAuthRedirect] ========================================");
    console.log("[OAuthRedirect] 🚀 COMPONENT MOUNTED");
    console.log("[OAuthRedirect] ========================================");

    reset();

    if (isProcessing.current) {
      console.log("[OAuthRedirect] Already processing, skipping...");
      return;
    }

    isProcessing.current = true;

    const handleOAuthRedirect = async () => {
      try {
        console.log(
          "[OAuthRedirect] 📂 Reading oauth_redirect_url from SecureStore...",
        );
        const url = await SecureStore.getItemAsync("oauth_redirect_url");
        console.log(
          "[OAuthRedirect] URL from SecureStore:",
          url ? "✅ Found" : "❌ Not found",
        );
        console.log(
          "[OAuthRedirect] URL preview:",
          url?.substring(0, 100) + "...",
        );

        if (url && url.includes("access_token")) {
          console.log("[OAuthRedirect] ✅ Access token found in URL");

          const hash = url.split("#")[1];
          console.log(
            "[OAuthRedirect] Hash:",
            hash ? "✅ Found" : "❌ Not found",
          );

          if (hash) {
            const params = new URLSearchParams(hash);
            const access_token = params.get("access_token");
            const state = params.get("state") || "maid";

            console.log(
              "[OAuthRedirect] Access token present:",
              !!access_token,
            );
            console.log("[OAuthRedirect] State:", state);

            if (access_token) {
              console.log(
                "[OAuthRedirect] 🔄 Exchanging token with backend...",
              );

              const res = await fetch(`${API_URL}/api/auth/google`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  access_token: access_token,
                  role: state || "maid",
                }),
              });

              const data = await res.json();
              console.log(
                `[OAuthRedirect] Backend response status: ${res.status}`,
              );
              console.log(
                "[OAuthRedirect] Backend response data:",
                JSON.stringify(data, null, 2),
              );

              if (!res.ok) {
                throw new Error(data.error || "Google sign-in failed");
              }

              if (!data.token) {
                throw new Error("No token received from server");
              }

              // ─── ROLE CHECK: Block customers ───
              if (data.user?.role === "customer") {
                console.log(
                  "[OAuthRedirect] 🚫 Customer detected - blocking access",
                );
                await SecureStore.deleteItemAsync("auth_token");
                await SecureStore.deleteItemAsync("oauth_redirect_url");
                showWrongAppAlert();
                return;
              }

              // ✅ Store token
              await SecureStore.setItemAsync("auth_token", String(data.token));
              console.log("[OAuthRedirect] ✅ Token stored in SecureStore");

              // ✅ Set user
              console.log("[OAuthRedirect] 👤 Setting user:", data.user.email);
              console.log("[OAuthRedirect] 📊 Maid data from backend:", {
                id_verified: data.user.id_verified,
                background_checked: data.user.background_checked,
                has_pro_badge: data.user.has_pro_badge,
              });

              setUser(data.user);
              console.log("[OAuthRedirect] ✅ setUser called");

              // ✅ Clear stored URL
              await SecureStore.deleteItemAsync("oauth_redirect_url");
              console.log("[OAuthRedirect] ✅ oauth_redirect_url cleared");

              // ✅ Force refresh user data
              try {
                console.log(
                  "[OAuthRedirect] 🔄 Refreshing user data from server...",
                );
                const refreshedUser = await refreshUser();
                if (refreshedUser) {
                  console.log("[OAuthRedirect] ✅ User refreshed successfully");
                  console.log("[OAuthRedirect] 📊 Refreshed maid data:", {
                    id_verified: refreshedUser.id_verified,
                    background_checked: refreshedUser.background_checked,
                    has_pro_badge: refreshedUser.has_pro_badge,
                  });
                } else {
                  console.log("[OAuthRedirect] ⚠️ Refresh returned null");
                }
              } catch (refreshError) {
                console.error(
                  "[OAuthRedirect] ❌ Refresh error:",
                  refreshError,
                );
              }

              // ✅ Wait for state to settle
              console.log(
                "[OAuthRedirect] ⏳ Waiting 500ms for state to settle...",
              );
              await new Promise((resolve) => setTimeout(resolve, 500));

              // ✅ Navigate
              console.log("[OAuthRedirect] 🚀 Navigating to tabs");
              router.replace("/(tabs)");
            } else {
              console.log("[OAuthRedirect] ❌ No access token found in hash");
              router.replace("/(auth)/login");
            }
          } else {
            console.log("[OAuthRedirect] ❌ No hash in URL");
            router.replace("/(auth)/login");
          }
        } else {
          console.log("[OAuthRedirect] ❌ No token found or invalid URL");
          console.log("[OAuthRedirect] URL contents:", url);
          router.replace("/(auth)/login");
        }
      } catch (error) {
        console.error("[OAuthRedirect] ❌ Error:", error);
        router.replace("/(auth)/login");
      } finally {
        setTimeout(() => {
          isProcessing.current = false;
        }, 1000);
      }
    };

    handleOAuthRedirect();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1a1a2e" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f4f0",
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: "#1a1a2e",
    fontFamily: "DMSans_400Regular",
  },
});
