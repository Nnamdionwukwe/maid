import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { FontAwesome5 } from "@expo/vector-icons";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "#fff3cd", text: "#856404" },
  in_progress: { bg: "#cce5ff", text: "#004085" },
  resolved: { bg: "#d4edda", text: "#155724" },
  closed: { bg: "#e2e3e5", text: "#383d41" },
};

const CATEGORY_ICONS: Record<string, string> = {
  "Booking Issue": "calendar-alt",
  Payment: "credit-card",
  "Maid / Service": "broom",
  Account: "user",
  Technical: "cogs",
  Other: "comment",
};

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchTickets(token: string) {
  const res = await fetch(`${API_URL}/api/maid-support`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load tickets");
  return res.json();
}

const FAQ = [
  {
    q: "How do I cancel a booking?",
    a: "Go to My Bookings, tap the booking, then tap Cancel Booking. Cancellation is free before the maid is confirmed.",
  },
  {
    q: "When will my payment be verified?",
    a: "Bank transfers are verified within 24 hours. Paystack and Stripe payments are instant.",
  },
  {
    q: "How do I track my maid?",
    a: "Once a booking is in_progress, tap the booking and you'll see the live location link.",
  },
  {
    q: "How do I get a refund?",
    a: "Refunds are processed within 3–5 business days after admin approval. Contact support with your booking ID.",
  },
  {
    q: "How do I change my address?",
    a: "You can update your address when creating a new booking. Existing bookings cannot have their address changed.",
  },
];

export default function SupportInboxScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [tab, setTab] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["support-tickets", tab],
    queryFn: () => fetchTickets(token!, tab),
    enabled: !!token,
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, []),
  );

  const allTickets = data?.tickets || [];
  const openCount = allTickets.filter((t: any) => t.status === "open").length;
  const totalReplies = allTickets.reduce(
    (acc: number, t: any) => acc + (t.reply_count || 0),
    0,
  );

  const conversations = (data?.tickets || []).filter((c: any) => {
    if (!tab) return true;
    return (c.status || "open") === tab;
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Support</Text>
          <Text style={s.headerSub}>
            Get help with your bookings and account
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {openCount > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{openCount} open</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => refetch()}>
            <FontAwesome5 name="sync" size={18} color={COLORS.navy} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c: any) => c.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={COLORS.navy}
          />
        }
        ListHeaderComponent={() => (
          <View>
            {/* Action row */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={s.newTicketBtn}
                onPress={() => router.push("/support/new")}
              >
                <Text style={s.newTicketBtnText}>+ New Ticket</Text>
              </TouchableOpacity>
            </View>

            {/* Status tabs */}
            <FlatList
              data={STATUS_TABS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(t) => t.key}
              contentContainerStyle={s.tabsRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.tab, tab === item.key && s.tabActive]}
                  onPress={() => setTab(item.key)}
                >
                  <Text
                    style={[s.tabText, tab === item.key && s.tabTextActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {isLoading && (
              <View style={s.center}>
                <ActivityIndicator color={COLORS.navy} />
              </View>
            )}

            {!isLoading && conversations.length === 0 && (
              <View style={s.emptyWrap}>
                <FontAwesome5 name="ticket-alt" size={48} color={COLORS.gray} />
                <Text style={s.emptyTitle}>No tickets yet</Text>
                <Text style={s.emptySub}>
                  Create a ticket and we'll help you right away
                </Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => router.push("/support/new")}
                >
                  <Text style={s.emptyBtnText}>+ New Ticket</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        renderItem={({ item }) => {
          const sc = STATUS_COLORS[item.status || "open"] || STATUS_COLORS.open;
          const cat = item.category || "Other";
          const hasNewReplies =
            (item.reply_count || 0) > 0 && item.status !== "closed";
          const iconName = CATEGORY_ICONS[cat] || "comment";
          return (
            <TouchableOpacity
              style={[s.ticketCard, hasNewReplies && s.ticketCardUnread]}
              onPress={() =>
                router.push({
                  pathname: "/support/ticket",
                  params: { ticket_id: item.id },
                })
              }
              activeOpacity={0.85}
            >
              {/* Unread dot */}
              {hasNewReplies && <View style={s.unreadDot} />}

              <View style={s.ticketTop}>
                <View style={s.ticketCategoryRow}>
                  <FontAwesome5
                    name={iconName}
                    size={14}
                    color={COLORS.gray}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={s.ticketCategory}>{cat}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.statusText, { color: sc.text }]}>
                    {(item.status || "open")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                </View>
              </View>

              <Text style={s.ticketSubject} numberOfLines={1}>
                {item.subject || "Support request"}
              </Text>

              {/* Message preview */}
              {item.message && (
                <Text style={s.ticketPreview} numberOfLines={1}>
                  {item.message}
                </Text>
              )}

              <View style={s.ticketFooter}>
                <Text style={s.ticketTime}>
                  {timeAgo(item.updated_at || item.created_at)}
                </Text>
                {(item.reply_count || 0) > 0 && (
                  <View style={s.replyCountBadge}>
                    <Text style={s.replyCountText}>
                      {item.reply_count}{" "}
                      {item.reply_count === 1 ? "reply" : "replies"}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={() => (
          <View>
            {/* Contact options */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Contact Us Directly</Text>
              <View style={s.contactRow}>
                {[
                  {
                    icon: "envelope",
                    label: "Email",
                    url: "mailto:hello@deusizisparkle.com",
                  },
                  {
                    icon: "phone-alt",
                    label: "Call",
                    url: "tel:+2348030588774",
                  },
                  {
                    icon: "comments",
                    label: "WhatsApp",
                    url: "https://wa.me/2348030588774?text=Hi, I need help with my Deusizi Sparkle account",
                  },
                ].map((o) => (
                  <TouchableOpacity
                    key={o.label}
                    style={s.contactBtn}
                    onPress={() =>
                      Linking.openURL(o.url).catch(() =>
                        Alert.alert("Cannot open", o.url),
                      )
                    }
                  >
                    <FontAwesome5 name={o.icon} size={28} color={COLORS.navy} />
                    <Text style={s.contactLabel}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* FAQ */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
              <View style={s.faqCard}>
                {FAQ.map((item, i) => (
                  <View key={i}>
                    <TouchableOpacity
                      style={s.faqRow}
                      onPress={() =>
                        setExpandedFaq(expandedFaq === i ? null : i)
                      }
                    >
                      <Text style={s.faqQ}>{item.q}</Text>
                      <View style={s.faqChevron}>
                        {expandedFaq === i ? (
                          <FontAwesome5
                            name="chevron-up"
                            size={12}
                            color={COLORS.gray}
                          />
                        ) : (
                          <FontAwesome5
                            name="chevron-down"
                            size={12}
                            color={COLORS.gray}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                    {expandedFaq === i && (
                      <View style={s.faqAnswer}>
                        <Text style={s.faqAnswerText}>{item.a}</Text>
                      </View>
                    )}
                    {i < FAQ.length - 1 && <View style={s.faqDivider} />}
                  </View>
                ))}
              </View>
            </View>
            <View style={{ height: 32 }} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  backBtn: { width: 40, paddingTop: 2 },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.navy },
  headerSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: COLORS.amberLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  headerBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.amber,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  newTicketBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
  },
  newTicketBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },
  tabsRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.xs,
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
  center: { paddingVertical: 40, alignItems: "center" },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: SPACING.sm },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.navy },
  emptySub: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.gray },
  emptyBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
  },
  emptyBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },
  ticketCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
  },
  ticketCardUnread: { borderColor: COLORS.navy, borderWidth: 1.5 },
  unreadDot: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.navy,
  },
  ticketTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  ticketCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ticketCategory: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.gray,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusText: { fontFamily: FONTS.bold, fontSize: 11 },
  ticketSubject: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.navy,
    marginBottom: 4,
  },
  ticketPreview: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 6,
  },
  ticketTime: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  replyCountBadge: {
    backgroundColor: COLORS.blueLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  replyCountText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.blue,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  contactRow: { flexDirection: "row", gap: SPACING.md },
  contactBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  contactLabel: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.navy },
  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  faqRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.lg,
  },
  faqQ: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    flex: 1,
    marginRight: SPACING.md,
    lineHeight: 20,
  },
  faqChevron: { marginLeft: 4 },
  faqAnswer: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  faqAnswerText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 22,
  },
  faqDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.lg,
  },
});
