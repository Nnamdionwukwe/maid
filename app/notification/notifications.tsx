import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast";
import { FontAwesome5 } from "@expo/vector-icons";

// ── API helpers ───────────────────────────────────────────────────────
async function fetchNotifications(token: string, page: number) {
  const res = await fetch(
    `${API_URL}/api/notifications?page=${page}&limit=30`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

async function fetchUnreadCount(token: string) {
  const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { count: 0 };
  return res.json();
}

async function markOneRead(token: string, id: string) {
  await fetch(`${API_URL}/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function markAllRead(token: string) {
  await fetch(`${API_URL}/api/notifications/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function deleteOne(token: string, id: string) {
  await fetch(`${API_URL}/api/notifications/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function deleteAllRead(token: string) {
  await fetch(`${API_URL}/api/notifications/clear/read`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Notification type → icon + color ─────────────────────────────────
const TYPE_MAP: Record<string, { icon: string; color: string; bg: string }> = {
  booking_created: {
    icon: "calendar-alt",
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  booking_confirmed: {
    icon: "check-circle",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  booking_cancelled: {
    icon: "times-circle",
    color: COLORS.red,
    bg: COLORS.redLight,
  },
  booking_completed: {
    icon: "trophy",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  booking_declined: { icon: "ban", color: COLORS.red, bg: COLORS.redLight },
  booking_started: {
    icon: "running",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  payment_received: {
    icon: "credit-card",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  payment_failed: {
    icon: "exclamation-circle",
    color: COLORS.red,
    bg: COLORS.redLight,
  },
  new_message: {
    icon: "comment-dots",
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  new_review: { icon: "star", color: COLORS.amber, bg: COLORS.amberLight },
  withdrawal_request: {
    icon: "university",
    color: COLORS.amber,
    bg: COLORS.amberLight,
  },
  withdrawal_approved: {
    icon: "check-circle",
    color: COLORS.green,
    bg: COLORS.greenLight,
  },
  withdrawal_rejected: {
    icon: "times-circle",
    color: COLORS.red,
    bg: COLORS.redLight,
  },
  support_reply: {
    icon: "ticket-alt",
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  system_announcement: {
    icon: "bullhorn",
    color: COLORS.navy,
    bg: COLORS.muted,
  },
  account_update: { icon: "user-edit", color: COLORS.navy, bg: COLORS.muted },
};

const DEFAULT_TYPE = { icon: "bell", color: COLORS.navy, bg: COLORS.muted };

// ── Time formatting ───────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Get navigation target from notification ───────────────────────────
function getNavTarget(notif: any): { pathname: string; params?: any } | null {
  const data =
    typeof notif.data === "string"
      ? JSON.parse(notif.data || "{}")
      : notif.data || {};
  const type = notif.type || "";

  if (type.startsWith("booking_") && data.booking_id) {
    return { pathname: `/booking/${data.booking_id}` };
  }
  if (
    (type === "payment_received" || type === "payment_failed") &&
    data.booking_id
  ) {
    return { pathname: `/booking/${data.booking_id}` };
  }
  if (type === "new_message") {
    if (data.booking_id) {
      return {
        pathname: `/chat/${data.booking_id}`,
        params: { type: "booking" },
      };
    }
    return { pathname: "/chat" };
  }
  if (type === "new_review" && data.maid_id) {
    return { pathname: `/maid/${data.maid_id}` };
  }
  if (type === "support_reply") {
    return { pathname: "/support/chat" };
  }
  return null;
}

// ── Priority indicator ────────────────────────────────────────────────
function PriorityDot({ priority }: { priority?: string }) {
  if (!priority || priority === "normal") return null;
  const color = priority === "urgent" ? COLORS.red : COLORS.amber;
  return <View style={[s.priorityDot, { backgroundColor: color }]} />;
}

// ── Notification card ─────────────────────────────────────────────────
function NotificationCard({
  notification,
  onPress,
  onDelete,
}: {
  notification: any;
  onPress: () => void;
  onDelete: () => void;
}) {
  const typeInfo = TYPE_MAP[notification.type] || DEFAULT_TYPE;
  const isUnread = !notification.is_read;

  return (
    <TouchableOpacity
      style={[s.card, isUnread && s.cardUnread]}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[s.iconWrap, { backgroundColor: typeInfo.bg }]}>
        <FontAwesome5 name={typeInfo.icon} size={20} color={typeInfo.color} />
      </View>

      {/* Content */}
      <View style={s.cardContent}>
        <View style={s.cardTopRow}>
          <Text
            style={[s.cardTitle, isUnread && s.cardTitleUnread]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <View style={s.cardTopRight}>
            <PriorityDot priority={notification.priority} />
            <Text style={[s.cardTime, isUnread && s.cardTimeUnread]}>
              {timeAgo(notification.created_at)}
            </Text>
          </View>
        </View>
        <Text style={s.cardBody} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>

      {/* Unread dot */}
      {isUnread && <View style={s.unreadDot} />}
    </TouchableOpacity>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────
const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "booking", label: "Bookings" },
  { key: "payment", label: "Payments" },
  { key: "message", label: "Messages" },
  { key: "system", label: "System" },
];

// ── Main screen ───────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const qc = useQueryClient();
  const { toast, confirm } = useAppToast();
  const [filter, setFilter] = useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(token!, 1),
    enabled: !!token,
    staleTime: 0,
  });

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => fetchUnreadCount(token!),
    enabled: !!token,
    staleTime: 0,
    refetchInterval: 20000,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchUnread();
    }, []),
  );

  const notifications: any[] = data?.notifications || [];
  const unreadCount: number = unreadData?.count || data?.unread || 0;

  // Filter
  const filtered = notifications.filter((n: any) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.is_read;
    if (filter === "booking") return n.type?.startsWith("booking_");
    if (filter === "payment")
      return (
        n.type?.startsWith("payment_") || n.type?.startsWith("withdrawal_")
      );
    if (filter === "message")
      return n.type === "new_message" || n.type === "support_reply";
    if (filter === "system")
      return n.type === "system_announcement" || n.type === "account_update";
    return true;
  });

  // ── Actions ─────────────────────────────────────────────────────
  async function handlePress(notif: any) {
    if (!notif.is_read && token) {
      markOneRead(token, notif.id).catch(() => {});
      refetchUnread();
    }

    router.push({
      pathname: "/notification/[id]",
      params: { id: notif.id, notification: JSON.stringify(notif) },
    });
  }

  function handleDelete(notif: any) {
    confirm({
      title: "Delete notification",
      message: "Remove this notification?",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteOne(token!, notif.id);
          refetch();
          refetchUnread();
        } catch {
          toast({ type: "error", title: "Failed to delete notification" });
        }
      },
    });
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead(token!);
      refetch();
      refetchUnread();
    } catch {
      toast({ type: "error", title: "Failed to mark all as read" });
    }
  }

  function handleClearRead() {
    confirm({
      title: "Clear read notifications",
      message: "Delete all read notifications?",
      confirmLabel: "Clear",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteAllRead(token!);
          refetch();
          refetchUnread();
        } catch {
          toast({ type: "error", title: "Failed to clear notifications" });
        }
      },
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header with back button ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={s.headerSub}>{unreadCount} unread</Text>
            )}
          </View>
        </View>
        <View style={s.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={s.headerActionBtn}
              onPress={handleMarkAllRead}
            >
              <Text style={s.headerActionText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.headerActionBtn} onPress={handleClearRead}>
            <Text style={[s.headerActionText, { color: COLORS.red }]}>
              Clear read
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Filter tabs ── */}
      <FlatList
        data={FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(f) => f.key}
        style={{ flexGrow: 0 }}
        contentContainerStyle={s.tabsRow}
        renderItem={({ item }) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              style={[s.tab, active && s.tabActive]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Content ── */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.navy} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <FontAwesome5 name="bell" size={48} color={COLORS.gray} />
          <Text style={s.emptyTitle}>
            {filter === "unread" ? "All caught up!" : "No notifications yet"}
          </Text>
          <Text style={s.emptySub}>
            {filter === "unread"
              ? "You've read all your notifications"
              : "We'll let you know when something happens"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n: any) => n.id}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
                refetchUnread();
              }}
              tintColor={COLORS.navy}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.navy,
  },
  headerSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
  },
  headerActionBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  headerActionText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.blue,
  },

  // Tabs
  tabsRow: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
    alignItems: "center",
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 34,
    justifyContent: "center",
  },
  tabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tabText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.gray },
  tabTextActive: { color: "#fff" },

  // List
  list: { paddingHorizontal: SPACING.md, paddingBottom: 32 },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: {
    backgroundColor: "#f8f9ff",
    borderColor: "rgba(19,19,103,0.12)",
  },

  // Icon
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },

  // Content
  cardContent: { flex: 1, marginRight: SPACING.xs },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    flex: 1,
    marginRight: SPACING.sm,
  },
  cardTitleUnread: { fontFamily: FONTS.bold },
  cardTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardTime: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
  },
  cardTimeUnread: {
    color: COLORS.navy,
    fontFamily: FONTS.medium,
  },
  cardBody: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 19,
  },

  // Priority
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Unread dot
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blue,
    marginLeft: SPACING.xs,
    marginTop: 4,
    flexShrink: 0,
  },

  // Empty / loading
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.navy,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
  },
});
