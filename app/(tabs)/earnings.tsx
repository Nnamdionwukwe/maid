import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
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
  fmt,
  sym,
} from "../../constants";
import { FontAwesome5 } from "@expo/vector-icons";

const { width: W } = Dimensions.get("window");

// ── API ───────────────────────────────────────────────────────────────
const apiFetch = async (path: string, token: string) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

// ── Period & status filters ───────────────────────────────────────────
const PERIODS = [
  { key: "all", label: "All Time" },
  { key: "this_year", label: "This Year" },
  { key: "this_month", label: "This Month" },
  { key: "this_week", label: "This Week" },
];

const STATUSES = [
  { key: "completed", label: "Completed only" },
  { key: "all", label: "All bookings" },
];

// Format big numbers — $20,000 → $20.0K, ₦1,200,000 → ₦1.2M
function fmtCompact(n: number, currency: string) {
  const abs = Math.abs(n);
  const symbol = sym(currency);
  if (abs >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(n / 1_000).toFixed(1)}K`;
  return `${symbol}${n.toFixed(0)}`;
}

export default function MaidEarningsScreen() {
  const router = useRouter();
  const { token } = useAuthStore();

  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("completed");
  const [statusOpen, setStatusOpen] = useState(false);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("period", periodFilter);
    p.set("status", statusFilter);
    if (currencyFilter !== "all") p.set("currency", currencyFilter);
    p.set("limit", "50");
    return p.toString();
  }, [periodFilter, statusFilter, currencyFilter]);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["maid-earnings", queryParams],
    queryFn: () => apiFetch(`/api/earnings?${queryParams}`, token!),
    enabled: !!token,
  });

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["maid-earnings-stats"],
    queryFn: () => apiFetch("/api/earnings/stats", token!),
    enabled: !!token,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchStats();
    }, []),
  );

  const bookings = data?.bookings || [];
  const summary = data?.summary || [];
  const monthly = data?.monthly || [];
  const allCurrencies = data?.currencies || [];

  const activeCurrency =
    currencyFilter !== "all" ? currencyFilter : summary[0]?.currency || "USD";

  const activeSummary = summary.find(
    (s: any) => s.currency === activeCurrency,
  ) ||
    summary[0] || {
      booking_count: 0,
      total_earned: 0,
      avg_per_booking: 0,
      total_hours: 0,
      highest_booking: 0,
      lowest_booking: 0,
    };

  const activeMonthly = monthly.filter(
    (m: any) => m.currency === activeCurrency,
  );

  const totalEarned = Number(activeSummary.total_earned || 0);
  const bookingCount = Number(activeSummary.booking_count || 0);
  const totalHours = Number(activeSummary.total_hours || 0);
  const avgBooking = Number(activeSummary.avg_per_booking || 0);
  const highest = Number(activeSummary.highest_booking || 0);

  const grandTotalBookings = summary.reduce(
    (acc: number, s: any) => acc + Number(s.booking_count || 0),
    0,
  );

  const maxMonthly = Math.max(
    ...activeMonthly.map((m: any) => Number(m.earned || 0)),
    1,
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ═══════ HEADER ═══════ */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              refetch();
              refetchStats();
            }}
            tintColor={COLORS.navy}
          />
        }
      >
        {/* ═══════ TITLE + COUNT ═══════ */}
        <View style={s.titleRow}>
          <Text style={s.bigTitle}>Earnings</Text>
          <Text style={s.bookingCount}>{grandTotalBookings} bookings</Text>
        </View>

        {/* ═══════ CURRENCY TABS ═══════ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterScroll}
        >
          <View style={s.filterRow}>
            <TouchableOpacity
              style={[
                s.filterChip,
                currencyFilter === "all" && s.filterChipActive,
              ]}
              onPress={() => setCurrencyFilter("all")}
            >
              <Text
                style={[
                  s.filterChipText,
                  currencyFilter === "all" && s.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {allCurrencies.map((cur: string) => (
              <TouchableOpacity
                key={cur}
                style={[
                  s.filterChip,
                  currencyFilter === cur && s.filterChipActive,
                ]}
                onPress={() => setCurrencyFilter(cur)}
              >
                <Text
                  style={[
                    s.filterChipText,
                    currencyFilter === cur && s.filterChipTextActive,
                  ]}
                >
                  {sym(cur)}
                  {cur}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ═══════ PERIOD + STATUS FILTERS ═══════ */}
        <View style={s.row2}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            <View style={s.filterRow}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    s.periodChip,
                    periodFilter === p.key && s.periodChipActive,
                  ]}
                  onPress={() => setPeriodFilter(p.key)}
                >
                  <Text
                    style={[
                      s.periodChipText,
                      periodFilter === p.key && s.periodChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Status dropdown */}
          <View style={{ position: "relative" }}>
            <TouchableOpacity
              style={s.statusDropdown}
              onPress={() => setStatusOpen(!statusOpen)}
            >
              <Text style={s.statusDropdownText}>
                {STATUSES.find((s) => s.key === statusFilter)?.label}
              </Text>
              <FontAwesome5
                name={statusOpen ? "chevron-up" : "chevron-down"}
                size={12}
                color={COLORS.gray}
              />
            </TouchableOpacity>
            {statusOpen && (
              <View style={s.statusMenu}>
                {STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st.key}
                    style={[
                      s.statusMenuItem,
                      statusFilter === st.key && s.statusMenuItemActive,
                    ]}
                    onPress={() => {
                      setStatusFilter(st.key);
                      setStatusOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        s.statusMenuText,
                        statusFilter === st.key && s.statusMenuTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ═══════ STAT CARDS — 2x2 GRID ═══════ */}
        {isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.navy} />
          </View>
        ) : (
          <>
            <View style={s.statGrid}>
              {/* Total Earned */}
              <View style={s.statCard}>
                <View style={s.statTopBar} />
                <FontAwesome5
                  name="money-bill-wave"
                  size={24}
                  color={COLORS.navy}
                  style={{ marginBottom: SPACING.xs, marginTop: 6 }}
                />
                <Text style={s.statLabel}>TOTAL EARNED</Text>
                <Text style={s.statBigValue}>
                  {fmtCompact(totalEarned, activeCurrency)}
                </Text>
                <Text style={s.statSubValue}>
                  {fmt(totalEarned, activeCurrency)}
                </Text>
              </View>
              {/* Bookings */}
              <View style={s.statCard}>
                <View style={s.statTopBar} />
                <FontAwesome5
                  name="clipboard-list"
                  size={24}
                  color={COLORS.navy}
                  style={{ marginBottom: SPACING.xs, marginTop: 6 }}
                />
                <Text style={s.statLabel}>BOOKINGS</Text>
                <Text style={s.statBigValue}>{bookingCount}</Text>
                <Text style={s.statSubValue}>
                  {totalHours.toFixed(1)} hrs total
                </Text>
              </View>
              {/* Avg / Booking */}
              <View style={s.statCard}>
                <View style={s.statTopBar} />
                <FontAwesome5
                  name="chart-line"
                  size={24}
                  color={COLORS.navy}
                  style={{ marginBottom: SPACING.xs, marginTop: 6 }}
                />
                <Text style={s.statLabel}>AVG / BOOKING</Text>
                <Text style={s.statBigValue}>
                  {fmtCompact(avgBooking, activeCurrency)}
                </Text>
                <Text style={s.statSubValue}>
                  {fmt(avgBooking, activeCurrency)}
                </Text>
              </View>
              {/* Highest */}
              <View style={s.statCard}>
                <View style={s.statTopBar} />
                <FontAwesome5
                  name="trophy"
                  size={24}
                  color={COLORS.navy}
                  style={{ marginBottom: SPACING.xs, marginTop: 6 }}
                />
                <Text style={s.statLabel}>HIGHEST</Text>
                <Text style={s.statBigValue}>
                  {fmtCompact(highest, activeCurrency)}
                </Text>
                <Text style={s.statSubValue}>
                  {fmt(highest, activeCurrency)}
                </Text>
              </View>
            </View>

            {/* ═══════ 6-MONTH CHART ═══════ */}
            {activeMonthly.length > 0 && (
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>
                  LAST 6 MONTHS · {activeCurrency}
                </Text>
                <View style={s.chartArea}>
                  {activeMonthly.map((m: any, i: number) => {
                    const earned = Number(m.earned || 0);
                    const heightPercent = (earned / maxMonthly) * 100;
                    return (
                      <View key={i} style={s.chartBarColumn}>
                        <View style={s.chartBarTrack}>
                          <View
                            style={[
                              s.chartBarFill,
                              { height: `${Math.max(heightPercent, 2)}%` },
                            ]}
                          />
                        </View>
                        <Text style={s.chartMonthLabel}>{m.month}</Text>
                        {earned > 0 && (
                          <Text style={s.chartValueLabel}>
                            {fmtCompact(earned, activeCurrency)}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ═══════ BY CURRENCY ═══════ */}
            {summary.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>BY CURRENCY</Text>
                {summary.map((item: any, i: number) => {
                  const isLast = i === summary.length - 1;
                  return (
                    <View
                      key={item.currency}
                      style={[s.currencyRow, !isLast && s.currencyRowBorder]}
                    >
                      <View style={s.currencyBadge}>
                        <Text style={s.currencyBadgeText}>{item.currency}</Text>
                      </View>
                      <Text style={s.currencyBookings}>
                        {item.booking_count} booking
                        {Number(item.booking_count) !== 1 ? "s" : ""}
                      </Text>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={s.currencyAmount}>
                          {fmt(Number(item.total_earned || 0), item.currency)}
                        </Text>
                        <Text style={s.currencyHours}>
                          {Number(item.total_hours || 0).toFixed(0)} hrs
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ═══════ BOOKING HISTORY ═══════ */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>BOOKING HISTORY</Text>
              {bookings.length === 0 ? (
                <View style={s.emptyState}>
                  <FontAwesome5
                    name="inbox"
                    size={48}
                    color={COLORS.gray}
                    style={{ marginBottom: SPACING.sm }}
                  />
                  <Text style={s.emptyText}>No bookings yet</Text>
                  <Text style={s.emptySub}>
                    Earnings will appear here once you complete jobs
                  </Text>
                </View>
              ) : (
                bookings.map((b: any, i: number) => {
                  const isLast = i === bookings.length - 1;
                  const cur = b.currency || "NGN";
                  const isCompleted = b.status === "completed";
                  const isNegotiated =
                    b.notes && b.notes.toLowerCase().includes("negotiated");

                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[s.bookingRow, !isLast && s.bookingRowBorder]}
                      onPress={() => router.push(`/booking/${b.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={s.bookingTop}>
                        {b.customer_avatar ? (
                          <Image
                            source={{ uri: b.customer_avatar }}
                            style={s.bookingAvatar}
                          />
                        ) : (
                          <View
                            style={[s.bookingAvatar, s.bookingAvatarFallback]}
                          >
                            <Text style={s.bookingAvatarInit}>
                              {b.customer_name?.[0]?.toUpperCase() || "?"}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.bookingName}>{b.customer_name}</Text>
                          <Text style={s.bookingDate}>
                            {new Date(b.service_date).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={[
                              s.bookingAmount,
                              isCompleted && { color: COLORS.green },
                            ]}
                          >
                            {fmt(Number(b.total_amount || 0), cur)}
                          </Text>
                          <View style={[s.statusPill, getStatusBg(b.status)]}>
                            <Text
                              style={[
                                s.statusPillText,
                                getStatusColor(b.status),
                              ]}
                            >
                              {capitalize(b.status)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={s.bookingMeta}>
                        <View style={s.metaRow}>
                          <FontAwesome5
                            name="clock"
                            size={14}
                            color={COLORS.gray}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.bookingMetaText}>
                            {b.duration_hours}h
                          </Text>
                        </View>
                        <View style={s.metaRow}>
                          <FontAwesome5
                            name="map-marker-alt"
                            size={14}
                            color={COLORS.gray}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.bookingMetaText} numberOfLines={1}>
                            {b.address}
                          </Text>
                        </View>
                      </View>

                      {isNegotiated && (
                        <View style={s.negotiatedRow}>
                          <FontAwesome5
                            name="pen"
                            size={14}
                            color={COLORS.gray}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.negotiatedNote}>{b.notes}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
function capitalize(s: string) {
  return s
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
function getStatusBg(status: string) {
  switch (status) {
    case "completed":
      return { backgroundColor: "#ecfdf5" };
    case "in_progress":
      return { backgroundColor: "#f5f3ff" };
    case "confirmed":
      return { backgroundColor: "#eff6ff" };
    case "cancelled":
    case "declined":
      return { backgroundColor: "#fef2f2" };
    default:
      return { backgroundColor: "#fffbeb" };
  }
}
function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return { color: "#065f46" };
    case "in_progress":
      return { color: "#5b21b6" };
    case "confirmed":
      return { color: "#1e40af" };
    case "cancelled":
    case "declined":
      return { color: "#991b1b" };
    default:
      return { color: "#92400e" };
  }
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.sm },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.navy },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  bigTitle: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.navy },
  bookingCount: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.gray },

  filterScroll: { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  filterRow: { flexDirection: "row", gap: SPACING.xs },

  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  filterChipText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.navy },
  filterChipTextActive: { color: "#fff" },

  row2: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: "center",
    gap: SPACING.sm,
  },

  periodChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  periodChipActive: { backgroundColor: COLORS.muted, borderColor: COLORS.navy },
  periodChipText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.gray,
  },
  periodChipTextActive: { color: COLORS.navy, fontFamily: FONTS.bold },

  statusDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusDropdownText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.navy,
  },
  statusMenu: {
    position: "absolute",
    top: 40,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 160,
    zIndex: 100,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusMenuItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusMenuItemActive: { backgroundColor: COLORS.muted },
  statusMenuText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.gray,
  },
  statusMenuTextActive: { color: COLORS.navy, fontFamily: FONTS.bold },

  loadingBox: { paddingVertical: 60, alignItems: "center" },

  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    width: (W - SPACING.md * 2 - SPACING.sm) / 2,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  statTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.navy,
  },
  statLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.gray,
    letterSpacing: 0.5,
  },
  statBigValue: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.navy,
    marginTop: 4,
  },
  statSubValue: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
    marginTop: 2,
  },

  chartCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 0.6,
    marginBottom: SPACING.md,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 180,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  chartBarColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  chartBarTrack: { flex: 1, justifyContent: "flex-end", width: "100%" },
  chartBarFill: {
    backgroundColor: "#fbbf24",
    width: "70%",
    alignSelf: "center",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  chartMonthLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
  },
  chartValueLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: "#fff",
    marginTop: 2,
  },

  section: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 0.6,
    marginBottom: SPACING.md,
  },

  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  currencyRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  currencyBadge: {
    backgroundColor: COLORS.muted,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    minWidth: 50,
    alignItems: "center",
  },
  currencyBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.navy,
  },
  currencyBookings: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
  },
  currencyAmount: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.navy },
  currencyHours: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
    marginTop: 2,
  },

  bookingRow: { paddingVertical: SPACING.md },
  bookingRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  bookingTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  bookingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.muted,
  },
  bookingAvatarFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fbbf24",
  },
  bookingAvatarInit: { fontFamily: FONTS.bold, fontSize: 16, color: "#fff" },
  bookingName: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  bookingDate: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  bookingAmount: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 4,
  },
  statusPillText: { fontFamily: FONTS.bold, fontSize: 10 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  bookingMeta: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingLeft: 50,
    flexWrap: "wrap",
  },
  bookingMetaText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
  },
  negotiatedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingLeft: 50,
  },
  negotiatedNote: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: "italic",
    flex: 1,
  },

  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
});
