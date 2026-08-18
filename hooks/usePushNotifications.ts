// hooks/usePushNotifications.ts
// ─── Register Expo push token + handle incoming call notifications ─────
// Place this hook in your hooks/ folder and call it once in _layout.tsx
//
// npx expo install expo-notifications expo-device

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../constants";

// ── Configure how notifications appear when app is foregrounded ────────
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type;
    // Show heads-up for video calls even when app is open
    return {
      shouldShowAlert: true,
      shouldPlaySound: type === "video_call_incoming",
      shouldSetBadge: false,
    };
  },
});

export function usePushNotifications() {
  const { token: authToken, user } = useAuthStore();
  const router = useRouter();
  const notifListener = useRef<any>();
  const responseListener = useRef<any>();

  // ── Request permission + register token ───────────────────────────
  useEffect(() => {
    if (!authToken || !user) return;

    async function register() {
      // Push only works on real devices
      if (!Device.isDevice) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      // Android: create a high-priority channel for video calls
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("video-call", {
          name: "Video Calls",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: "default",
          enableVibrate: true,
        });
        await Notifications.setNotificationChannelAsync("default", {
          name: "General",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      // Get Expo push token
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(
        {
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // from app.json extra.eas.projectId
        },
      );

      // Save to backend
      await fetch(`${API_URL}/api/users/push-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: expoPushToken,
          platform: Platform.OS,
        }),
      }).catch(() => {});
    }

    register();
  }, [authToken, user?.id]);

  // ── Handle notification tap (app backgrounded/closed) ─────────────
  useEffect(() => {
    // Notification received while app is foregrounded
    notifListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        // IncomingCallBanner handles this via polling — nothing extra needed here
        console.log("[push] received:", data?.type);
      },
    );

    // User tapped the notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        if (data?.type === "video_call_incoming" && data?.booking_id) {
          // Navigate to booking so IncomingCallBanner triggers
          router.push({
            pathname: "/booking/[id]",
            params: { id: data.booking_id },
          } as any);
        }

        if (data?.booking_id && data?.type !== "video_call_incoming") {
          router.push({
            pathname: "/booking/[id]",
            params: { id: data.booking_id },
          } as any);
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(notifListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
