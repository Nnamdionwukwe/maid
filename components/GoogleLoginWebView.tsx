import React, { useState } from "react";
import { Modal, View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useAuthStore } from "../stores/authStore";
import { useRouter } from "expo-router";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const GoogleLoginWebView: React.FC<Props> = ({ visible, onClose }) => {
  const { setUser } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const WEB_CLIENT_ID =
    "586260940970-a4r25osung9ejm9ip06n6bigfmt7nr1a.apps.googleusercontent.com";
  const REDIRECT_URI = "https://deusizisparkle.com/auth/callback";

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${WEB_CLIENT_ID}` +
    `&redirect_uri=${REDIRECT_URI}` +
    `&response_type=token` +
    `&scope=openid%20profile%20email` +
    `&state=maid`;

  const handleNavigationStateChange = async (navState: any) => {
    const { url } = navState;

    if (url.includes("access_token=")) {
      // Extract token from URL
      const hash = url.split("#")[1];
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");

        if (accessToken) {
          // Send token to backend
          try {
            const response = await fetch(`${API_URL}/api/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                access_token: accessToken,
                role: "maid",
              }),
            });

            const data = await response.json();
            if (data.token) {
              await SecureStore.setItemAsync("auth_token", data.token);
              setUser(data.user);
              onClose();
              router.replace("/(tabs)");
            }
          } catch (error) {
            console.error("Auth error:", error);
          }
        }
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#1a1a2e" />
          </View>
        )}
        <WebView
          source={{ uri: authUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          style={styles.webview}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  webview: { flex: 1 },
  loader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    zIndex: 10,
  },
});
