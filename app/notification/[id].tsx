import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast";
import { FontAwesome5 } from "@expo/vector-icons";

// ── Type styling ──────────────────────────────────────────────────────
const TYPE_META: Record<
  string,
  { icon: string; label: string; color: string; bg: string }
> = {
  booking_created: {
    icon: "calendar-alt",
    label: "Booking Created",
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  booking_confirmed: {
    icon: "check-circle",
    label: "Booking Confirmed",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  booking_cancelled: {
    icon: "times-circle",
    label: "Booking Cancelled",
    color: COLORS.red,
    bg: COLORS.redLight,
  },
  booking_completed: {
    icon: "trophy",
    label: "Booking Completed",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  booking_declined: {
    icon: "ban",
    label: "Booking Declined",
    color: COLORS.red,
    bg: COLORS.redLight,
  },
  booking_started: {
    icon: "running",
    label: "Job Started",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  payment_received: {
    icon: "credit-card",
    label: "Payment Received",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  payment_failed: {
    icon: "exclamation-circle",
    label: "Payment Failed",
    color: COLORS.red,
    bg: COLORS.redLight,
  },
  new_message: {
    icon: "comment-dots",
    label: "New Message",
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  new_review: {
    icon: "star",
    label: "New Review",
    color: COLORS.amber,
    bg: COLORS.amberLight,
  },
  withdrawal_request: {
    icon: "university",
    label: "Withdrawal Requested",
    color: COLORS.amber,
    bg: COLORS.amberLight,
  },
  withdrawal_approved: {
    icon: "check-circle",
    label: "Withdrawal Approved",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  withdrawal_rejected: {
    icon: "times-circle",
    label: "Withdrawal Rejected",
    color: COLORS.red,
    bg: COLORS.redLight,
  },
  support_reply: {
    icon: "ticket-alt",
    label: "Support Reply",
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  system_announcement: {
    icon: "bullhorn",
    label: "Announcement",
    color: COLORS.navy,
    bg: COLORS.muted,
  },
  account_update: {
    icon: "user-edit",
    label: "Account Update",
    color: COLORS.navy,
    bg: COLORS.muted,
  },
};

const DEFAULT_META = {
  icon: "bell",
  label: "Notification",
  color: COLORS.navy,
  bg: COLORS.muted,
};

// ── Get action button config ──────────────────────────────────────────

function getActionButton(
  notif: any,
): { label: string; route: any; params?: Record<string, string> } | null {
  const data =
    typeof notif.data === "string"
      ? JSON.parse(notif.data || "{}")
      : notif.data || {};
  const type = notif.type || "";

  if (type.startsWith("booking_") && data.booking_id) {
    return { label: "View Booking", route: `/booking/${data.booking_id}` };
  }
  if (
    (type === "payment_received" || type === "payment_failed") &&
    data.booking_id
  ) {
    return { label: "View Booking", route: `/booking/${data.booking_id}` };
  }
  if (type === "new_message") {
    if (data.booking_id) {
      return {
        label: "Open Chat",
        route: `/chat/${data.booking_id}`, // booking id as path — matches bookings list
        params: {
          booking_id: data.booking_id,
          name: data.maid_name || data.sender_name || "Maid",
        },
      };
    }
    return { label: "Open Messages", route: "/chat" };
  }
  if (type === "new_review" && data.maid_id) {
    return { label: "View Profile", route: `/maid/${data.maid_id}` };
  }
  if (type === "support_reply") {
    return { label: "Open Support Chat", route: "/support/chat" };
  }
  if (type.startsWith("withdrawal_")) {
    return { label: "View Profile", route: "/(tabs)/profile" };
  }
  return null;
}

// ── Time formatting ───────────────────────────────────────────────────
function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
}

export default function NotificationDetailScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const qc = useQueryClient();
  const { toast, confirm } = useAppToast();
  const params = useLocalSearchParams<{ id: string; notification?: string }>();

  let notif: any = null;
  try {
    notif = params.notification ? JSON.parse(params.notification) : null;
  } catch {}

  // Mark as read on open
  useEffect(() => {
    if (params.id && token && notif && !notif.is_read) {
      fetch(`${API_URL}/api/notifications/${params.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications-unread"] });
        })
        .catch(() => {});
    }
  }, [params.id]);

  if (!notif) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.headerBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={{ color: COLORS.gray }}>Notification not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = TYPE_META[notif.type] || DEFAULT_META;
  const action = getActionButton(notif);
  const data = notif.data || {};
  const priority = notif.priority || "normal";

  function handleDelete() {
    confirm({
      title: "Delete notification",
      message: "Remove this notification?",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/api/notifications/${params.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications-unread"] });
          router.back();
        } catch {
          toast({ type: "error", title: "Failed to delete notification" });
        }
      },
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40 }}>
          <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerBarTitle}>Notification</Text>
        <TouchableOpacity
          onPress={handleDelete}
          style={{ width: 40, alignItems: "flex-end" }}
        >
          <FontAwesome5 name="trash" size={20} color={COLORS.red} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Type badge + icon */}
        <View style={s.typeRow}>
          <View style={[s.typeBadge, { backgroundColor: meta.bg }]}>
            <FontAwesome5 name={meta.icon} size={16} color={meta.color} />
            <Text style={[s.typeBadgeLabel, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
          {priority !== "normal" && (
            <View
              style={[
                s.priorityBadge,
                priority === "urgent" ? s.priorityUrgent : s.priorityHigh,
              ]}
            >
              <FontAwesome5
                name={
                  priority === "urgent"
                    ? "exclamation-circle"
                    : "exclamation-triangle"
                }
                size={12}
                color={priority === "urgent" ? COLORS.red : COLORS.amber}
                style={{ marginRight: 4 }}
              />
              <Text style={s.priorityText}>
                {priority === "urgent" ? "Urgent" : "High"}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={s.title}>{notif.title}</Text>

        {/* Time */}
        <Text style={s.time}>{formatFullDate(notif.created_at)}</Text>

        {/* Body */}
        <View style={s.bodyCard}>
          <Text style={s.body}>{notif.body}</Text>
        </View>

        {/* Extra data */}
        {Object.keys(data).length > 0 && (
          <View style={s.dataCard}>
            <Text style={s.dataTitle}>Details</Text>
            {data.booking_id && (
              <View style={s.dataRow}>
                <Text style={s.dataLabel}>Booking</Text>
                <Text style={s.dataValue}>
                  #{data.booking_id.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            )}
            {data.maid_name && (
              <View style={s.dataRow}>
                <Text style={s.dataLabel}>Maid</Text>
                <Text style={s.dataValue}>{data.maid_name}</Text>
              </View>
            )}
            {data.amount && (
              <View style={s.dataRow}>
                <Text style={s.dataLabel}>Amount</Text>
                <Text style={s.dataValue}>
                  {data.currency || "₦"}
                  {data.amount}
                </Text>
              </View>
            )}
            {data.status && (
              <View style={s.dataRow}>
                <Text style={s.dataLabel}>Status</Text>
                <Text style={[s.dataValue, { textTransform: "capitalize" }]}>
                  {data.status.replace(/_/g, " ")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action button */}
        {action && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() =>
              router.push(
                action.params
                  ? { pathname: action.route, params: action.params }
                  : (action.route as any),
              )
            }
            activeOpacity={0.85}
          >
            <View style={s.actionRow}>
              <Text style={s.actionBtnText}>{action.label}</Text>
              <FontAwesome5 name="arrow-right" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backArrow: { fontSize: 22, color: COLORS.navy, fontFamily: FONTS.bold },
  headerBarTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
  },

  scroll: { padding: SPACING.lg },

  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  typeBadgeEmoji: { fontSize: 16 },
  typeBadgeLabel: { fontFamily: FONTS.bold, fontSize: 12 },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  priorityUrgent: { backgroundColor: COLORS.redLight },
  priorityHigh: { backgroundColor: COLORS.amberLight },
  priorityText: { fontFamily: FONTS.medium, fontSize: 11 },

  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: SPACING.xs,
    lineHeight: 28,
  },
  time: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.lg,
  },

  bodyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.navy,
    lineHeight: 24,
  },

  dataCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  dataTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight || COLORS.border,
  },
  dataLabel: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.gray },
  dataValue: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.navy },

  actionBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: "#fff",
  },
});
