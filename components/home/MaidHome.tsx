// components/home/MaidHome.tsx

import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS, fmt } from "../../constants";
import { useAppToast } from "../../components/AppToast";
import FloatingSupportButton from "../FloatingSupportButton";
import { SubscriptionBadge, VerifiedBadge } from "../MaidBadge";
import MaidAvatar from "../MaidAvatar";
import * as Location from "expo-location";
import { FontAwesome5 } from "@expo/vector-icons";

const { width: W } = Dimensions.get("window");

// ── Spinner component for buttons ─────────────────────────────────────
const ButtonSpinner = ({ color = "#fff", size = "small" }) => (
  <ActivityIndicator size={size} color={color} />
);

// ── API helpers ───────────────────────────────────────────────────────
const apiFetch = async (path: string, token: string) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

const apiPatch = async (path: string, token: string, body: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

const apiPost = async (path: string, token: string, body?: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

// ── Status config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  pending: { color: "#f59e0b", bg: "#fffbeb", label: "Pending" },
  confirmed: { color: "#3b82f6", bg: "#eff6ff", label: "Confirmed" },
  in_progress: { color: "#8b5cf6", bg: "#f5f3ff", label: "In Progress" },
  completed: { color: "#10b981", bg: "#ecfdf5", label: "Completed" },
  cancelled: { color: "#ef4444", bg: "#fef2f2", label: "Cancelled" },
  declined: { color: "#6b7280", bg: "#f3f4f6", label: "Declined" },
  awaiting_payment: { color: "#f59e0b", bg: "#fffbeb", label: "Awaiting Pay" },
};

const BOOKING_TABS = [
  "All",
  "Pending",
  "Confirmed",
  "In Progress",
  "Completed",
  "Declined",
  "Cancelled",
];
const tabToStatus: Record<string, string | null> = {
  All: null,
  Pending: "pending",
  Confirmed: "confirmed",
  "In Progress": "in_progress",
  Completed: "completed",
  Declined: "declined",
  Cancelled: "cancelled",
};

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  confirmed: 1,
  pending: 2,
  awaiting_payment: 3,
  completed: 4,
  cancelled: 5,
  declined: 6,
};

// ── Open Google Maps with coordinates ─────────────────────────────────
function openInGoogleMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`),
  );
}

// ── Main screen ───────────────────────────────────────────────────────
export default function MaidHomeScreen() {
  const router = useRouter();
  const { token, user, logout } = useAuthStore();
  const { toast, confirm } = useAppToast();
  const qc = useQueryClient();

  const [bookingTab, setBookingTab] = useState("All");
  const [toggling, setToggling] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineModal, setDeclineModal] = useState(false);
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineLoading, setDeclineLoading] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState<string | null>(
    null,
  );
  const [checkoutLat, setCheckoutLat] = useState<number | null>(null);
  const [checkoutLng, setCheckoutLng] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkinModal, setCheckinModal] = useState(false);
  const [checkinBookingId, setCheckinBookingId] = useState<string | null>(null);
  const [checkinLat, setCheckinLat] = useState<number | null>(null);
  const [checkinLng, setCheckinLng] = useState<number | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────
  const { data: meData, refetch: refetchMe } = useQuery({
    queryKey: ["maid-me"],
    queryFn: () => apiFetch("/api/auth/me", token!),
    enabled: !!token,
  });
  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ["maid-profile"],
    queryFn: () => apiFetch(`/api/maids/${user?.id}`, token!),
    enabled: !!token && !!user?.id,
  });
  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ["maid-wallet"],
    queryFn: () => apiFetch("/api/wallet", token!),
    enabled: !!token,
  });
  const { data: bookingsData, refetch: refetchBookings } = useQuery({
    queryKey: ["maid-bookings"],
    queryFn: () => apiFetch("/api/bookings?limit=50", token!),
    enabled: !!token,
  });
  const { data: unreadChat } = useQuery({
    queryKey: ["maid-chat-unread"],
    queryFn: () => apiFetch("/api/chat/unread", token!),
    enabled: !!token,
    refetchInterval: 15000,
  });
  const { data: unreadNotif } = useQuery({
    queryKey: ["maid-notif-unread"],
    queryFn: () => apiFetch("/api/notifications/unread-count", token!),
    enabled: !!token,
    refetchInterval: 15000,
  });
  // Update the support query to fetch the actual count of open tickets
  const { data: supportTickets, refetch: refetchSupportTickets } = useQuery({
    queryKey: ["maid-support-tickets"],
    queryFn: async () => {
      const res = await apiFetch("/api/maid-support?limit=50", token!);
      const tickets = res.tickets || [];
      // Count only open and in_progress tickets
      const openCount = tickets.filter(
        (t: any) => t.status === "open" || t.status === "in_progress",
      ).length;
      return { tickets, openCount };
    },
    enabled: !!token,
    refetchInterval: 30000, // Refresh every 30 seconds like the website
  });

  // Get the open count
  const supportOpenCount = supportTickets?.openCount || 0;

  const profile = meData?.user || user;
  const maidProfile = profileData?.maid;
  const wallets = walletData?.wallets || [];
  const allBookings = bookingsData?.bookings || [];
  const chatBadge = unreadChat?.unread || 0;
  const notifBadge = unreadNotif?.count || 0;

  const isAvailable = maidProfile?.is_available ?? false;

  // Filter bookings
  const statusFilter = tabToStatus[bookingTab];
  const filteredBookings = (
    statusFilter
      ? allBookings.filter((b: any) => b.status === statusFilter)
      : allBookings
  )
    .slice()
    .sort((a: any, b: any) => {
      const so = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (so !== 0) return so;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

  // Stats
  const totalBookings = allBookings.length;
  const pendingBookings = allBookings.filter(
    (b: any) => b.status === "pending" || b.status === "confirmed",
  ).length;
  const doneBookings = allBookings.filter(
    (b: any) => b.status === "completed",
  ).length;

  const initials = (profile?.name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useFocusEffect(
    useCallback(() => {
      refetchMe();
      refetchProfile();
      refetchWallet();
      refetchBookings();
    }, []),
  );

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchMe(),
      refetchProfile(),
      refetchWallet(),
      refetchBookings(),
    ]);
  }, []);

  // ── Availability toggle ─────────────────────────────────────────
  async function handleToggleAvailability() {
    setToggling(true);
    try {
      await apiPatch("/api/maids/profile", token!, {
        is_available: !isAvailable,
      });
      refetchProfile();
      toast({
        type: "success",
        title: isAvailable ? "Marked unavailable" : "You're now visible!",
      });
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setToggling(false);
    }
  }

  // ── Booking actions ─────────────────────────────────────────────
  async function handleBookingAction(
    bookingId: string,
    action: string,
    body?: any,
  ) {
    setActionLoading(bookingId);
    try {
      let res;
      if (action === "checkin") {
        res = await apiPost(
          `/api/bookings/${bookingId}/checkin`,
          token!,
          body || {},
        );
      } else if (action === "checkout") {
        res = await apiPost(
          `/api/bookings/${bookingId}/checkout`,
          token!,
          body || {},
        );
      } else {
        res = await apiPatch(`/api/bookings/${bookingId}/status`, token!, {
          status: action,
          ...body,
        });
      }
      if (res.error) throw new Error(res.error);
      toast({
        type: "success",
        title: `Booking ${action === "checkin" ? "checked in" : action === "checkout" ? "checked out" : action}!`,
      });
      refetchBookings();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setActionLoading(null);
    }
  }

  // ── Handle decline with reason ───────────────────────────────────
  async function handleDecline() {
    if (!declineBookingId) return;
    setDeclineLoading(true);
    try {
      const res = await apiPatch(
        `/api/bookings/${declineBookingId}/status`,
        token!,
        {
          status: "declined",
          declined_reason: declineReason || "No reason provided",
        },
      );
      if (res.error) throw new Error(res.error);
      toast({
        type: "success",
        title: "Booking declined",
      });
      setDeclineModal(false);
      setDeclineBookingId(null);
      setDeclineReason("");
      refetchBookings();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setDeclineLoading(false);
    }
  }

  // ── Handle checkout with GPS ────────────────────────────────────
  async function handleCheckout() {
    if (!checkoutBookingId) return;
    setCheckoutLoading(true);
    try {
      const res = await apiPost(
        `/api/bookings/${checkoutBookingId}/checkout`,
        token!,
        {
          lat: checkoutLat,
          lng: checkoutLng,
        },
      );
      if (res.error) throw new Error(res.error);
      toast({
        type: "success",
        title: "Checked out — location registered!",
      });
      setCheckoutModal(false);
      setCheckoutBookingId(null);
      setCheckoutLat(null);
      setCheckoutLng(null);
      refetchBookings();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setCheckoutLoading(false);
    }
  }

  // ── Handle check-in with GPS ────────────────────────────────────
  async function handleCheckin() {
    if (!checkinBookingId) return;
    setCheckinLoading(true);
    try {
      const res = await apiPost(
        `/api/bookings/${checkinBookingId}/checkin`,
        token!,
        {
          lat: checkinLat,
          lng: checkinLng,
        },
      );
      if (res.error) throw new Error(res.error);
      toast({
        type: "success",
        title: "Checked in — location registered!",
      });
      setCheckinModal(false);
      setCheckinBookingId(null);
      setCheckinLat(null);
      setCheckinLng(null);
      refetchBookings();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setCheckinLoading(false);
    }
  }

  // ── Initiate check-in with GPS request ──────────────────────────
  async function initiateCheckin(bookingId: string) {
    try {
      const { status } =
        await require("expo-location").requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // Proceed without GPS
        setCheckinBookingId(bookingId);
        setCheckinLat(null);
        setCheckinLng(null);
        setCheckinModal(true);
        return;
      }

      const location = await require("expo-location").getCurrentPositionAsync({
        accuracy: require("expo-location").Accuracy.Balanced,
      });

      setCheckinBookingId(bookingId);
      setCheckinLat(location.coords.latitude);
      setCheckinLng(location.coords.longitude);
      setCheckinModal(true);
    } catch {
      // Proceed without GPS
      setCheckinBookingId(bookingId);
      setCheckinLat(null);
      setCheckinLng(null);
      setCheckinModal(true);
    }
  }

  // ── Initiate checkout with GPS request ──────────────────────────

  async function initiateCheckout(bookingId: string) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCheckoutLat(loc.coords.latitude);
        setCheckoutLng(loc.coords.longitude);
      } else {
        setCheckoutLat(null);
        setCheckoutLng(null);
      }
    } catch {
      setCheckoutLat(null);
      setCheckoutLng(null);
    } finally {
      // Always open the modal regardless of GPS outcome
      setCheckoutBookingId(bookingId);
      setCheckoutModal(true);
    }
  }

  function confirmAction(
    bookingId: string,
    action: string,
    title: string,
    message: string,
    destructive = false,
  ) {
    confirm({
      title,
      message,
      destructive,
      confirmLabel: title,
      onConfirm: () => handleBookingAction(bookingId, action),
    });
  }

  // ── Logout ──────────────────────────────────────────────────────
  function handleLogout() {
    confirm({
      title: "Sign out?",
      message: "Are you sure?",
      destructive: true,
      confirmLabel: "Sign out",
      onConfirm: async () => {
        await logout();
        router.replace("/(auth)/login");
      },
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ═══════ HEADER ═══════ */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          {profile?.avatar ? (
            <TouchableOpacity onPress={() => router.push("/settings" as any)}>
              <MaidAvatar
                uri={profile?.avatar}
                name={profile?.name}
                size={48}
                hasProBadge={profile?.has_pro_badge}
                plan={profile?.subscription_plan}
              />
            </TouchableOpacity>
          ) : (
            <View style={[s.headerAvatar, s.headerAvatarFallback]}>
              <Text style={s.headerInit}>{initials}</Text>
            </View>
          )}
          <View>
            <Text style={s.headerName} numberOfLines={1}>
              {profile?.name || "Maid"}
            </Text>
            <Text style={s.headerRole}>Workers · Deusizi Sparkle</Text>
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                marginTop: 4,
                alignItems: "center",
              }}
            >
              {profile?.id_verified && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                >
                  <VerifiedBadge size="sm" />
                  <Text style={s.badgeLabel}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={s.headerRight}>
          {/* Support */}
          <TouchableOpacity onPress={() => router.push("/support")}>
            <FontAwesome5 name="headset" size={22} color="#fff" />
            {supportOpenCount > 0 && (
              <View style={s.iconBadge}>
                <Text style={s.iconBadgeText}>
                  {supportOpenCount > 99 ? "99" : supportOpenCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Notification bell */}
          <TouchableOpacity
            onPress={() => router.push("/notification/notifications" as any)}
            style={s.headerIcon}
          >
            <FontAwesome5 name="bell" size={22} color="#fff" />
            {notifBadge > 0 && (
              <View style={s.iconBadge}>
                <Text style={s.iconBadgeText}>
                  {notifBadge > 99 ? "99" : notifBadge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Chat */}
          <TouchableOpacity
            onPress={() => router.push("/chat" as any)}
            style={s.headerIcon}
          >
            <FontAwesome5 name="comments" size={22} color="#fff" />
            {chatBadge > 0 && (
              <View style={s.iconBadge}>
                <Text style={s.iconBadgeText}>{chatBadge}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={COLORS.navy}
          />
        }
      >
        {/* ═══════ AVAILABILITY ═══════ */}
        <View style={s.availSection}>
          <View>
            <Text style={s.availTitle}>Availability</Text>
            <Text style={s.availSub}>
              {isAvailable
                ? "You are visible to customers"
                : "You are hidden from search"}
            </Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={handleToggleAvailability}
            disabled={toggling}
            trackColor={{ false: COLORS.border, true: COLORS.green }}
            thumbColor="#fff"
          />
        </View>
        {/* ═══════ STATS ═══════ */}
        {/* <View style={s.statsRow}>
          <View style={s.statCard}>
            <FontAwesome5 name="clipboard-list" size={22} color={COLORS.navy} />
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={s.statLabel}>TOTAL</Text>
              <Text style={s.statValue}>{totalBookings}</Text>
            </View>
          </View>
          <View style={s.statCard}>
            <FontAwesome5 name="clock" size={22} color={COLORS.amber} />
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={s.statLabel}>PENDING</Text>
              <Text style={s.statValue}>{pendingBookings}</Text>
            </View>
          </View>
          <View style={[s.statCard, { borderColor: COLORS.green }]}>
            <FontAwesome5 name="check-circle" size={22} color={COLORS.green} />
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={s.statLabel}>DONE</Text>
              <Text style={s.statValue}>{doneBookings}</Text>
            </View>
          </View>
        </View> */}

        {/* ═══════ STATS ═══════ */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <FontAwesome5 name="clipboard-list" size={22} color={COLORS.navy} />
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={s.statLabel}>TOTAL</Text>
              <Text style={s.statValue}>{totalBookings}</Text>
            </View>
          </View>
          <View style={s.statCard}>
            <FontAwesome5 name="clock" size={22} color={COLORS.amber} />
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={s.statLabel}>PENDING</Text>
              <Text style={s.statValue}>{pendingBookings}</Text>
            </View>
          </View>
          <View style={[s.statCard, { borderColor: COLORS.green }]}>
            <FontAwesome5 name="check-circle" size={22} color={COLORS.green} />
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={s.statLabel}>DONE</Text>
              <Text style={s.statValue}>{doneBookings}</Text>
            </View>
          </View>
        </View>
        {/* ═══════ SUPPORT TICKET STATS ═══════ */}
        <View style={s.supportStatsRow}>
          <TouchableOpacity
            style={s.supportStatCard}
            onPress={() => router.push("/support" as any)}
            activeOpacity={0.8}
          >
            <View style={s.supportStatLeft}>
              <FontAwesome5 name="headset" size={20} color={COLORS.navy} />
              <View style={{ marginLeft: SPACING.sm }}>
                <Text style={s.supportStatLabel}>SUPPORT TICKETS</Text>
                <Text style={s.supportStatValue}>
                  {supportOpenCount > 0 ? (
                    <Text style={{ color: "#ef4444" }}>
                      {supportOpenCount} open
                    </Text>
                  ) : (
                    "No open tickets"
                  )}
                </Text>
              </View>
            </View>
            {supportOpenCount > 0 && (
              <View style={s.supportBadge}>
                <Text style={s.supportBadgeText}>
                  {supportOpenCount > 99 ? "99+" : supportOpenCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {/* ═══════ WALLET CARDS ═══════ */}
        {(() => {
          // Get all currencies with any activity
          const allCurrencies = new Set<string>();
          wallets.forEach((w: any) => {
            if (
              Number(w.available_balance) > 0 ||
              Number(w.pending_balance) > 0 ||
              Number(w.escrow_pending) > 0 ||
              Number(w.total_earned) > 0
            ) {
              allCurrencies.add(w.currency);
            }
          });

          // Also check for escrow payments from the walletData
          const escrowByCurrency = walletData?.escrow_by_currency || {};
          Object.keys(escrowByCurrency).forEach((cur) => {
            if (Number(escrowByCurrency[cur]) > 0) {
              allCurrencies.add(cur);
            }
          });

          // Get all wallets including those with only escrow
          const allWallets = Array.from(allCurrencies).map((cur) => {
            const existing = wallets.find((w: any) => w.currency === cur);
            const escrowAmount = Number(escrowByCurrency[cur] || 0);
            return {
              currency: cur,
              available_balance: existing?.available_balance || 0,
              pending_balance: existing?.pending_balance || 0,
              escrow_pending: Math.max(
                Number(existing?.escrow_pending || 0),
                escrowAmount,
              ),
              total_earned: existing?.total_earned || 0,
              // Count of bookings in escrow
              escrow_count: existing?.escrow_count || 0,
            };
          });

          return allWallets.length > 0 ? (
            allWallets.map((w: any) => {
              const available = Number(w.available_balance || 0);
              const pending = Number(w.pending_balance || 0);
              const escrowPending = Number(w.escrow_pending || 0);
              const totalEarned = Number(w.total_earned || 0);
              const escrowCount = Number(w.escrow_count || 0);
              const barWidth =
                totalEarned > 0 ? (available / totalEarned) * 100 : 0;
              const pendingBarWidth =
                totalEarned > 0 ? (pending / totalEarned) * 100 : 0;
              const escrowBarWidth =
                totalEarned > 0 ? (escrowPending / totalEarned) * 100 : 0;
              const cur = w.currency || "NGN";

              return (
                <TouchableOpacity
                  key={cur}
                  style={s.walletCard}
                  activeOpacity={0.85}
                  onPress={() => router.push("/(tabs)/wallet" as any)}
                >
                  {/* Currency badge */}
                  <View style={s.walletHeader}>
                    <View style={s.currencyBadge}>
                      <Text style={s.currencyBadgeText}>{cur}</Text>
                    </View>
                    {totalEarned > 0 && (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={s.walletEarnedLabel}>TOTAL EARNED</Text>
                        <Text style={s.walletEarnedValue}>
                          {fmt(totalEarned, cur)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Available amount */}
                  <Text style={s.walletAvailAmount}>{fmt(available, cur)}</Text>
                  <Text style={s.walletAvailLabel}>available</Text>

                  {/* Progress bar */}
                  {totalEarned > 0 && (
                    <View style={s.walletBarBg}>
                      <View
                        style={[
                          s.walletBarFill,
                          {
                            width: `${Math.min(100, barWidth)}%`,
                            backgroundColor: COLORS.green,
                          },
                        ]}
                      />
                      {pending > 0 && (
                        <View
                          style={[
                            s.walletBarFill,
                            {
                              width: `${Math.min(100 - barWidth, pendingBarWidth)}%`,
                              backgroundColor: "#f59e0b",
                              left: `${barWidth}%`,
                              position: "absolute",
                            },
                          ]}
                        />
                      )}
                      {escrowPending > 0 && (
                        <View
                          style={[
                            s.walletBarFill,
                            {
                              width: `${Math.min(100 - barWidth - pendingBarWidth, escrowBarWidth)}%`,
                              backgroundColor: "#ef4444",
                              left: `${barWidth + pendingBarWidth}%`,
                              position: "absolute",
                            },
                          ]}
                        />
                      )}
                    </View>
                  )}

                  {/* Badges with escrow count */}
                  <View style={s.walletBadgeRow}>
                    {available > 0 && (
                      <View style={s.walletBadge}>
                        <View
                          style={[
                            s.walletDot,
                            { backgroundColor: COLORS.green },
                          ]}
                        />
                        <Text style={s.walletBadgeText}>
                          {fmt(available, cur)} ready
                        </Text>
                      </View>
                    )}
                    {pending > 0 && (
                      <View style={s.walletBadge}>
                        <View
                          style={[s.walletDot, { backgroundColor: "#f59e0b" }]}
                        />
                        <Text style={s.walletBadgeText}>
                          {fmt(pending, cur)} releasing
                        </Text>
                      </View>
                    )}
                    {escrowPending > 0 && (
                      <View style={s.walletBadge}>
                        <View
                          style={[s.walletDot, { backgroundColor: "#ef4444" }]}
                        />
                        <Text style={s.walletBadgeText}>
                          {fmt(escrowPending, cur)} held in escrow
                          {escrowCount > 0 && (
                            <Text style={s.walletBadgeSubtext}>
                              {" "}
                              ({escrowCount} completed job
                              {escrowCount > 1 ? "s" : ""} awaiting customer
                              release)
                            </Text>
                          )}
                        </Text>
                      </View>
                    )}
                  </View>

                  {totalEarned === 0 && escrowPending === 0 && (
                    <Text style={s.walletEmptyText}>No earnings yet</Text>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity
              style={s.emptyWalletCard}
              activeOpacity={0.85}
              onPress={() => router.push("/(tabs)/wallet" as any)}
            >
              <View style={s.emptyWalletIconWrap}>
                <View style={s.emptyWalletIconBg}>
                  <FontAwesome5 name="wallet" size={28} color={COLORS.navy} />
                </View>
              </View>

              <View style={s.emptyWalletContent}>
                <Text style={s.emptyWalletTitle}>No Wallet Activity Yet</Text>
                <Text style={s.emptyWalletMessage}>
                  Complete your first booking and receive payment to start
                  building your earnings.
                </Text>
                <View style={s.emptyWalletFeatures}>
                  <View style={s.emptyWalletFeature}>
                    <FontAwesome5
                      name="check-circle"
                      size={14}
                      color={COLORS.green}
                    />
                    <Text style={s.emptyWalletFeatureText}>
                      Get paid for completed jobs
                    </Text>
                  </View>
                  <View style={s.emptyWalletFeature}>
                    <FontAwesome5
                      name="check-circle"
                      size={14}
                      color={COLORS.green}
                    />
                    <Text style={s.emptyWalletFeatureText}>
                      Track all your earnings
                    </Text>
                  </View>
                  <View style={s.emptyWalletFeature}>
                    <FontAwesome5
                      name="check-circle"
                      size={14}
                      color={COLORS.green}
                    />
                    <Text style={s.emptyWalletFeatureText}>
                      Withdraw when you're ready
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })()}
        {/* ═══════ BOOKINGS ═══════ */}
        <View style={s.bookingsSection}>
          <Text style={s.sectionTitle}>My Bookings</Text>

          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabScroll}
          >
            <View style={s.tabRow}>
              {BOOKING_TABS.map((tab) => {
                const isActive = bookingTab === tab;
                const count =
                  tab === "All"
                    ? allBookings.length
                    : allBookings.filter(
                        (b: any) => b.status === tabToStatus[tab],
                      ).length;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[s.tab, isActive && s.tabActive]}
                    onPress={() => setBookingTab(tab)}
                  >
                    <Text style={[s.tabText, isActive && s.tabTextActive]}>
                      {tab}
                      {count > 0 ? ` (${count})` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Booking list */}
          {filteredBookings.length === 0 ? (
            <View style={s.emptyState}>
              <FontAwesome5 name="inbox" size={48} color={COLORS.gray} />
              <Text style={s.emptyText}>
                No {bookingTab.toLowerCase()} bookings
              </Text>
            </View>
          ) : (
            filteredBookings.map((b: any) => {
              const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
              const isLoading = actionLoading === b.id;
              const cur = b.payment_currency || b.maid_currency || "NGN";

              return (
                <TouchableOpacity
                  key={b.id}
                  style={s.bookingCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/booking/${b.id}` as any)}
                >
                  {/* Top row: customer + status */}
                  <View style={s.bookingTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.bookingCustomer}>{b.customer_name}</Text>
                      <Text style={s.bookingDate}>
                        {new Date(b.service_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        at{" "}
                        {new Date(b.service_date).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusPillText, { color: cfg.color }]}>
                        {cfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Details row - with custom units support */}
                  <View style={s.bookingDetails}>
                    <Text style={s.detailText}>
                      Duration:{" "}
                      <Text style={s.detailBold}>
                        {b.rate_type === "custom" && b.duration_qty
                          ? `${Number(b.duration_qty).toLocaleString()} unit${Number(b.duration_qty) !== 1 ? "s" : ""}`
                          : `${Number(b.duration_hours).toLocaleString()} hour${b.duration_hours !== 1 ? "s" : ""}`}
                      </Text>
                    </Text>
                    <Text style={s.detailText}>
                      Earning:{" "}
                      <Text style={s.detailBold}>
                        {fmt(b.total_amount, cur)}
                      </Text>
                    </Text>
                    <Text style={s.detailText} numberOfLines={1}>
                      Address: <Text style={s.detailBold}>{b.address}</Text>
                    </Text>
                  </View>

                  {/* Show decline reason if booking was declined */}
                  {b.status === "declined" && b.notes && (
                    <View
                      style={[
                        s.notesBox,
                        {
                          backgroundColor: "#fef2f2",
                          marginBottom: SPACING.md,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.notesLabel,
                          { color: "#991b1b", fontFamily: FONTS.bold },
                        ]}
                      >
                        Decline Reason
                      </Text>
                      <Text style={[s.notesText, { color: "#991b1b" }]}>
                        {b.notes}
                      </Text>
                    </View>
                  )}

                  {/* Action buttons with spinners */}
                  <View style={s.actionRow}>
                    {b.status === "pending" && (
                      <>
                        <TouchableOpacity
                          style={[
                            s.actionBtn,
                            { backgroundColor: COLORS.green },
                          ]}
                          onPress={() =>
                            confirmAction(
                              b.id,
                              "confirmed",
                              "Accept Booking",
                              `Accept booking from ${b.customer_name}?`,
                            )
                          }
                          disabled={isLoading}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {isLoading ? (
                              <ButtonSpinner color="#fff" size="small" />
                            ) : (
                              <>
                                <FontAwesome5
                                  name="check"
                                  size={14}
                                  color="#fff"
                                />
                                <Text style={s.actionBtnText}>Accept</Text>
                              </>
                            )}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.actionBtn, { backgroundColor: "#ef4444" }]}
                          onPress={() => {
                            setDeclineBookingId(b.id);
                            setDeclineModal(true);
                          }}
                          disabled={isLoading}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {isLoading ? (
                              <ButtonSpinner color="#fff" size="small" />
                            ) : (
                              <>
                                <FontAwesome5
                                  name="times"
                                  size={14}
                                  color="#fff"
                                />
                                <Text style={s.actionBtnText}>Decline</Text>
                              </>
                            )}
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                    {b.status === "confirmed" && (
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: COLORS.navy }]}
                        onPress={() => initiateCheckin(b.id)}
                        disabled={isLoading}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {isLoading ? (
                            <ButtonSpinner color="#fff" size="small" />
                          ) : (
                            <>
                              <FontAwesome5
                                name="map-marker-alt"
                                size={14}
                                color="#fff"
                              />
                              <Text style={s.actionBtnText}>Check In</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                    {b.status === "in_progress" && (
                      <>
                        {!b.checkout_at && (
                          <TouchableOpacity
                            style={[
                              s.actionBtn,
                              { backgroundColor: COLORS.navy },
                            ]}
                            onPress={() => initiateCheckout(b.id)}
                            disabled={isLoading}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {isLoading ? (
                                <ButtonSpinner color="#fff" size="small" />
                              ) : (
                                <>
                                  <FontAwesome5
                                    name="map-marker-alt"
                                    size={14}
                                    color="#fff"
                                  />
                                  <Text style={s.actionBtnText}>Check Out</Text>
                                </>
                              )}
                            </View>
                          </TouchableOpacity>
                        )}
                        {!!b.checkout_at && (
                          <TouchableOpacity
                            style={[
                              s.actionBtn,
                              { backgroundColor: COLORS.green },
                            ]}
                            onPress={() =>
                              confirmAction(
                                b.id,
                                "completed",
                                "Mark Complete",
                                "Mark this job as completed?",
                              )
                            }
                            disabled={isLoading}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {isLoading ? (
                                <ButtonSpinner color="#fff" size="small" />
                              ) : (
                                <>
                                  <FontAwesome5
                                    name="check-double"
                                    size={14}
                                    color="#fff"
                                  />
                                  <Text style={s.actionBtnText}>
                                    Mark Complete
                                  </Text>
                                </>
                              )}
                            </View>
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    {/* Always show Chat + Support for active bookings */}
                    {["confirmed", "in_progress"].includes(b.status) && (
                      <>
                        <TouchableOpacity
                          style={[
                            s.actionBtn,
                            { backgroundColor: COLORS.navy },
                          ]}
                          onPress={() =>
                            router.push({
                              pathname: "/chat/[id]",
                              params: { id: b.id, type: "booking" },
                            } as any)
                          }
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <FontAwesome5
                              name="comment-dots"
                              size={14}
                              color="#fff"
                            />
                            <Text style={s.actionBtnText}>Chat</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            s.actionBtn,
                            {
                              backgroundColor: COLORS.muted,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                            },
                          ]}
                          onPress={() =>
                            router.push({
                              pathname: "/support/new",
                              params: {
                                booking_id: b.id,
                                subject: `Issue with booking #${b.id.slice(0, 8).toUpperCase()}`,
                                category: "booking_issue",
                                related_to: `Booking with ${b.customer_name} on ${new Date(b.service_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
                                prefill: "1",
                              },
                            } as any)
                          }
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <FontAwesome5
                              name="life-ring"
                              size={14}
                              color={COLORS.navy}
                            />
                            <Text
                              style={[s.actionBtnText, { color: COLORS.navy }]}
                            >
                              Support
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══════ DECLINE REASON MODAL ═══════ */}
      <Modal
        visible={declineModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDeclineModal(false);
          setDeclineReason("");
        }}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Why are you declining?</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Optional reason (e.g., schedule conflict, too far away)"
              placeholderTextColor={COLORS.grayLight}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              maxLength={200}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => {
                  setDeclineModal(false);
                  setDeclineReason("");
                }}
                disabled={declineLoading}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirm}
                onPress={handleDecline}
                disabled={declineLoading}
              >
                <Text style={s.modalConfirmText}>
                  {declineLoading ? "Declining…" : "Decline"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════ CHECKOUT LOCATION MODAL ═══════ */}
      <Modal
        visible={checkoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCheckoutModal(false);
          setCheckoutBookingId(null);
          setCheckoutLat(null);
          setCheckoutLng(null);
        }}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>📍 Checkout Location</Text>
            {checkoutLat && checkoutLng ? (
              <>
                <Text style={s.modalText}>
                  Location captured at{" "}
                  {new Date().toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <View style={s.coordsBox}>
                  <Text style={s.coordsLabel}>Coordinates</Text>
                  <Text style={s.coordsValue}>
                    {Number(checkoutLat).toFixed(5)},{" "}
                    {Number(checkoutLng).toFixed(5)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.mapButton}
                  onPress={() => openInGoogleMaps(checkoutLat, checkoutLng)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <FontAwesome5
                      name="map-marked-alt"
                      size={16}
                      color="#fff"
                    />
                    <Text style={s.mapButtonText}>View on Google Maps</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={s.modalText}>
                Location could not be captured. Proceeding without GPS.
              </Text>
            )}
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => {
                  setCheckoutModal(false);
                  setCheckoutBookingId(null);
                  setCheckoutLat(null);
                  setCheckoutLng(null);
                }}
                disabled={checkoutLoading}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirm}
                onPress={handleCheckout}
                disabled={checkoutLoading}
              >
                <Text style={s.modalConfirmText}>
                  {checkoutLoading ? "Checking out…" : "Confirm Checkout"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════ CHECKIN LOCATION MODAL ═══════ */}
      <Modal
        visible={checkinModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCheckinModal(false);
          setCheckinBookingId(null);
          setCheckinLat(null);
          setCheckinLng(null);
        }}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>📍 Checkin Location</Text>
            {checkinLat && checkinLng ? (
              <>
                <Text style={s.modalText}>
                  Location captured at{" "}
                  {new Date().toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <View style={s.coordsBox}>
                  <Text style={s.coordsLabel}>Coordinates</Text>
                  <Text style={s.coordsValue}>
                    {Number(checkinLat).toFixed(5)},{" "}
                    {Number(checkinLng).toFixed(5)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.mapButton}
                  onPress={() => openInGoogleMaps(checkinLat, checkinLng)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <FontAwesome5
                      name="map-marked-alt"
                      size={16}
                      color="#fff"
                    />
                    <Text style={s.mapButtonText}>View on Google Maps</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={s.modalText}>
                Location could not be captured. Proceeding without GPS.
              </Text>
            )}
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => {
                  setCheckinModal(false);
                  setCheckinBookingId(null);
                  setCheckinLat(null);
                  setCheckinLng(null);
                }}
                disabled={checkinLoading}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirm}
                onPress={handleCheckin}
                disabled={checkinLoading}
              >
                <Text style={s.modalConfirmText}>
                  {checkinLoading ? "Checking in…" : "Confirm Checkin"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FloatingSupportButton onPress={() => router.push("/support/chat")} />
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
    justifyContent: "space-between",
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.muted,
  },
  headerAvatarFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerInit: { fontFamily: FONTS.bold, fontSize: 16, color: "#fff" },
  headerName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#fff",
    maxWidth: 140,
  },
  headerRole: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  headerIcon: { position: "relative", padding: 4 },
  iconBadge: {
    position: "absolute",
    top: -2,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  iconBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  logoutBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  logoutBtnText: { fontFamily: FONTS.bold, fontSize: 12, color: "#fff" },

  // Availability
  availSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  availTitle: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.navy },
  availSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  statEmoji: { fontSize: 22 },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 0.5,
  },
  statValue: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.navy },

  // Wallet cards
  walletCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  currencyBadge: {
    backgroundColor: COLORS.muted,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  currencyBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.navy,
  },
  walletEarnedLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 0.5,
  },
  walletEarnedValue: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.navy,
    marginTop: 2,
  },
  walletAvailAmount: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: COLORS.navy,
  },
  walletAvailLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.sm,
  },
  walletBarBg: {
    height: 6,
    backgroundColor: COLORS.muted,
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
    marginBottom: SPACING.sm,
  },
  walletBarFill: { height: 6, borderRadius: 3 },
  walletBadgeRow: { flexDirection: "row", gap: SPACING.md, flexWrap: "wrap" },
  walletBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  walletDot: { width: 8, height: 8, borderRadius: 4 },
  walletBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.navy,
  },

  // Bookings section
  bookingsSection: { paddingHorizontal: SPACING.md, marginTop: SPACING.sm },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },

  tabScroll: { marginBottom: SPACING.md },
  tabRow: { flexDirection: "row", gap: SPACING.xs },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tabText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.gray },
  tabTextActive: { color: "#fff" },

  // Booking card
  bookingCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bookingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  bookingCustomer: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.navy },
  bookingDate: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    textTransform: "capitalize",
  },

  bookingDetails: { marginBottom: SPACING.md },
  detailText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
  },
  detailBold: { fontFamily: FONTS.bold, color: COLORS.navy },

  notesBox: {
    backgroundColor: COLORS.cream,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  notesLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.navy,
    marginBottom: 4,
  },
  notesText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
  },

  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  actionBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: "#fff" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  emptyText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.gray },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: SPACING.sm,
  },
  modalText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 70,
    textAlignVertical: "top",
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  coordsBox: {
    backgroundColor: COLORS.cream,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  coordsLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 4,
  },
  coordsValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.navy,
  },
  mapButton: {
    backgroundColor: COLORS.navy,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  mapButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: "#fff",
  },
  modalActions: { flexDirection: "row", gap: SPACING.sm },
  modalCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.muted,
    alignItems: "center",
  },
  modalCancelText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.gray },
  modalConfirm: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.navy,
    alignItems: "center",
  },
  walletEmptyText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.grayLight,
    textAlign: "center",
    marginTop: SPACING.sm,
  },

  // Add these styles to the StyleSheet (around line 900+):

  // ── Empty Wallet Card ──────────────────────────────────────────────
  emptyWalletCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    overflow: "hidden",
    position: "relative",
  },
  emptyWalletIconWrap: {
    position: "relative",
  },
  emptyWalletIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(26, 35, 53, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWalletContent: {
    flex: 1,
    gap: 6,
  },
  emptyWalletTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.navy,
    marginBottom: 2,
  },
  emptyWalletMessage: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
    marginBottom: 6,
  },
  emptyWalletFeatures: {
    gap: 4,
    marginTop: 4,
  },
  emptyWalletFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyWalletFeatureText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.gray,
  },
  // Add these styles after the statsRow styles (around line 830)

  // ── Support Stats ──────────────────────────────────────────────────────
  supportStatsRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  supportStatCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  supportStatLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  supportStatLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 0.5,
  },
  supportStatValue: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginTop: 2,
  },
  supportBadge: {
    backgroundColor: "#ef4444",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  supportBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: "#fff",
  },
  badgeLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.gray },
  modalConfirmText: { fontFamily: FONTS.bold, fontSize: 13, color: "#fff" },
});
