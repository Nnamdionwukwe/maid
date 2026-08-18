// apps/maid/services/notificationService.ts

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { API_URL } from "../constants";
import { useAuthStore } from "../stores/authStore";

// ── Configure notification handler ──
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;

    if (data?.type === "video_call_incoming") {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

// ── Get Expo push token ──
export async function registerForPushNotificationsAsync() {
  let token;

  if (!Device.isDevice) {
    console.log("Must use physical device for Push Notifications");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push token!");
    return null;
  }

  try {
    // Get the project ID from Constants
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants?.expoConfig?.projectId ||
      "2e92589f-9de3-4bae-95e7-fb8fa15aed22";

    if (!projectId) {
      console.log("No project ID found, using default");
    }

    console.log("Using project ID:", projectId);

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })
    ).data;

    console.log("✅ Push token obtained:", token);
  } catch (error: any) {
    console.error("Error getting push token:", error.message);
    return null;
  }

  // Setup Android notification channels (NO custom sound)
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("video-call", {
        name: "Video Calls",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        // NO sound property
      });

      await Notifications.setNotificationChannelAsync("bookings", {
        name: "Bookings",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: true,
      });

      await Notifications.setNotificationChannelAsync("payments", {
        name: "Payments",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: true,
      });

      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: true,
      });

      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: false,
      });
    } catch (error) {
      console.error("Error setting up notification channels:", error);
    }
  }

  return token;
}

// ── Save token to backend ──
export async function savePushTokenToServer(token: string) {
  if (!token) {
    console.log("No token to save");
    return;
  }

  const authToken = useAuthStore.getState().token;

  if (!authToken) {
    console.log("No auth token, skipping push token save");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/users/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Push token saved to server");
      return data;
    } else {
      const error = await response.text();
      console.log("❌ Failed to save push token:", error);
      return null;
    }
  } catch (error) {
    console.error("Error saving push token:", error);
    return null;
  }
}

// ── Handle notification navigation ──
export function handleNotificationNavigation(notification: any) {
  const data = notification.request?.content?.data;

  if (!data) return;

  console.log("🔔 Notification data:", data);

  if (data.type === "video_call_incoming" && data.booking_id) {
    router.push({
      pathname: "/video-call",
      params: {
        booking_id: data.booking_id,
        channel: data.channel,
        token: data.token,
        app_id: data.app_id,
        caller_name: data.caller_name,
      },
    } as any);
    return;
  }

  if (data.booking_id && data.type?.includes("booking")) {
    router.push(`/booking/${data.booking_id}` as any);
    return;
  }

  if (data.payment_id && data.type?.includes("payment")) {
    router.push("/wallet" as any);
    return;
  }

  if (data.message_id && data.type === "new_message") {
    router.push("/chat" as any);
    return;
  }

  if (data.ticket_id && data.type?.includes("ticket")) {
    router.push("/support" as any);
    return;
  }

  if (data.withdrawal_id && data.type?.includes("withdrawal")) {
    router.push("/wallet/withdraw" as any);
    return;
  }

  if (data.action_url) {
    router.push(data.action_url as any);
  }
}

// ── Setup notification listeners ──
export function setupNotificationListeners() {
  let notificationSubscription: any = null;
  let responseSubscription: any = null;

  notificationSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("📱 Notification received in foreground:", notification);
    },
  );

  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log("📱 Notification clicked by user");
      handleNotificationNavigation(response.notification);
    },
  );

  // Return cleanup function with proper removal
  return {
    remove: () => {
      if (notificationSubscription) {
        notificationSubscription.remove();
      }
      if (responseSubscription) {
        responseSubscription.remove();
      }
    },
  };
}
