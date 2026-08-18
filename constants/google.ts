import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./index";

WebBrowser.maybeCompleteAuthSession();

// ✅ Use the WORKING web client ID (same as website)
const WEB_CLIENT_ID =
  "586260940970-a4r25osung9ejm9ip06n6bigfmt7nr1a.apps.googleusercontent.com";

// ✅ Use the web redirect page that redirects to the app
const WEB_REDIRECT_URI = "https://deusizisparkle.com/oauth-redirect";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("[Google Auth] Using WEB OAuth flow with web redirect");
console.log(`[Google Auth] Client ID: ${WEB_CLIENT_ID.substring(0, 40)}...`);
console.log(`[Google Auth] Redirect URI: ${WEB_REDIRECT_URI}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

interface GoogleAuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    phone?: string;
    email_verified?: boolean;
  };
  needsPhone: boolean;
}

export function useGoogleAuth(
  onSuccess: (data: GoogleAuthResponse) => void,
  onError: (msg: string) => void,
  role: "customer" | "maid" = "maid",
) {
  const [loading, setLoading] = useState(false);

  const buildGoogleOAuthURL = () => {
    const params = new URLSearchParams({
      client_id: WEB_CLIENT_ID,
      redirect_uri: WEB_REDIRECT_URI,
      response_type: "token",
      scope: "openid email profile",
      state: role,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const startGoogleAuth = async () => {
    console.log("[Google Auth] Starting Google Sign-In...");
    setLoading(true);

    try {
      const authUrl = buildGoogleOAuthURL();
      console.log(`[Google Auth] Opening: ${authUrl}`);

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        WEB_REDIRECT_URI,
      );

      console.log("[Google Auth] WebBrowser result:", result.type);

      // The result will be 'success' when the redirect page redirects back to the app
      // But the actual token handling is now done in the OAuthRedirect component
      if (result.type === "success") {
        console.log(
          "[Google Auth] Redirect success, token will be handled by app",
        );
        // The OAuthRedirect component will handle the token
        setLoading(false);
      } else if (result.type === "cancel") {
        setLoading(false);
        console.log("[Google Auth] User cancelled");
      } else if (result.type === "dismiss") {
        setLoading(false);
        console.log("[Google Auth] User dismissed the browser");
      } else {
        setLoading(false);
        console.log("[Google Auth] Unknown result:", result);
      }
    } catch (err: any) {
      console.error("[Google Auth] Error:", err);
      setLoading(false);
      // Don't show error if it's a cancellation
      if (!err.message?.includes("cancel")) {
        // The OAuthRedirect component will handle the token processing
        console.log("[Google Auth] Waiting for redirect to app");
      }
    }
  };

  return {
    startGoogleAuth,
    loading,
  };
}
