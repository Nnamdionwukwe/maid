import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../constants";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "maid";
  avatar?: string;
  phone?: string;
  country?: string;
  language?: string;
  email_verified?: boolean;
  subscription_plan?: string;
  subscription_badge?: string;
  id_verified?: boolean;
  background_checked?: boolean;
  has_pro_badge?: boolean;
  created_at?: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: "customer" | "maid";
  country?: string;
  language?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<void>;
  completeProfile: (phone: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateUser: (user: User) => void;
  setUser: (user: User) => void;
  reset: () => void;
}

const storage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`[Storage] Failed to set ${key}:`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`[Storage] Failed to remove ${key}:`, error);
    }
  },
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isInitialized: false,

  init: async () => {
    console.log("[Auth] Initializing...");
    set({ isLoading: true });
    try {
      const token = await storage.getItem("auth_token");
      if (!token) {
        console.log("[Auth] No token found");
        set({ isLoading: false, isAuthenticated: false, isInitialized: true });
        return;
      }

      console.log("[Auth] Checking session with token...");
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.log("[Auth] Token expired, clearing...");
          await storage.removeItem("auth_token");
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isInitialized: true,
          });
        } else {
          throw new Error(`Server error: ${res.status}`);
        }
        return;
      }

      const data = await res.json();

      if (!data.user) {
        throw new Error("No user data received");
      }

      console.log("[Auth] Session restored for:", data.user.email);
      console.log("[Auth] Maid data from init:", {
        id_verified: data.user.id_verified,
        background_checked: data.user.background_checked,
        has_pro_badge: data.user.has_pro_badge,
      });

      set({
        user: { ...data.user },
        token,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.error("[Auth] Init error:", error);
      await storage.removeItem("auth_token").catch(() => {});
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    console.log("[Auth] Login attempt for:", email);
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        if (data.code === "NO_PASSWORD_SET") {
          throw new Error("NO_PASSWORD_SET");
        }
        throw new Error(data.error || "Login failed");
      }

      await storage.setItem("auth_token", String(data.token));

      console.log("[Auth] Login successful for:", data.user.email);
      console.log("[Auth] Maid data from login:", {
        id_verified: data.user.id_verified,
        background_checked: data.user.background_checked,
      });

      set({
        user: { ...data.user },
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });

      return data.user;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (formData: RegisterData) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "GOOGLE_ACCOUNT_LINKED") {
          throw new Error("GOOGLE_ACCOUNT_LINKED");
        }
        throw new Error(data.error || "Registration failed");
      }

      set({ isLoading: false });
      return;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  completeProfile: async (phone: string) => {
    set({ isLoading: true });
    const token = get().token;
    if (!token) {
      throw new Error("No authentication token found");
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      console.log("[Auth] Profile completed for:", data.user.email);
      set({ user: { ...data.user }, isLoading: false });
      return data.user;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const token = get().token;
    console.log("[Auth] Logging out...");

    try {
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } catch (error) {
      console.error("[Auth] Logout error:", error);
    } finally {
      await storage.removeItem("auth_token");
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      console.log("[Auth] Logout complete");
    }
  },

  refreshUser: async () => {
    const token = get().token;
    console.log("[Auth] 🔄 refreshUser called, token exists:", !!token);

    if (!token) {
      console.log("[Auth] No token, cannot refresh user");
      return null;
    }

    try {
      console.log("[Auth] Refreshing user data from server...");
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("[Auth] Refresh response status:", res.status);

      if (!res.ok) {
        console.error(`[Auth] Refresh failed: ${res.status}`);
        if (res.status === 401) {
          await storage.removeItem("auth_token");
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
        return null;
      }

      const data = await res.json();
      console.log(
        "[Auth] Refresh response data:",
        JSON.stringify(data, null, 2),
      );

      if (!data.user) {
        console.error("[Auth] No user data in refresh response");
        return null;
      }

      console.log("[Auth] ✅ Refresh successful for:", data.user.email);
      console.log("[Auth] ✅ Maid data from refresh:", {
        id_verified: data.user.id_verified,
        background_checked: data.user.background_checked,
        has_pro_badge: data.user.has_pro_badge,
      });

      set({
        user: { ...data.user },
        isAuthenticated: true,
        isLoading: false,
      });

      console.log("[Auth] ✅ State updated after refresh");
      return data.user;
    } catch (error) {
      console.error("[Auth] ❌ Refresh error:", error);
      return null;
    }
  },

  updateUser: (user: User) => {
    console.log("[Auth] updateUser called for:", user.email);
    set({
      user: { ...user },
      isAuthenticated: true,
    });
  },

  setUser: (user: User) => {
    console.log("[Auth] ========================================");
    console.log("[Auth] 🔵 setUser CALLED");
    console.log("[Auth] User email:", user.email);
    console.log("[Auth] User role:", user.role);
    console.log("[Auth] User data:", JSON.stringify(user, null, 2));
    console.log("[Auth] Maid data:", {
      id_verified: user.id_verified,
      background_checked: user.background_checked,
      has_pro_badge: user.has_pro_badge,
    });
    console.log("[Auth] ========================================");

    set({
      user: { ...user },
      isAuthenticated: true,
      isLoading: false,
    });

    const newState = get();
    console.log("[Auth] State after setUser:", {
      user: newState.user?.email,
      isAuthenticated: newState.isAuthenticated,
      isLoading: newState.isLoading,
    });
  },

  reset: () => {
    console.log("[Auth] 🔄 Resetting state...");
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
    });
  },
}));
