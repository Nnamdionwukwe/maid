import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS, fmt } from "../../constants";
import { useAppToast } from "../../components/AppToast";
import { FontAwesome5 } from "@expo/vector-icons";

// ── Button Spinner Component ──────────────────────────────────────────
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

// ── Open Google Maps with coordinates ─────────────────────────────────
function openInGoogleMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`),
  );
}

function fmtCoords(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
) {
  if (lat == null || lng == null) return "";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

// ── Format duration: hours, days, weeks, months ────────────────────────
function formatDuration(
  hours: number | null | undefined,
  rateType?: string | null,
  durationQty?: number | null,
): string {
  if (!hours || hours <= 0) return "N/A";

  // Check if custom units are used
  if (rateType === "custom" && durationQty) {
    return `${Number(durationQty).toLocaleString()} unit${
      Number(durationQty) !== 1 ? "s" : ""
    }`;
  }

  // For standard bookings, just show hours with comma separators
  return `${Number(hours).toLocaleString()} hour${hours !== 1 ? "s" : ""}`;
}

// ── Currency formatting ────────────────────────────────────────────────
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    // African Currencies (Flutterwave supported)
    NGN: "₦",
    GHS: "₵",
    KES: "KSh",
    ZAR: "R",
    UGX: "USh",
    TZS: "TSh",
    RWF: "FRw",
    XOF: "CFA",

    // Major World Currencies (Flutterwave supported)
    USD: "$",
    GBP: "£",
    EUR: "€",
    CAD: "CA$",
    AUD: "A$",

    // European Currencies (Flutterwave supported)
    CHF: "CHF",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
  };
  return symbols[currency?.toUpperCase()] || currency || "₦";
}

// ── Status config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string; icon: string }
> = {
  pending: { color: "#f59e0b", bg: "#fffbeb", label: "Pending", icon: "clock" },
  confirmed: {
    color: "#3b82f6",
    bg: "#eff6ff",
    label: "Confirmed",
    icon: "check-circle",
  },
  in_progress: {
    color: "#8b5cf6",
    bg: "#f5f3ff",
    label: "In Progress",
    icon: "sync-alt",
  },
  completed: {
    color: "#10b981",
    bg: "#ecfdf5",
    label: "Completed",
    icon: "trophy",
  },
  cancelled: {
    color: "#ef4444",
    bg: "#fef2f2",
    label: "Cancelled",
    icon: "ban",
  },
  declined: {
    color: "#6b7280",
    bg: "#f3f4f6",
    label: "Declined",
    icon: "times-circle",
  },
  awaiting_payment: {
    color: "#f59e0b",
    bg: "#fffbeb",
    label: "Awaiting Payment",
    icon: "credit-card",
  },
};

export default function MaidBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuthStore();
  const { toast, confirm } = useAppToast();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sosModal, setSosModal] = useState(false);
  const [sosMessage, setSosMessage] = useState("");
  const [sosLoading, setSosLoading] = useState(false);
  const [liveLocationLoading, setLiveLocationLoading] = useState(false);
  const [callLoading, setCallLoading] = useState(false);
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineLoading, setDeclineLoading] = useState(false);

  const trackingInterval = useRef<any>(null);
  const locationUpdateInterval = useRef<any>(null);

  // ── Queries ─────────────────────────────────────────────────────
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["maid-booking", id],
    queryFn: () => apiFetch(`/api/bookings/${id}`, token!),
    enabled: !!token && !!id,
  });

  const { data: locData, refetch: refetchLoc } = useQuery({
    queryKey: ["booking-location", id],
    queryFn: () => apiFetch(`/api/bookings/${id}/location`, token!),
    enabled: !!token && !!id,
    refetchInterval: 15000,
  });

  const booking = data?.booking;
  const review = data?.review;
  const emergencyContacts = data?.emergency_contacts || [];
  const activeSOS = data?.active_sos || [];
  const latestLocation = data?.latest_location;
  const cfg = booking
    ? STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending
    : STATUS_CONFIG.pending;

  // ── Check if payment is in escrow from booking data ──
  // The backend sets escrow_status = 'pending_release' when booking is completed
  const isInEscrow = booking?.escrow_status === "pending_release";
  const escrowAmount = booking?.total_amount || 0;
  const escrowCurrency =
    booking?.payment_currency || booking?.maid_currency || "NGN";

  // ── DYNAMIC CURRENCY ────────────────────────────────────────────
  const currency =
    booking?.payment_currency ||
    booking?.currency ||
    booking?.maid_currency ||
    data?.payment?.currency ||
    "NGN";

  const currencySymbol = getCurrencySymbol(currency);

  const hasCheckedOut = !!booking?.checkout_at;

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchLoc();
    }, []),
  );

  // ── Live tracking — pings while in_progress AND not checked out ──
  useEffect(() => {
    if (
      booking?.status === "in_progress" &&
      booking?.live_tracking_on &&
      !hasCheckedOut
    ) {
      startLiveTracking();
    } else {
      stopLiveTracking();
    }
    return () => stopLiveTracking();
  }, [booking?.status, booking?.live_tracking_on, hasCheckedOut]);

  // ── Live location updates at checkout ───────────────────────────
  useEffect(() => {
    if (hasCheckedOut && booking?.status === "in_progress") {
      startLiveLocationAtCheckout();
    } else {
      stopLiveLocationAtCheckout();
    }
    return () => stopLiveLocationAtCheckout();
  }, [hasCheckedOut, booking?.status]);

  function stopLiveTracking() {
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
  }

  function stopLiveLocationAtCheckout() {
    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current);
      locationUpdateInterval.current = null;
    }
  }

  async function startLiveTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const sendPing = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          await apiPost(`/api/bookings/${id}/location`, token!, {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
          });
        } catch {}
      };
      sendPing();
      trackingInterval.current = setInterval(sendPing, 60000);
    } catch {}
  }

  async function startLiveLocationAtCheckout() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const updateLocation = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          await apiPatch(`/api/bookings/${id}`, token!, {
            checkout_lat: loc.coords.latitude,
            checkout_lng: loc.coords.longitude,
          });
          refetchLoc();
        } catch {}
      };

      updateLocation();
      locationUpdateInterval.current = setInterval(updateLocation, 30000);
    } catch {}
  }

  async function getGPS(): Promise<{ lat: number; lng: number } | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast({
          type: "warning",
          title: "Location denied",
          message: "We'll proceed without GPS.",
        });
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      return null;
    }
  }

  async function handleAction(action: string) {
    setActionLoading(action);
    try {
      let res;
      if (action === "checkin") {
        const gps = await getGPS();
        res = await apiPost(`/api/bookings/${id}/checkin`, token!, gps || {});
      } else if (action === "checkout") {
        const gps = await getGPS();
        res = await apiPost(`/api/bookings/${id}/checkout`, token!, {
          lat: gps?.lat,
          lng: gps?.lng,
          checkout_lat: gps?.lat,
          checkout_lng: gps?.lng,
        });
      } else {
        res = await apiPatch(`/api/bookings/${id}/status`, token!, {
          status: action,
        });
      }
      if (res.error) throw new Error(res.error);
      toast({
        type: "success",
        title:
          action === "checkin"
            ? "Checked in!"
            : action === "checkout"
              ? "Checked out — location registered!"
              : action === "confirmed"
                ? "Booking accepted!"
                : action === "declined"
                  ? "Booking declined"
                  : action === "completed"
                    ? "Job marked complete!"
                    : "Updated",
      });
      refetch();
      refetchLoc();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setActionLoading(null);
    }
  }

  function confirmAction(
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
      onConfirm: () => handleAction(action),
    });
  }

  async function triggerSOS() {
    setSosLoading(true);
    try {
      const gps = await getGPS();
      const res = await apiPost(`/api/bookings/${id}/sos`, token!, {
        ...gps,
        address: booking?.address,
        message: sosMessage || "Emergency triggered by maid",
      });
      if (res.error) throw new Error(res.error);
      toast({
        type: "success",
        title: "🚨 SOS Sent",
        message: "Admin and emergency contacts notified.",
        duration: 6000,
      });
      setSosModal(false);
      setSosMessage("");
      refetch();
    } catch (err: any) {
      toast({ type: "error", title: "SOS Failed", message: err.message });
    } finally {
      setSosLoading(false);
    }
  }

  async function handleDecline() {
    setDeclineLoading(true);
    try {
      const res = await apiPatch(`/api/bookings/${id}/status`, token!, {
        status: "declined",
        declined_reason: declineReason.trim() || "No reason provided",
      });
      if (res.error) throw new Error(res.error);
      toast({ type: "success", title: "Booking declined" });
      setDeclineModal(false);
      setDeclineReason("");
      refetch();
    } catch (err: any) {
      toast({ type: "error", title: "Failed", message: err.message });
    } finally {
      setDeclineLoading(false);
    }
  }

  // ── Initiate video call ─────────────────────
  async function handleVideoCall() {
    setCallLoading(true);
    try {
      const res = await apiPost(`/api/bookings/${id}/video-call`, token!, {});
      if (res.error) throw new Error(res.error);
      const channel = res.channel;
      if (!channel) throw new Error("No call channel returned");

      // Build the website URL - same as customer but with role=maid
      const websiteUrl = `https://deusizisparkle.com/video-call?bookingId=${id}&channel=${encodeURIComponent(channel)}&token=${encodeURIComponent(res.token)}&appId=${encodeURIComponent(res.app_id)}&otherName=${encodeURIComponent(booking?.customer_name || "Customer")}&role=maid`;

      console.log("📹 [Maid] Opening video call URL:", websiteUrl);

      // Open the website in the browser
      await Linking.openURL(websiteUrl);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Video call failed",
        message: err.message,
      });
    } finally {
      setCallLoading(false);
    }
  }

  // ── Open support prefilled with booking context ──────────────────
  function openSupport() {
    router.push({
      pathname: "/support/new",
      params: {
        booking_id: booking.id,
        subject: `Issue with booking #${booking.id.slice(0, 8).toUpperCase()}`,
        category: "booking_issue",
        related_to: `Booking with ${booking.customer_name} on ${new Date(booking.service_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
        prefill: "1",
      },
    } as any);
  }

  if (isLoading || !booking) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={s.loadingText}>Loading booking…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <View style={s.backBtnRow}>
            <FontAwesome5 name="arrow-left" size={16} color={COLORS.navy} />
            <Text style={s.backText}> Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Booking Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              refetch();
              refetchLoc();
            }}
            tintColor={COLORS.navy}
          />
        }
      >
        {/* Status card */}
        <View
          style={[
            s.statusCard,
            { backgroundColor: cfg.bg, borderColor: cfg.color },
          ]}
        >
          <FontAwesome5 name={cfg.icon} size={32} color={cfg.color} />
          <View style={{ flex: 1 }}>
            <Text style={[s.statusLabel, { color: cfg.color }]}>
              {cfg.label}
            </Text>
            <Text style={s.bookingId}>
              #{booking.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View style={[s.amountPill, { backgroundColor: cfg.color }]}>
            <Text style={s.amountPillText}>
              {currencySymbol}
              {Number(booking.total_amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        {/* ── ESCROW INDICATOR FOR COMPLETED JOBS ── */}
        {booking.status === "completed" && isInEscrow && (
          <View style={s.escrowCard}>
            <View style={s.escrowHeader}>
              <FontAwesome5 name="clock" size={20} color="#ef4444" />
              <Text style={s.escrowTitle}>Payment in Escrow</Text>
            </View>
            <Text style={s.escrowAmount}>
              {getCurrencySymbol(escrowCurrency)}
              {Number(escrowAmount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text style={s.escrowSub}>
              This payment is held in escrow and awaiting customer release. Once
              the customer confirms satisfaction, the funds will be released to
              your wallet.
            </Text>
            <View style={s.escrowBadge}>
              <FontAwesome5 name="hourglass-half" size={14} color="#ef4444" />
              <Text style={s.escrowBadgeText}>Awaiting customer release</Text>
            </View>
          </View>
        )}

        {/* Active SOS warning */}
        {activeSOS.length > 0 && (
          <View style={s.sosWarning}>
            <FontAwesome5
              name="exclamation-triangle"
              size={28}
              color="#991b1b"
            />
            <View style={{ flex: 1 }}>
              <Text style={s.sosWarningTitle}>Active SOS Alert</Text>
              <Text style={s.sosWarningText}>
                Triggered by {activeSOS[0].triggered_by_name}. Admin has been
                notified.
              </Text>
            </View>
          </View>
        )}

        {/* Customer */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Customer</Text>
          <View style={s.customerRow}>
            {booking.customer_avatar ? (
              <Image
                source={{ uri: booking.customer_avatar }}
                style={s.avatar}
              />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarInit}>
                  {booking.customer_name?.[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.customerName}>{booking.customer_name}</Text>
              {booking.customer_phone && (
                <Text style={s.customerSub}>{booking.customer_phone}</Text>
              )}
            </View>
            {booking.customer_phone &&
              ["confirmed", "in_progress"].includes(booking.status) && (
                <View style={s.contactBtnGroup}>
                  <TouchableOpacity
                    style={s.callBtn}
                    onPress={() =>
                      Linking.openURL(`tel:${booking.customer_phone}`)
                    }
                  >
                    <FontAwesome5 name="phone" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.callBtn, { backgroundColor: COLORS.navy }]}
                    onPress={handleVideoCall}
                    disabled={callLoading}
                  >
                    {callLoading ? (
                      <ButtonSpinner color="#fff" size="small" />
                    ) : (
                      <FontAwesome5 name="video" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
          </View>
        </View>

        {/* Job details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Job Details</Text>
          <View style={s.detailRow}>
            <View style={s.detailLabelRow}>
              <FontAwesome5 name="calendar-alt" size={14} color={COLORS.gray} />
              <Text style={s.detailLabel}> Date & Time</Text>
            </View>
            <Text style={s.detailValue}>
              {new Date(booking.service_date).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          <View style={s.detailRow}>
            <View style={s.detailLabelRow}>
              <FontAwesome5 name="clock" size={14} color={COLORS.gray} />
              <Text style={s.detailLabel}> Duration</Text>
            </View>
            <Text style={s.detailValue}>
              {formatDuration(
                booking.duration_hours,
                booking.rate_type,
                booking.duration_qty,
              )}
            </Text>
          </View>
          {/* Earning - with comma separators */}
          <View style={s.detailRow}>
            <View style={s.detailLabelRow}>
              <FontAwesome5
                name="money-bill-wave"
                size={14}
                color={COLORS.gray}
              />
              <Text style={s.detailLabel}> Earning</Text>
            </View>
            <Text
              style={[
                s.detailValue,
                { color: COLORS.green, fontFamily: FONTS.bold },
              ]}
            >
              {currencySymbol}
              {Number(booking.total_amount).toLocaleString()}{" "}
              <Text style={{ fontSize: 12, color: COLORS.gray }}>
                ({currency})
              </Text>
            </Text>
          </View>
          <View style={s.detailRow}>
            <View style={s.detailLabelRow}>
              <FontAwesome5
                name="map-marker-alt"
                size={14}
                color={COLORS.gray}
              />
              <Text style={s.detailLabel}> Address</Text>
            </View>
            <Text style={s.detailValue}>{booking.address}</Text>
          </View>
          {booking.notes && (
            <View style={s.notesBox}>
              <View style={s.detailLabelRow}>
                <FontAwesome5 name="pen" size={14} color={COLORS.navy} />
                <Text style={s.notesLabel}> Notes</Text>
              </View>
              <Text style={s.notesText}>{booking.notes}</Text>
            </View>
          )}
        </View>

        {/* ═══════ ACTIVITY TIMELINE WITH MAP LINKS ═══════ */}
        {(booking.checkin_at || booking.checkout_at) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Activity</Text>

            {/* Check-in */}
            {booking.checkin_at && (
              <View style={s.timelineCard}>
                <View style={s.timelineRow}>
                  <View
                    style={[s.timelineDot, { backgroundColor: COLORS.green }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.timelineLabel}>Checked In</Text>
                    <Text style={s.timelineTime}>
                      {new Date(booking.checkin_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
                {booking.checkin_lat && booking.checkin_lng && (
                  <View style={s.locDetail}>
                    <View style={s.coordsRow}>
                      <FontAwesome5
                        name="map-marker-alt"
                        size={12}
                        color={COLORS.gray}
                      />
                      <Text style={s.coordsText}>
                        {" "}
                        {fmtCoords(booking.checkin_lat, booking.checkin_lng)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.mapBtn}
                      onPress={() =>
                        openInGoogleMaps(
                          Number(booking.checkin_lat),
                          Number(booking.checkin_lng),
                        )
                      }
                    >
                      <View style={s.mapBtnRow}>
                        <FontAwesome5 name="map" size={12} color="#fff" />
                        <Text style={s.mapBtnText}> View on Google Maps</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Check-out */}
            {booking.checkout_at && (
              <View style={s.timelineCard}>
                <View style={s.timelineRow}>
                  <View
                    style={[s.timelineDot, { backgroundColor: COLORS.navy }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.timelineLabel}>Checked Out</Text>
                    <Text style={s.timelineTime}>
                      {new Date(booking.checkout_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>

                {booking.checkout_lat && booking.checkout_lng && (
                  <View style={s.locDetail}>
                    <View style={s.coordsRow}>
                      <FontAwesome5
                        name="map-marker-alt"
                        size={12}
                        color={COLORS.gray}
                      />
                      <Text style={s.coordsText}>
                        {" "}
                        {fmtCoords(booking.checkout_lat, booking.checkout_lng)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.mapBtn}
                      onPress={() =>
                        openInGoogleMaps(
                          Number(booking.checkout_lat),
                          Number(booking.checkout_lng),
                        )
                      }
                    >
                      <View style={s.mapBtnRow}>
                        <FontAwesome5 name="map" size={12} color="#fff" />
                        <Text style={s.mapBtnText}> View on Google Maps</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ═══════ LIVE TRACKING WITH MAP LINK ═══════ */}
        {booking.live_tracking_on &&
          booking.status === "in_progress" &&
          !hasCheckedOut && (
            <View style={[s.section, s.trackingBox]}>
              <View style={s.trackingHeader}>
                <View style={s.pulseDot} />
                <Text style={s.trackingTitle}>Live Tracking Active</Text>
              </View>
              <Text style={s.trackingSub}>
                Your location is being shared with the customer every minute.
              </Text>
              {locData?.location && (
                <>
                  <Text style={s.locationText}>
                    Last ping:{" "}
                    {new Date(
                      locData.location.recorded_at,
                    ).toLocaleTimeString()}
                  </Text>
                  <View style={s.coordsRow}>
                    <FontAwesome5
                      name="map-marker-alt"
                      size={12}
                      color="#065f46"
                    />
                    <Text style={s.coordsTextLight}>
                      {" "}
                      {fmtCoords(locData.location.lat, locData.location.lng)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.mapBtnGreen}
                    onPress={() =>
                      openInGoogleMaps(
                        Number(locData.location.lat),
                        Number(locData.location.lng),
                      )
                    }
                  >
                    <View style={s.mapBtnRow}>
                      <FontAwesome5 name="map" size={12} color="#fff" />
                      <Text style={s.mapBtnText}>
                        {" "}
                        View Live Location on Google Maps
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

        {/* ═══════ LIVE LOCATION AT CHECKOUT ═══════ */}
        {hasCheckedOut &&
          booking.status === "in_progress" &&
          (booking.checkout_lat || latestLocation?.lat) && (
            <View style={[s.section, s.trackingBox]}>
              <View style={s.trackingHeader}>
                <View style={s.pulseDot} />
                <Text style={s.trackingTitle}>
                  Live Location (After Checkout)
                </Text>
              </View>
              <Text style={s.trackingSub}>
                Your location continues to be shared with the customer.
              </Text>
              {(booking.checkout_lat || latestLocation?.lat) && (
                <>
                  <Text style={s.locationText}>
                    Last location: {new Date().toLocaleTimeString()}
                  </Text>
                  <View style={s.coordsRow}>
                    <FontAwesome5
                      name="map-marker-alt"
                      size={12}
                      color="#065f46"
                    />
                    <Text style={s.coordsTextLight}>
                      {" "}
                      {fmtCoords(
                        booking.checkout_lat || latestLocation?.lat,
                        booking.checkout_lng || latestLocation?.lng,
                      )}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.mapBtnGreen}
                    onPress={() =>
                      openInGoogleMaps(
                        Number(booking.checkout_lat || latestLocation?.lat),
                        Number(booking.checkout_lng || latestLocation?.lng),
                      )
                    }
                  >
                    <View style={s.mapBtnRow}>
                      <FontAwesome5 name="map" size={12} color="#fff" />
                      <Text style={s.mapBtnText}>
                        {" "}
                        View Current Location on Google Maps
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

        {/* Customer's emergency contacts */}
        {emergencyContacts.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <FontAwesome5
                name="exclamation-circle"
                size={16}
                color="#ef4444"
              />
              <Text style={s.sectionTitle}> Customer's Emergency Contacts</Text>
            </View>
            <Text style={s.sectionSub}>
              For your safety, these are visible during active jobs.
            </Text>
            {emergencyContacts.map((c: any, i: number) => (
              <View key={i} style={s.emergencyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.emergencyName}>{c.name}</Text>
                  <Text style={s.emergencyRel}>{c.relationship}</Text>
                  {c.email && (
                    <View style={s.emergencyEmailRow}>
                      <FontAwesome5
                        name="envelope"
                        size={12}
                        color={COLORS.navy}
                      />
                      <Text style={s.emergencyEmail}> {c.email}</Text>
                    </View>
                  )}
                </View>
                <View style={s.emergencyContactBtns}>
                  {c.phone && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${c.phone}`)}
                      style={s.emergencyPhoneBtn}
                    >
                      <FontAwesome5 name="phone" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {c.email && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`mailto:${c.email}`)}
                      style={s.emergencyEmailBtn}
                    >
                      <FontAwesome5 name="envelope" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Review */}
        {review && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Customer Review</Text>
            <View style={s.reviewBox}>
              <View style={s.reviewStars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <FontAwesome5
                    key={n}
                    name="star"
                    size={18}
                    color={n <= review.rating ? "#fbbf24" : COLORS.border}
                  />
                ))}
                <Text style={s.reviewRating}>{review.rating}.0</Text>
              </View>
              {review.comment && (
                <Text style={s.reviewComment}>"{review.comment}"</Text>
              )}
              <Text style={s.reviewDate}>
                {new Date(review.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>
        )}

        {/* ═══════ ACTIONS ═══════ */}
        <View style={s.actionsContainer}>
          {/* Pending → Accept / Decline */}
          {booking.status === "pending" && (
            <>
              <TouchableOpacity
                style={[s.bigBtn, { backgroundColor: COLORS.green }]}
                onPress={() =>
                  confirmAction(
                    "confirmed",
                    "Accept Booking",
                    `Accept booking from ${booking.customer_name}?`,
                  )
                }
                disabled={!!actionLoading}
              >
                <View style={s.bigBtnRow}>
                  {actionLoading === "confirmed" ? (
                    <ButtonSpinner color="#fff" size="small" />
                  ) : (
                    <>
                      <FontAwesome5 name="check" size={16} color="#fff" />
                      <Text style={s.bigBtnText}> Accept Booking</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bigBtn, { backgroundColor: "#ef4444" }]}
                onPress={() => setDeclineModal(true)}
                disabled={!!actionLoading}
              >
                <View style={s.bigBtnRow}>
                  {actionLoading === "declined" ? (
                    <ButtonSpinner color="#fff" size="small" />
                  ) : (
                    <>
                      <FontAwesome5 name="times" size={16} color="#fff" />
                      <Text style={s.bigBtnText}> Decline Booking</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Confirmed → Check In */}
          {booking.status === "confirmed" && (
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: COLORS.navy }]}
              onPress={() => handleAction("checkin")}
              disabled={!!actionLoading}
            >
              <View style={s.bigBtnRow}>
                {actionLoading === "checkin" ? (
                  <ButtonSpinner color="#fff" size="small" />
                ) : (
                  <>
                    <FontAwesome5
                      name="map-marker-alt"
                      size={16}
                      color="#fff"
                    />
                    <Text style={s.bigBtnText}> Check In & Start Job</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* In Progress, NOT checked out → Check Out only */}
          {booking.status === "in_progress" && !hasCheckedOut && (
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: COLORS.navy }]}
              onPress={() => handleAction("checkout")}
              disabled={!!actionLoading}
            >
              <View style={s.bigBtnRow}>
                {actionLoading === "checkout" ? (
                  <ButtonSpinner color="#fff" size="small" />
                ) : (
                  <>
                    <FontAwesome5
                      name="map-marker-alt"
                      size={16}
                      color="#fff"
                    />
                    <Text style={s.bigBtnText}> Check Out</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* In Progress, AFTER checkout → Mark Complete only */}
          {booking.status === "in_progress" && hasCheckedOut && (
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: COLORS.green }]}
              onPress={() =>
                confirmAction(
                  "completed",
                  "Mark Complete",
                  "Mark this job as completed? Customer will be asked to leave a review.",
                )
              }
              disabled={!!actionLoading}
            >
              <View style={s.bigBtnRow}>
                {actionLoading === "completed" ? (
                  <ButtonSpinner color="#fff" size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="check-double" size={16} color="#fff" />
                    <Text style={s.bigBtnText}> Mark Job Complete</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Always show during active job */}
          {["confirmed", "in_progress"].includes(booking.status) && (
            <>
              <TouchableOpacity
                style={[s.bigBtn, { backgroundColor: COLORS.navy }]}
                onPress={() =>
                  router.push({
                    pathname: "/chat/[id]",
                    params: { id: booking.id, type: "booking" },
                  } as any)
                }
              >
                <View style={s.bigBtnRow}>
                  <FontAwesome5 name="comment-dots" size={16} color="#fff" />
                  <Text style={s.bigBtnText}> Chat Customer</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.bigBtn, s.sosBtn]}
                onPress={() => setSosModal(true)}
              >
                <View style={s.bigBtnRow}>
                  <FontAwesome5
                    name="exclamation-triangle"
                    size={16}
                    color="#fff"
                  />
                  <Text style={s.bigBtnText}> Emergency SOS</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[
              s.bigBtn,
              {
                backgroundColor: COLORS.muted,
                borderWidth: 1,
                borderColor: COLORS.border,
              },
            ]}
            onPress={openSupport}
          >
            <View style={s.bigBtnRow}>
              <FontAwesome5 name="life-ring" size={16} color={COLORS.navy} />
              <Text style={[s.bigBtnText, { color: COLORS.navy }]}>
                {" "}
                Get Support
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* SOS Modal */}
      <Modal
        visible={sosModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSosModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTitleRow}>
              <FontAwesome5
                name="exclamation-triangle"
                size={24}
                color="#dc2626"
              />
              <Text style={s.modalTitle}> Emergency SOS</Text>
            </View>
            <Text style={s.modalText}>
              This will alert admin and notify both your and the customer's
              emergency contacts immediately. Only use in genuine emergencies.
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder="What's happening? (optional)"
              placeholderTextColor={COLORS.grayLight}
              value={sosMessage}
              onChangeText={setSosMessage}
              multiline
              maxLength={300}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => setSosModal(false)}
                disabled={sosLoading}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirm}
                onPress={triggerSOS}
                disabled={sosLoading}
              >
                <Text style={s.modalConfirmText}>
                  {sosLoading ? "Sending…" : "Send SOS"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Decline Reason Modal */}
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
            <View style={s.modalTitleRow}>
              <FontAwesome5 name="times-circle" size={24} color="#dc2626" />
              <Text style={s.modalTitle}> Decline Booking</Text>
            </View>
            <Text style={s.modalText}>
              Please provide a reason for declining. The customer will be
              notified.
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Schedule conflict, too far away, fully booked…"
              placeholderTextColor={COLORS.grayLight}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              maxLength={300}
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
                style={[s.modalConfirm, { backgroundColor: "#ef4444" }]}
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
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    marginTop: SPACING.sm,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { paddingVertical: 4 },
  backBtnRow: { flexDirection: "row", alignItems: "center" },
  backText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.navy },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.navy },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
  },
  statusLabel: { fontFamily: FONTS.bold, fontSize: 18 },
  bookingId: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  amountPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  amountPillText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },

  // ── Escrow card ──
  escrowCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 2,
    borderColor: "#ef4444",
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  escrowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  escrowTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#991b1b",
  },
  escrowAmount: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: "#991b1b",
    marginBottom: SPACING.sm,
  },
  escrowSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#991b1b",
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  escrowBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "#ef4444",
    alignSelf: "flex-start",
    gap: SPACING.sm,
  },
  escrowBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: "#991b1b",
  },

  sosWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 2,
    borderColor: "#ef4444",
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  sosWarningTitle: { fontFamily: FONTS.bold, fontSize: 14, color: "#991b1b" },
  sosWarningText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#991b1b",
    marginTop: 2,
  },

  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  sectionSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
  },

  customerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.muted,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.navy,
  },
  avatarInit: { fontFamily: FONTS.bold, fontSize: 18, color: "#fff" },
  customerName: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.navy },
  customerSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  contactBtnGroup: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  callBtn: {
    backgroundColor: COLORS.green,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  detailLabelRow: { flexDirection: "row", alignItems: "center" },
  detailLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.gray },
  detailValue: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.navy,
    flex: 1,
    textAlign: "right",
  },

  notesBox: {
    backgroundColor: COLORS.cream,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
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
    lineHeight: 19,
  },

  // Timeline
  timelineCard: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLabel: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.navy },
  timelineTime: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  locDetail: {
    marginTop: SPACING.sm,
    marginLeft: 24,
    paddingLeft: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
  },
  coordsRow: { flexDirection: "row", alignItems: "center" },
  coordsText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 6,
  },
  coordsTextLight: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#065f46",
    marginTop: 4,
    marginBottom: 8,
  },
  mapBtn: {
    backgroundColor: COLORS.navy,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  mapBtnRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mapBtnGreen: {
    backgroundColor: COLORS.green,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  mapBtnText: { fontFamily: FONTS.bold, fontSize: 12, color: "#fff" },

  // Tracking
  trackingBox: { borderColor: COLORS.green, backgroundColor: "#f0fdf4" },
  trackingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.green,
  },
  trackingTitle: { fontFamily: FONTS.bold, fontSize: 14, color: "#065f46" },
  trackingSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#065f46",
    lineHeight: 19,
  },
  locationText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#065f46",
    marginTop: SPACING.sm,
  },

  // Emergency
  emergencyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  emergencyName: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.navy },
  emergencyRel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
    textTransform: "capitalize",
  },
  emergencyEmailRow: { flexDirection: "row", alignItems: "center" },
  emergencyEmail: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.navy,
    marginTop: 4,
  },
  emergencyContactBtns: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  emergencyPhoneBtn: {
    backgroundColor: COLORS.green,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  emergencyEmailBtn: {
    backgroundColor: COLORS.navy,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  // Review
  reviewBox: {
    backgroundColor: "#fffbeb",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: SPACING.sm,
  },
  reviewRating: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.navy,
    marginLeft: 6,
  },
  reviewComment: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.navy,
    fontStyle: "italic",
    lineHeight: 19,
  },
  reviewDate: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
    marginTop: SPACING.sm,
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  bigBtn: {
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  bigBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bigBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },
  sosBtn: { backgroundColor: "#dc2626" },

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
    maxWidth: 380,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: "#dc2626",
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
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  modalActions: { flexDirection: "row", gap: SPACING.sm },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.muted,
    alignItems: "center",
  },
  modalCancelText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.gray },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  modalConfirmText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },
});
