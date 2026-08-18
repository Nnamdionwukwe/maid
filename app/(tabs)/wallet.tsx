import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
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

// ── API ───────────────────────────────────────────────────────────────
const apiFetch = async (path: string, token: string) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

// ── Status pill colors ────────────────────────────────────────────────
const REQUEST_STATUS: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  pending: { bg: "#fffbeb", color: "#92400e", label: "Pending" },
  processing: { bg: "#eff6ff", color: "#1e40af", label: "Processing" },
  paid: { bg: "#ecfdf5", color: "#065f46", label: "Paid ✓" },
  failed: { bg: "#fef2f2", color: "#991b1b", label: "Failed" },
  rejected: { bg: "#fef2f2", color: "#991b1b", label: "Rejected" },
  cancelled: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
};

export default function MaidWalletScreen() {
  const router = useRouter();
  const { token } = useAuthStore();

  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<"requests" | "history">(
    "requests",
  );

  // ── Queries ─────────────────────────────────────────────────────
  const {
    data: walletData,
    refetch: refetchWallet,
    isLoading: walletLoading,
  } = useQuery({
    queryKey: ["maid-wallet-full"],
    queryFn: () => apiFetch("/api/wallet", token!),
    enabled: !!token,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["maid-wallet-history", selectedCurrency],
    queryFn: () =>
      apiFetch(
        `/api/wallet/history${selectedCurrency ? `?currency=${selectedCurrency}` : ""}`,
        token!,
      ),
    enabled: !!token,
  });

  const { data: withdrawalsData, refetch: refetchWithdrawals } = useQuery({
    queryKey: ["maid-withdrawals"],
    queryFn: () => apiFetch("/api/withdrawals", token!),
    enabled: !!token,
  });

  useFocusEffect(
    useCallback(() => {
      refetchWallet();
      refetchHistory();
      refetchWithdrawals();
    }, []),
  );

  // ── Filter out zero/empty wallets ────────────────────────────────
  const wallets = (walletData?.wallets || []).filter(
    (w: any) =>
      Number(w.available_balance) > 0 ||
      Number(w.pending_balance) > 0 ||
      Number(w.escrow_pending) > 0 ||
      Number(w.total_earned) > 0 ||
      Number(w.total_withdrawn) > 0,
  );

  const transactions = historyData?.transactions || [];
  const withdrawals = withdrawalsData?.withdrawals || [];

  // Default to first/highest currency
  const activeCurrency = selectedCurrency || wallets[0]?.currency || "NGN";
  const activeWallet = wallets.find(
    (w: any) => w.currency === activeCurrency,
  ) || {
    currency: "NGN",
    available_balance: 0,
    pending_balance: 0,
    total_earned: 0,
    total_withdrawn: 0,
  };

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchWallet(),
      refetchHistory(),
      refetchWithdrawals(),
    ]);
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Wallet</Text>
        <View style={{ width: 40 }} />
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
        {walletLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.navy} />
          </View>
        ) : (
          <>
            {/* ═══════ CURRENCY SELECTOR CARDS ═══════ */}
            {wallets.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.curScroll}
              >
                <View style={s.curRow}>
                  {wallets.map((w: any) => {
                    const isActive = w.currency === activeCurrency;
                    return (
                      <TouchableOpacity
                        key={w.currency}
                        style={[s.curCard, isActive && s.curCardActive]}
                        onPress={() => setSelectedCurrency(w.currency)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.curSym, isActive && s.curSymActive]}>
                          {sym(w.currency)}
                        </Text>
                        <Text style={[s.curCode, isActive && s.curCodeActive]}>
                          {w.currency}
                        </Text>
                        <Text
                          style={[s.curAmount, isActive && s.curAmountActive]}
                        >
                          {fmt(Number(w.available_balance || 0), w.currency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* ═══════ BIG FEATURED WALLET CARD ═══════ */}
            <View style={s.bigCard}>
              <View
                style={[
                  s.bigCardCircle,
                  { top: -40, right: -40, width: 160, height: 160 },
                ]}
              />
              <View
                style={[
                  s.bigCardCircle,
                  { top: 80, right: 30, width: 100, height: 100, opacity: 0.3 },
                ]}
              />

              <View style={s.bigCurrencyBadge}>
                <Text style={s.bigCurrencyBadgeText}>
                  {activeWallet.currency}
                </Text>
              </View>

              <Text style={s.bigCardLabel}>AVAILABLE BALANCE</Text>
              <Text style={s.bigCardAmount}>
                {fmt(
                  Number(activeWallet.available_balance || 0),
                  activeWallet.currency,
                )}
              </Text>

              <View style={s.bigStatsRow}>
                <View style={s.bigStat}>
                  <Text style={s.bigStatLabel}>EARNED</Text>
                  <Text style={s.bigStatValue}>
                    {fmt(
                      Number(activeWallet.total_earned || 0),
                      activeWallet.currency,
                    )}
                  </Text>
                </View>
                <View style={s.bigStatDivider} />
                <View style={s.bigStat}>
                  <Text style={s.bigStatLabel}>IN ESCROW</Text>
                  <Text style={s.bigStatValue}>
                    {fmt(
                      Number(activeWallet.escrow_pending || 0),
                      activeWallet.currency,
                    )}
                  </Text>
                </View>
                <View style={s.bigStatDivider} />
                <View style={s.bigStat}>
                  <Text style={s.bigStatLabel}>WITHDRAWN</Text>
                  <Text style={s.bigStatValue}>
                    {fmt(
                      Number(activeWallet.total_withdrawn || 0),
                      activeWallet.currency,
                    )}
                  </Text>
                </View>
              </View>

              {Number(activeWallet.escrow_pending || 0) > 0 && (
                <View style={s.pendingRow}>
                  <FontAwesome5 name="clock" size={14} color="#fff" />
                  <Text style={s.pendingNote}>
                    {fmt(
                      Number(activeWallet.escrow_pending),
                      activeWallet.currency,
                    )}{" "}
                    held in escrow — waiting for customer to release
                  </Text>
                </View>
              )}

              {Number(activeWallet.pending_balance || 0) > 0 && (
                <View style={s.pendingRow}>
                  <FontAwesome5 name="clock" size={14} color="#fff" />
                  <Text style={s.pendingNote}>
                    {fmt(
                      Number(activeWallet.pending_balance),
                      activeWallet.currency,
                    )}{" "}
                    pending release (released 24h after booking completion)
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  s.withdrawBtn,
                  Number(activeWallet.available_balance) <= 0 && {
                    opacity: 0.5,
                  },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/withdraw",
                    params: { currency: activeWallet.currency },
                  } as any)
                }
                disabled={Number(activeWallet.available_balance) <= 0}
                activeOpacity={0.85}
              >
                <View style={s.withdrawBtnRow}>
                  <FontAwesome5
                    name="credit-card"
                    size={16}
                    color={COLORS.navy}
                  />
                  <Text style={s.withdrawBtnText}>
                    Withdraw {activeWallet.currency}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ═══════ ALL CURRENCY BALANCES ═══════ */}
            {wallets.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>ALL CURRENCY BALANCES</Text>
                {wallets.map((w: any, i: number) => {
                  const pending = Number(w.pending_balance || 0);
                  return (
                    <View
                      key={w.currency}
                      style={[
                        s.balanceRow,
                        i < wallets.length - 1 && s.balanceRowBorder,
                      ]}
                    >
                      <Text style={s.balanceCur}>{w.currency}</Text>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <View style={s.balanceLine}>
                          <Text style={s.balanceLabel}>Available: </Text>
                          <Text style={s.balanceValue}>
                            {fmt(Number(w.available_balance || 0), w.currency)}
                          </Text>
                        </View>
                        {Number(w.escrow_pending || 0) > 0 && (
                          <View style={s.balanceLine}>
                            <Text
                              style={[s.balanceLabel, { color: "#92400e" }]}
                            >
                              In Escrow:{" "}
                            </Text>
                            <Text
                              style={[s.balanceValue, { color: "#92400e" }]}
                            >
                              {fmt(Number(w.escrow_pending), w.currency)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ═══════ REQUESTS / HISTORY TABS ═══════ */}
            <View style={s.tabRow}>
              <TouchableOpacity
                style={[
                  s.bottomTab,
                  bottomTab === "requests" && s.bottomTabActive,
                ]}
                onPress={() => setBottomTab("requests")}
              >
                <Text
                  style={[
                    s.bottomTabText,
                    bottomTab === "requests" && s.bottomTabTextActive,
                  ]}
                >
                  Requests
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.bottomTab,
                  bottomTab === "history" && s.bottomTabActive,
                ]}
                onPress={() => setBottomTab("history")}
              >
                <Text
                  style={[
                    s.bottomTabText,
                    bottomTab === "history" && s.bottomTabTextActive,
                  ]}
                >
                  History
                </Text>
              </TouchableOpacity>
            </View>

            {/* ═══════ REQUESTS LIST ═══════ */}
            {bottomTab === "requests" && (
              <View style={s.contentArea}>
                {withdrawals.length === 0 ? (
                  <View style={s.emptyState}>
                    <FontAwesome5
                      name="credit-card"
                      size={48}
                      color={COLORS.gray}
                    />
                    <Text style={s.emptyText}>No withdrawal requests</Text>
                    <Text style={s.emptySub}>
                      Tap "Withdraw" to send money to your bank or wallet
                    </Text>
                  </View>
                ) : (
                  withdrawals.map((w: any) => {
                    const status =
                      REQUEST_STATUS[w.status] || REQUEST_STATUS.pending;
                    return (
                      <View key={w.id} style={s.requestCard}>
                        <View style={s.requestTop}>
                          <View style={{ flex: 1 }}>
                            <View style={s.requestAmountRow}>
                              <Text style={s.requestAmount}>
                                {fmt(Number(w.amount || 0), w.currency)}
                              </Text>
                              <View style={s.requestCurBadge}>
                                <Text style={s.requestCurBadgeText}>
                                  {w.currency}
                                </Text>
                              </View>
                            </View>
                            <Text style={s.requestMeta}>
                              {formatMethod(w.method)} ·{" "}
                              {new Date(w.created_at).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </Text>
                          </View>
                          <View
                            style={[
                              s.statusPill,
                              { backgroundColor: status.bg },
                            ]}
                          >
                            <Text
                              style={[
                                s.statusPillText,
                                { color: status.color },
                              ]}
                            >
                              {status.label}
                            </Text>
                          </View>
                        </View>
                        {(w.status === "rejected" || w.status === "failed") &&
                          w.failure_reason && (
                            <View style={s.errorBox}>
                              <FontAwesome5
                                name="times-circle"
                                size={14}
                                color="#991b1b"
                              />
                              <Text style={s.errorText}>
                                {w.failure_reason}
                              </Text>
                            </View>
                          )}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ═══════ HISTORY LIST ═══════ */}
            {bottomTab === "history" && (
              <View style={s.contentArea}>
                {transactions.length === 0 ? (
                  <View style={s.emptyState}>
                    <FontAwesome5
                      name="history"
                      size={48}
                      color={COLORS.gray}
                    />
                    <Text style={s.emptyText}>No transactions yet</Text>
                    <Text style={s.emptySub}>
                      Your wallet activity will appear here
                    </Text>
                  </View>
                ) : (
                  transactions.map((t: any) => {
                    const isCredit =
                      t.type === "credit" || t.type === "release";
                    const sign = isCredit ? "+" : "−";
                    const color = isCredit ? COLORS.green : "#ef4444";
                    const iconName = getTxIcon(t.type, t.description);
                    return (
                      <View key={t.id} style={s.txRow}>
                        <FontAwesome5
                          name={iconName}
                          size={22}
                          color={COLORS.navy}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={s.txDesc} numberOfLines={2}>
                            {t.description}
                          </Text>
                          <Text style={s.txDate}>
                            {new Date(t.created_at).toLocaleDateString(
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
                          <Text style={[s.txAmount, { color }]}>
                            {sign}
                            {fmt(Number(t.amount || 0), t.currency)}
                          </Text>
                          <Text style={s.txCur}>{t.currency}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
function formatMethod(method: string) {
  const map: Record<string, string> = {
    bank_transfer: "Local Bank Transfer",
    wire_transfer: "Wire Transfer",
    flutterwave: "Flutterwave",
    mobile_money: "Mobile Money",
    paypal: "PayPal",
    wise: "Wise",
    crypto: "Crypto",
  };
  return map[method] || method.replace(/_/g, " ");
}

function getTxIcon(type: string, description: string): string {
  const desc = (description || "").toLowerCase();
  if (desc.includes("bonus") || desc.includes("best maid"))
    return "money-bill-wave";
  if (desc.includes("withdrawal request")) return "arrow-up";
  if (
    desc.includes("withdrawal") &&
    (desc.includes("refund") ||
      desc.includes("rejected") ||
      desc.includes("failed"))
  )
    return "money-bill-wave";
  if (desc.includes("withdrawal")) return "arrow-up";
  if (desc.includes("service charge") || desc.includes("fee"))
    return "arrow-down";
  if (type === "credit" || type === "release") return "money-bill-wave";
  return "arrow-down";
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

  loadingBox: { paddingVertical: 60, alignItems: "center" },

  curScroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  curRow: { flexDirection: "row", gap: SPACING.sm },
  curCard: {
    width: 110,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  curCardActive: { borderColor: COLORS.navy, backgroundColor: COLORS.muted },
  curSym: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.navy },
  curSymActive: { color: COLORS.navy },
  curCode: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.navy,
    marginTop: 4,
  },
  curCodeActive: { color: COLORS.navy },
  curAmount: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.green,
    marginTop: 4,
    textAlign: "center",
  },
  curAmountActive: { color: COLORS.green },

  bigCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: "hidden",
    position: "relative",
  },
  bigCardCircle: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 200,
  },
  bigCurrencyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  bigCurrencyBadgeText: { fontFamily: FONTS.bold, fontSize: 12, color: "#fff" },
  bigCardLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.6,
  },
  bigCardAmount: {
    fontFamily: FONTS.bold,
    fontSize: 36,
    color: "#fff",
    marginTop: SPACING.xs,
  },
  bigStatsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    alignItems: "center",
  },
  bigStat: { flex: 1, alignItems: "center" },
  bigStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  bigStatLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bigStatValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: "#fff",
    textAlign: "center",
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
    gap: 6,
  },
  pendingNote: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic",
    lineHeight: 16,
    flex: 1,
  },
  withdrawBtn: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: SPACING.md,
  },
  withdrawBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  withdrawBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.navy },

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
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  balanceRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  balanceCur: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.navy,
    width: 50,
  },
  balanceLine: { flexDirection: "row", alignItems: "center" },
  balanceLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.gray },
  balanceValue: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.navy },

  tabRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  bottomTab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bottomTabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  bottomTabText: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.gray },
  bottomTabTextActive: { color: "#fff" },

  contentArea: { paddingHorizontal: SPACING.md, gap: SPACING.sm },

  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  requestAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  requestAmount: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.navy },
  requestCurBadge: {
    backgroundColor: COLORS.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  requestCurBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.navy,
  },
  requestMeta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusPillText: { fontFamily: FONTS.bold, fontSize: 11 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
    gap: 6,
  },
  errorText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#991b1b",
    flex: 1,
  },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  txDesc: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.navy },
  txDate: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  txAmount: { fontFamily: FONTS.bold, fontSize: 14 },
  txCur: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 2,
  },

  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    textAlign: "center",
  },
});
