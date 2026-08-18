import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";

interface ToastConfig {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = no auto-dismiss
  action?: { label: string; onPress: () => void };
}

interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface AppToastContextType {
  toast: (config: ToastConfig) => void;
  confirm: (config: ConfirmConfig) => void;
  dismiss: () => void;
}

// ── Styling per type ──────────────────────────────────────────────────
const TYPE_STYLES: Record<
  ToastType,
  { emoji: string; bg: string; border: string; color: string }
> = {
  success: { emoji: "✅", bg: "#ecfdf5", border: "#10b981", color: "#065f46" },
  error: { emoji: "❌", bg: "#fef2f2", border: "#ef4444", color: "#991b1b" },
  warning: { emoji: "⚠️", bg: "#fffbeb", border: "#f59e0b", color: "#92400e" },
  info: { emoji: "ℹ️", bg: "#eff6ff", border: "#3b82f6", color: "#1e40af" },
};

// ── Context ───────────────────────────────────────────────────────────
const AppToastContext = createContext<AppToastContextType>({
  toast: () => {},
  confirm: () => {},
  dismiss: () => {},
});

export const useAppToast = () => useContext(AppToastContext);

// ── Provider ──────────────────────────────────────────────────────────
export function AppToastProvider({ children }: { children: React.ReactNode }) {
  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirm state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(
    null,
  );
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Toast ───────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setToastVisible(false);
      setToastConfig(null);
    });
  }, []);

  const toast = useCallback(
    (config: ToastConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setToastConfig(config);
      setToastVisible(true);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();

      const duration = config.duration ?? 3500;
      if (duration > 0) {
        timerRef.current = setTimeout(() => dismiss(), duration);
      }
    },
    [dismiss],
  );

  // ── Confirm ─────────────────────────────────────────────────────
  const confirm = useCallback((config: ConfirmConfig) => {
    setConfirmConfig(config);
    setConfirmVisible(true);
    setConfirmLoading(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirmConfig) return;
    setConfirmLoading(true);
    try {
      await confirmConfig.onConfirm();
    } catch {}
    setConfirmLoading(false);
    setConfirmVisible(false);
    setConfirmConfig(null);
  }, [confirmConfig]);

  const handleCancel = useCallback(() => {
    confirmConfig?.onCancel?.();
    setConfirmVisible(false);
    setConfirmConfig(null);
  }, [confirmConfig]);

  const typeStyle = TYPE_STYLES[toastConfig?.type || "info"];

  return (
    <AppToastContext.Provider value={{ toast, confirm, dismiss }}>
      {children}

      {/* ── Toast banner ── */}
      {toastVisible && toastConfig && (
        <Animated.View
          style={[
            s.toastWrap,
            {
              backgroundColor: typeStyle.bg,
              borderColor: typeStyle.border,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={s.toastInner}
            onPress={dismiss}
            activeOpacity={0.9}
          >
            <Text style={s.toastEmoji}>{typeStyle.emoji}</Text>
            <View style={s.toastContent}>
              <Text style={[s.toastTitle, { color: typeStyle.color }]}>
                {toastConfig.title}
              </Text>
              {toastConfig.message && (
                <Text style={[s.toastMessage, { color: typeStyle.color }]}>
                  {toastConfig.message}
                </Text>
              )}
            </View>
            {toastConfig.action && (
              <TouchableOpacity
                style={[s.toastAction, { backgroundColor: typeStyle.border }]}
                onPress={() => {
                  toastConfig.action!.onPress();
                  dismiss();
                }}
              >
                <Text style={s.toastActionText}>
                  {toastConfig.action.label}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[s.toastDismiss, { color: typeStyle.color }]}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Confirm modal ── */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancel}
      >
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>{confirmConfig?.title}</Text>
            <Text style={s.confirmMessage}>{confirmConfig?.message}</Text>
            <View style={s.confirmActions}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={handleCancel}
                disabled={confirmLoading}
              >
                <Text style={s.confirmCancelText}>
                  {confirmConfig?.cancelLabel || "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.confirmBtn,
                  confirmConfig?.destructive && s.confirmBtnDestructive,
                ]}
                onPress={handleConfirm}
                disabled={confirmLoading}
              >
                <Text style={s.confirmBtnText}>
                  {confirmLoading
                    ? "…"
                    : confirmConfig?.confirmLabel || "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppToastContext.Provider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Toast
  toastWrap: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  toastEmoji: { fontSize: 20 },
  toastContent: { flex: 1 },
  toastTitle: { fontWeight: "700", fontSize: 14 },
  toastMessage: { fontSize: 13, marginTop: 2, opacity: 0.85 },
  toastAction: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toastActionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  toastDismiss: { fontSize: 14, opacity: 0.5, paddingLeft: 4 },

  // Confirm
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  confirmCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  confirmTitle: {
    fontWeight: "700",
    fontSize: 18,
    color: "#131367",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 21,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  confirmCancelText: { fontWeight: "600", fontSize: 14, color: "#6b7280" },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#131367",
    alignItems: "center",
  },
  confirmBtnDestructive: { backgroundColor: "#ef4444" },
  confirmBtnText: { fontWeight: "700", fontSize: 14, color: "#fff" },
});
