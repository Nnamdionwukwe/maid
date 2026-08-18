import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import {
  API_URL,
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  BOOKING_STATUS_COLORS,
} from "../../constants";
import { FontAwesome5 } from "@expo/vector-icons";

// ── Tabs ──────────────────────────────────────────────────────────────
const TABS = [
  { key: "all", label: "All" },
  { key: "inquiry", label: "Inquiries" },
  { key: "booking", label: "Bookings" },
];

// ── API calls ─────────────────────────────────────────────────────────
async function fetchConversations(token: string) {
  const res = await fetch(`${API_URL}/api/chat`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

async function fetchUnreadCount(token: string) {
  const res = await fetch(`${API_URL}/api/chat/unread`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { unread: 0 };
  return res.json();
}

// ── Time formatting (matches website: "now", "4m", "5d", "20 Apr") ──
function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Get conversation type ─────────────────────────────────────────────
function getConvType(conv: any): "booking" | "inquiry" {
  if (conv.type === "inquiry") return "inquiry";
  if (conv.booking_id) return "booking";
  return "booking";
}

// ── Avatar with optional unread badge ─────────────────────────────────
function ConvAvatar({
  uri,
  name,
  unread,
}: {
  uri?: string;
  name?: string;
  unread: number;
}) {
  const initials = (name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={s.avatarWrap}>
      {uri ? (
        <Image source={{ uri }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarPlaceholder]}>
          <Text style={s.avatarInitials}>{initials}</Text>
        </View>
      )}
      {unread > 0 && (
        <View style={s.unreadBadge}>
          <Text style={s.unreadBadgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </View>
  );
}

// ── Conversation card ─────────────────────────────────────────────────
function ConversationCard({
  conversation,
  userId,
  onPress,
}: {
  conversation: any;
  userId: string;
  onPress: () => void;
}) {
  const type = getConvType(conversation);
  const isCustomer =
    String(conversation.customer_id).toLowerCase() ===
    String(userId).toLowerCase();

  // Show the OTHER party's info
  const name = isCustomer
    ? conversation.maid_name || "Unknown"
    : conversation.customer_name || "Unknown";
  const avatarUri = isCustomer
    ? conversation.maid_avatar
    : conversation.customer_avatar;

  // Unread count for current user
  const unread = isCustomer
    ? conversation.unread_customer || 0
    : conversation.unread_maid || 0;

  // Last message preview
  const rawLastMsg = conversation.last_message;
  const lastMsg =
    rawLastMsg === "deleted" || !rawLastMsg
      ? rawLastMsg === "deleted"
        ? "This message was deleted"
        : "Start the conversation…"
      : rawLastMsg;
  const lastTime = conversation.last_message_at || conversation.updated_at;

  // Booking status (only for booking type)
  const bookingStatus = conversation.booking_status;
  const statusColors = bookingStatus
    ? BOOKING_STATUS_COLORS[bookingStatus] || null
    : null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <ConvAvatar uri={avatarUri} name={name} unread={unread} />

      <View style={s.cardContent}>
        <View style={s.cardTopRow}>
          <Text
            style={[s.cardName, unread > 0 && s.cardNameUnread]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[s.cardTime, unread > 0 && s.cardTimeUnread]}>
            {timeAgo(lastTime)}
          </Text>
        </View>

        <View style={s.cardBottomRow}>
          <Text
            style={[s.cardPreview, unread > 0 && s.cardPreviewUnread]}
            numberOfLines={1}
          >
            {lastMsg}
          </Text>

          <View style={s.cardBadges}>
            {/* Type badge */}
            <View
              style={[
                s.typePill,
                type === "inquiry" ? s.typePillInquiry : s.typePillBooking,
              ]}
            >
              <Text
                style={[
                  s.typePillText,
                  type === "inquiry"
                    ? s.typePillTextInquiry
                    : s.typePillTextBooking,
                ]}
              >
                {type}
              </Text>
            </View>

            {/* Booking status badge */}
            {type === "booking" && bookingStatus && statusColors && (
              <View
                style={[s.statusPill, { backgroundColor: statusColors.bg }]}
              >
                <Text style={[s.statusPillText, { color: statusColors.text }]}>
                  {bookingStatus.replace(/_/g, " ")}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <FontAwesome5 name="chevron-right" size={16} color={COLORS.grayLight} />
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────
export default function MessagesScreen() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  // Fetch conversations
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => fetchConversations(token!),
    enabled: !!token,
    staleTime: 0,
  });

  // Fetch unread count
  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ["chat-unread"],
    queryFn: () => fetchUnreadCount(token!),
    enabled: !!token,
    staleTime: 0,
    refetchInterval: 15000, // poll every 15s
  });

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchUnread();
    }, []),
  );

  const conversations: any[] = data?.conversations || [];
  const totalUnread: number = unreadData?.unread || 0;

  // Filter by tab
  const tabFiltered = conversations.filter((c: any) => {
    if (tab === "all") return true;
    if (tab === "inquiry") return getConvType(c) === "inquiry";
    if (tab === "booking") return getConvType(c) === "booking";
    return true;
  });

  // Filter by search
  const filtered = tabFiltered.filter((c: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const maidName = (c.maid_name || "").toLowerCase();
    const customerName = (c.customer_name || "").toLowerCase();
    const lastMsg = (c.last_message || "").toLowerCase();
    return (
      maidName.includes(q) || customerName.includes(q) || lastMsg.includes(q)
    );
  });

  // Tab counts
  const allCount = conversations.length;
  const inquiryCount = conversations.filter(
    (c: any) => getConvType(c) === "inquiry",
  ).length;
  const bookingCount = conversations.filter(
    (c: any) => getConvType(c) === "booking",
  ).length;
  const tabCounts: Record<string, number> = {
    all: allCount,
    inquiry: inquiryCount,
    booking: bookingCount,
  };

  function handleConvPress(conv: any) {
    const type = getConvType(conv);
    const isCustomer =
      String(conv.customer_id).toLowerCase() === String(user?.id).toLowerCase();
    const name = isCustomer ? conv.maid_name : conv.customer_name;
    const avatar = isCustomer ? conv.maid_avatar : conv.customer_avatar;

    if (type === "booking" && conv.booking_id) {
      router.push({
        pathname: `/chat/${conv.booking_id}`,
        params: {
          type: "booking",
          name: name || "Chat",
          avatar: avatar || "",
          conversation_id: conv.id,
        },
      });
    } else {
      // Inquiry — use maid_id
      const cutomerId = isCustomer ? conv.maid_id : conv.customer_id;
      router.push({
        pathname: `/chat/${cutomerId}`,
        params: {
          type: "inquiry",
          name: name || "Chat",
          avatar: avatar || "",
          conversation_id: conv.id,
        },
      });
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <Text style={s.headerSub}>{totalUnread} unread</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Search ── */}
      <View style={s.searchWrap}>
        <FontAwesome5
          name="search"
          size={16}
          color={COLORS.grayLight}
          style={{ marginRight: SPACING.sm }}
        />
        <TextInput
          style={s.searchInput}
          placeholder="Search conversations…"
          placeholderTextColor={COLORS.grayLight}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <FontAwesome5 name="times" size={16} color={COLORS.gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tabs ── */}
      <FlatList
        data={TABS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(t) => t.key}
        style={{ flexGrow: 0 }}
        contentContainerStyle={s.tabsRow}
        renderItem={({ item }) => {
          const active = tab === item.key;
          const count = tabCounts[item.key] || 0;
          return (
            <TouchableOpacity
              style={[s.tab, active && s.tabActive]}
              onPress={() => setTab(item.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {item.label}
                {count > 0 ? ` ${count}` : ""}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Content ── */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={s.loadingText}>Loading messages…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <FontAwesome5 name="comment-dots" size={48} color={COLORS.gray} />
          <Text style={s.emptyTitle}>
            {search
              ? "No results found"
              : tab !== "all"
                ? `No ${tab === "inquiry" ? "inquiry" : "booking"} conversations`
                : "No messages yet"}
          </Text>
          <Text style={s.emptySub}>
            {search
              ? "Try a different search term"
              : "Start a conversation from a maid profile or booking"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c: any) => c.id}
          renderItem={({ item }) => (
            <ConversationCard
              conversation={item}
              userId={user?.id || ""}
              onPress={() => handleConvPress(item)}
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
    alignItems: "center",
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: "#fff",
  },
  headerSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    marginTop: 1,
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  searchIcon: { fontSize: 16, marginRight: SPACING.sm, opacity: 0.5 },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.navy,
    paddingVertical: 0,
  },
  searchClear: { fontSize: 16, color: COLORS.gray, paddingLeft: SPACING.sm },

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

  // Conversation card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Avatar
  avatarWrap: { position: "relative", marginRight: SPACING.md },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.muted,
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.blueLight,
  },
  avatarInitials: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#e53e3e",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  unreadBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: "#fff",
  },

  // Card content
  cardContent: { flex: 1, marginRight: SPACING.xs },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardName: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    flex: 1,
    marginRight: SPACING.sm,
  },
  cardNameUnread: { fontFamily: FONTS.bold },
  cardTime: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
  },
  cardTimeUnread: {
    color: COLORS.navy,
    fontFamily: FONTS.medium,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardPreview: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    flex: 1,
    marginRight: SPACING.sm,
  },
  cardPreviewUnread: {
    fontFamily: FONTS.medium,
    color: COLORS.navy,
  },

  // Badges
  cardBadges: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    flexShrink: 0,
  },
  typePill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillBooking: {
    backgroundColor: "rgba(19,19,103,0.08)",
  },
  typePillInquiry: {
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  typePillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    textTransform: "capitalize",
  },
  typePillTextBooking: { color: COLORS.navy },
  typePillTextInquiry: { color: "#2e7d32" },

  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusPillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    textTransform: "capitalize",
  },

  chevron: {
    fontSize: 20,
    color: COLORS.grayLight,
    marginLeft: SPACING.xs,
  },

  // Empty & loading
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    marginTop: SPACING.sm,
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
