// apps/maid/app/_layout.tsx

import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { Platform, View, ActivityIndicator } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { Syne_700Bold } from "@expo-google-fonts/syne";
import { useAuthStore } from "../stores/authStore";
import { AppToastProvider } from "../components/AppToast";
import IncomingCallBanner from "../components/IncomingCallBanner";
import {
  registerForPushNotificationsAsync,
  savePushTokenToServer,
  setupNotificationListeners,
} from "../services/notificationService";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { COLORS } from "../constants";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const {
    init,
    token,
    user,
    isLoading,
    isAuthenticated,
    isInitialized,
    refreshUser,
    reset,
  } = useAuthStore();
  const notificationListenerRef = useRef<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    Syne_700Bold,
  });

  // ── Auth initialization ──
  useEffect(() => {
    console.log("[Layout] Initializing auth...");
    init();
  }, []);

  // ── Hide splash screen when fonts are loaded and auth is ready ──
  useEffect(() => {
    if (fontsLoaded && isInitialized) {
      console.log("[Layout] Fonts loaded and auth initialized, hiding splash");
      SplashScreen.hideAsync();
      setAuthReady(true);
    }
  }, [fontsLoaded, isInitialized]);

  // ── Force refresh user data on app start ──
  useEffect(() => {
    if (token && user && isAuthenticated) {
      console.log(
        "[Layout] App started with authenticated user, refreshing data...",
      );
      refreshUser().then((refreshedUser) => {
        if (refreshedUser) {
          console.log("[Layout] User data refreshed on app start");
          console.log("[Layout] Refreshed maid data:", {
            id_verified: refreshedUser.id_verified,
            background_checked: refreshedUser.background_checked,
            has_pro_badge: refreshedUser.has_pro_badge,
          });
        }
      });
    }
  }, [token, isAuthenticated]);

  // ── Deep link handling for OAuth redirect and Booking redirect ──
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log("[DeepLink] Received:", event.url);

      // ─── Handle OAuth redirect ──────────────────────────────────
      if (event.url.includes("access_token")) {
        console.log("[DeepLink] OAuth redirect detected");

        try {
          reset();
          await SecureStore.deleteItemAsync("auth_token");
          await SecureStore.deleteItemAsync("oauth_redirect_url");

          await SecureStore.setItemAsync("oauth_redirect_url", event.url);
          console.log("[DeepLink] URL stored, navigating to OAuthRedirect");
          router.replace("/oauth2redirect");
          return;
        } catch (error) {
          console.error("[DeepLink] Error:", error);
          router.replace("/(auth)/login");
          return;
        }
      }

      // ─── Handle Maid Booking deep link ──────────────────────────
      // Format: deusizimaid://booking/da7b0671-61d0-4f9a-b1be-be39a5d0a14d
      const maidBookingMatch = event.url.match(
        /deusizimaid:\/\/booking\/([a-f0-9-]+)/,
      );
      if (maidBookingMatch) {
        const bookingId = maidBookingMatch[1];
        console.log(
          "[DeepLink] 📹 Maid booking deep link detected:",
          bookingId,
        );
        router.push(`/booking/${bookingId}`);
        return;
      }

      // ─── Handle Customer deep link (in case maid opens customer link) ──
      const customerBookingMatch = event.url.match(
        /deusizicustomer:\/\/booking\/([a-f0-9-]+)/,
      );
      if (customerBookingMatch) {
        const bookingId = customerBookingMatch[1];
        console.log(
          "[DeepLink] 📹 Customer booking deep link detected (maid app):",
          bookingId,
        );
        // Still navigate to the booking in maid app
        router.push(`/booking/${bookingId}`);
        return;
      }

      // ─── Handle generic deep link ──────────────────────────────
      console.log("[DeepLink] Unhandled deep link:", event.url);
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then(async (url) => {
      if (url) {
        console.log("[DeepLink] Initial URL:", url);

        // Check if it's a maid booking deep link
        const maidBookingMatch = url.match(
          /deusizimaid:\/\/booking\/([a-f0-9-]+)/,
        );
        if (maidBookingMatch) {
          const bookingId = maidBookingMatch[1];
          console.log(
            "[DeepLink] 📹 Initial maid booking deep link:",
            bookingId,
          );
          setTimeout(() => {
            router.push(`/booking/${bookingId}`);
          }, 1000);
          return;
        }

        // Check if it's a customer booking deep link
        const customerBookingMatch = url.match(
          /deusizicustomer:\/\/booking\/([a-f0-9-]+)/,
        );
        if (customerBookingMatch) {
          const bookingId = customerBookingMatch[1];
          console.log(
            "[DeepLink] 📹 Initial customer booking deep link (maid app):",
            bookingId,
          );
          setTimeout(() => {
            router.push(`/booking/${bookingId}`);
          }, 1000);
          return;
        }

        if (url.includes("access_token")) {
          console.log("[DeepLink] OAuth redirect on app start");
          try {
            reset();
            await SecureStore.deleteItemAsync("auth_token");
            await SecureStore.deleteItemAsync("oauth_redirect_url");
            await SecureStore.setItemAsync("oauth_redirect_url", url);
            router.replace("/oauth2redirect");
          } catch (error) {
            console.error("[DeepLink] Error storing initial URL:", error);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ── Navigation logic ──
  useEffect(() => {
    if (isLoading || !authReady || !isInitialized) {
      console.log("[Navigation] Waiting for auth to be ready...", {
        isLoading,
        authReady,
        isInitialized,
      });
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    const isLoggedIn = !!user && isAuthenticated;

    console.log("[Navigation] ====================");
    console.log("[Navigation] isLoggedIn:", isLoggedIn);
    console.log("[Navigation] inAuthGroup:", inAuthGroup);
    console.log("[Navigation] user:", user?.email);
    console.log(
      "[Navigation] user data:",
      user
        ? {
            id: user.id,
            name: user.name,
            role: user.role,
            id_verified: user.id_verified,
            background_checked: user.background_checked,
          }
        : null,
    );
    console.log("[Navigation] isAuthenticated:", isAuthenticated);
    console.log("[Navigation] ====================");

    if (isLoggedIn && inAuthGroup) {
      console.log("[Navigation] ✅ User logged in, redirecting to tabs");
      router.replace("/(tabs)");
    } else if (!isLoggedIn && !inAuthGroup) {
      console.log("[Navigation] ❌ User not logged in, redirecting to login");
      router.replace("/(auth)/login");
    } else {
      console.log("[Navigation] ℹ️ No navigation action needed");
    }
  }, [
    user,
    segments,
    isLoading,
    authReady,
    isInitialized,
    isAuthenticated,
    router,
  ]);

  // ── Setup push notifications ──
  useEffect(() => {
    if (!token || !user || !isAuthenticated) return;

    let isMounted = true;

    async function setupNotifications() {
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken && isMounted) {
          await savePushTokenToServer(pushToken);
          console.log("✅ Push token registered and saved");
        }

        if (isMounted) {
          notificationListenerRef.current = setupNotificationListeners();
          console.log("✅ Notification listeners set up");
        }
      } catch (error) {
        console.error("Failed to setup notifications:", error);
      }
    }

    setupNotifications();

    return () => {
      isMounted = false;
      if (notificationListenerRef.current?.remove) {
        notificationListenerRef.current.remove();
      }
    };
  }, [token, user, isAuthenticated]);

  // ── Loading state ──
  if (!fontsLoaded || !isInitialized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.cream,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppToastProvider>
            <StatusBar style="light" backgroundColor="#1a1a2e" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="oauth2redirect"
                options={{ headerShown: false }}
              />
            </Stack>
            <IncomingCallBanner />
          </AppToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
