import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuthStore } from "../stores/authStore";
import { COLORS, FONTS, SPACING, RADIUS, fmt } from "../constants";
import { useAppToast } from "../components/AppToast";
import { FontAwesome5 } from "@expo/vector-icons";
import { subscriptionsAPI } from "../constants/api";

function isAnnual(interval?: string) {
  return ["annual", "yearly", "year"].includes(interval || "");
}

function getRenewalDate(sub: any, isAnnualPlan: boolean): Date {
  const start = sub.current_period_start
    ? new Date(sub.current_period_start)
    : new Date();
  const monthsToAdd = isAnnualPlan ? 12 : 1;
  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsToAdd);
  return end;
}

export default function MaidSubscriptionScreen() {
  const router = useRouter();
  const { token, user, updateUser } = useAuthStore();
  const { toast, confirm } = useAppToast();
  const qc = useQueryClient();

  const [currency] = useState("NGN");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<any>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────
  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ["maid-subscription-plans", currency],
    queryFn: () => subscriptionsAPI.plans("maid", currency),
    enabled: !!token,
  });

  const {
    data: subData,
    isLoading: loadingSub,
    refetch: refetchSub,
  } = useQuery({
    queryKey: ["maid-my-subscription"],
    queryFn: () => subscriptionsAPI.my(),
    enabled: !!token,
  });

  useFocusEffect(
    useCallback(() => {
      refetchSub();
    }, []),
  );

  const plans = plansData?.plans || [];
  const currentSub = subData?.subscription;
  const isFree = subData?.is_free !== false;
  const invoices = subData?.invoices || [];

  // ── Find the current plan from the plans list ──────────────────────
  const currentPlan = plans.find((p: any) => p.id === currentSub?.plan_id);
  const isAnnualPlan = currentPlan
    ? isAnnual(currentPlan.interval)
    : isAnnual(currentSub?.interval);

  // ── Compute renewal date ──────────────────────────────────────────
  const renewalDate = currentSub?.current_period_start
    ? getRenewalDate(currentSub, isAnnualPlan)
    : currentSub?.current_period_end
      ? new Date(currentSub.current_period_end)
      : new Date();

  // ── Validate promo ──────────────────────────────────────────────
  async function handleValidatePromo() {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    try {
      const data = await subscriptionsAPI.validatePromo({
        code: promoCode.trim(),
        currency,
      });
      setPromoResult(data);
      toast({
        type: "success",
        title: "Promo applied!",
        message: `${data.discount_value}${data.discount_type === "percent" ? "%" : ` ${currency}`} discount`,
      });
    } catch (err: any) {
      setPromoResult(null);
      toast({
        type: "error",
        title: "Invalid promo code",
        message: err.message,
      });
    } finally {
      setValidatingPromo(false);
    }
  }

  // ── Subscribe / Change plan ──────────────────────────────────────
  async function handleSubscribe(plan: any) {
    if (!isFree && currentSub) {
      const isFreeSwitch = (plan.price || 0) === 0;
      confirm({
        title: `Switch to ${plan.display_name}?`,
        message: isFreeSwitch
          ? `Your current plan will be cancelled and you'll be downgraded to the Free plan.`
          : `Your current plan will change to ${plan.display_name}. You'll be redirected to complete payment.`,
        confirmLabel: "Proceed",
        onConfirm: () => doSubscribe(plan, true),
      });
      return;
    }
    doSubscribe(plan, false);
  }

  async function doSubscribe(plan: any, isChange: boolean) {
    setSubscribing(plan.id);
    try {
      let initData: any;

      if (isChange) {
        initData = await subscriptionsAPI.changePlan({
          new_plan_id: plan.id,
          promo_code: promoCode || undefined,
        });

        if (!initData.link && !initData.authorization_url && !initData.url) {
          toast({ type: "success", title: "Plan changed!", duration: 4000 });
          if (initData.plan?.name)
            updateUser?.({ ...user, subscription_plan: initData.plan.name });
          refetchSub();
          qc.invalidateQueries({ queryKey: ["maid-my-subscription"] });
          return;
        }
      } else {
        initData = await subscriptionsAPI.subscribe({
          plan_id: plan.id,
          currency,
          promo_code: promoCode || undefined,
        });
      }

      const paymentUrl =
        initData.link || initData.authorization_url || initData.url;
      const reference = initData.tx_ref || initData.reference;
      const gateway = initData.gateway || "flutterwave";
      const sessionId = initData.session_id;

      if (!paymentUrl && initData.subscription) {
        toast({ type: "success", title: "Plan activated! 🎉", duration: 5000 });
        if (initData.plan?.name)
          updateUser?.({ ...user, subscription_plan: initData.plan.name });
        refetchSub();
        return;
      }

      if (!paymentUrl) throw new Error("No payment URL returned");

      await WebBrowser.openBrowserAsync(paymentUrl, {
        dismissButtonStyle: "done",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      await new Promise((r) => setTimeout(r, 2000));

      const verifyParams: any = { gateway };
      if (reference) verifyParams.reference = reference;
      if (sessionId) verifyParams.transaction_id = sessionId;

      const verifyData = await subscriptionsAPI.verify(verifyParams);

      if (verifyData.subscription) {
        toast({
          type: "success",
          title: "Subscribed! 🎉",
          message: `Welcome to ${verifyData.plan?.display_name || plan.display_name}`,
          duration: 5000,
        });
        if (verifyData.plan?.name)
          updateUser?.({ ...user, subscription_plan: verifyData.plan.name });
        refetchSub();
        qc.invalidateQueries({ queryKey: ["maid-my-subscription"] });
      } else {
        throw new Error(verifyData.error || "Verification failed");
      }
    } catch (err: any) {
      if (
        err.message?.includes("cancelled") ||
        err.message?.includes("dismissed")
      ) {
        toast({ type: "info", title: "Payment cancelled" });
      } else {
        toast({
          type: "error",
          title: "Subscription failed",
          message: err.message,
        });
      }
    } finally {
      setSubscribing(null);
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────
  function handleCancel() {
    confirm({
      title: "Cancel subscription?",
      message:
        "Your subscription will remain active until the end of the current billing period.",
      confirmLabel: "Cancel Subscription",
      destructive: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await subscriptionsAPI.cancel({ immediate: false });
          toast({ type: "info", title: "Subscription cancelled" });
          refetchSub();
        } catch (err: any) {
          toast({ type: "error", title: "Failed", message: err.message });
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  const isLoading = loadingPlans || loadingSub;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.navy} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetchSub}
              tintColor={COLORS.navy}
            />
          }
        >
          {/* ── Current plan ── */}
          {currentSub && !isFree && (
            <View style={s.currentCard}>
              <View style={s.currentHeader}>
                <View>
                  <Text style={s.currentPlan}>{currentSub.display_name}</Text>
                  <Text style={s.currentInterval}>
                    {isAnnualPlan ? "Annual" : "Monthly"} Plan
                  </Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: "#ecfdf5" }]}>
                  <Text style={[s.statusText, { color: "#065f46" }]}>
                    {currentSub.status}
                  </Text>
                </View>
              </View>

              {currentSub.current_period_end && (
                <Text style={s.periodText}>
                  {currentSub.cancel_at_period_end ? (
                    <>
                      <FontAwesome5
                        name="exclamation-triangle"
                        size={14}
                        color={COLORS.amber}
                      />{" "}
                      Expires
                    </>
                  ) : (
                    <>
                      <FontAwesome5
                        name="sync-alt"
                        size={14}
                        color={COLORS.gray}
                      />{" "}
                      Renews
                    </>
                  )}{" "}
                  {renewalDate.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              )}

              {currentSub.amount > 0 && (
                <Text style={s.currentAmount}>
                  {fmt(currentSub.amount, currentSub.currency || currency)}/
                  {isAnnualPlan ? "year" : "month"} plan
                </Text>
              )}

              {currentSub.features?.length > 0 && (
                <View style={s.featuresList}>
                  {currentSub.features.map((f: string, i: number) => (
                    <View key={i} style={s.featureRow}>
                      <FontAwesome5
                        name="check"
                        size={14}
                        color={COLORS.green}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={s.featureItem}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!currentSub.cancel_at_period_end && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: "#fef2f2" }]}
                  onPress={handleCancel}
                  disabled={actionLoading}
                >
                  <Text style={[s.actionBtnText, { color: "#dc2626" }]}>
                    Cancel Subscription
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Free plan banner ── */}
          {isFree && (
            <View style={s.freeBanner}>
              <Text style={s.freeBannerTitle}>You're on the Free Plan</Text>
              <Text style={s.freeBannerSub}>
                Upgrade to unlock priority job matching, the Pro badge, and more
                bookings per month.
              </Text>
            </View>
          )}

          {/* ── Promo code ── */}
          <View style={s.promoSection}>
            <Text style={s.sectionTitle}>Have a promo code?</Text>
            <View style={s.promoRow}>
              <TextInput
                style={s.promoInput}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="Enter code"
                placeholderTextColor={COLORS.grayLight}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[
                  s.promoBtn,
                  (!promoCode.trim() || validatingPromo) && { opacity: 0.5 },
                ]}
                onPress={handleValidatePromo}
                disabled={validatingPromo || !promoCode.trim()}
              >
                <Text style={s.promoBtnText}>
                  {validatingPromo ? "…" : "Apply"}
                </Text>
              </TouchableOpacity>
            </View>
            {promoResult && (
              <View style={s.promoResult}>
                <View style={s.promoResultRow}>
                  <FontAwesome5
                    name="check-circle"
                    size={14}
                    color={COLORS.green}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={s.promoResultText}>
                    {promoResult.discount_value}
                    {promoResult.discount_type === "percent"
                      ? "%"
                      : ` ${currency}`}{" "}
                    off
                    {promoResult.description
                      ? ` — ${promoResult.description}`
                      : ""}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── Plans ── */}
          <View style={s.plansSection}>
            <Text style={s.sectionTitle}>
              {isFree ? "Choose a Plan" : "Switch Plan"}
            </Text>

            {plans
              .filter((p: any) => p.name !== "free")
              .map((plan: any) => {
                const price = plan.price || 0;
                const isCurrentPlan = currentSub?.plan_id === plan.id;
                const isPopular = plan.is_popular || plan.is_featured;
                const discountedPrice = promoResult
                  ? promoResult.discount_type === "percent"
                    ? price - (price * promoResult.discount_value) / 100
                    : price - promoResult.discount_value
                  : price;
                const isSubscribing = subscribing === plan.id;

                return (
                  <View
                    key={plan.id}
                    style={[
                      s.planCard,
                      isPopular && s.planCardPopular,
                      isCurrentPlan && s.planCardCurrent,
                    ]}
                  >
                    {isPopular && !isCurrentPlan && (
                      <View style={s.popularBadge}>
                        <View style={s.popularBadgeRow}>
                          <FontAwesome5 name="star" size={12} color="#fff" />
                          <Text style={s.popularBadgeText}>Most Popular</Text>
                        </View>
                      </View>
                    )}
                    {isCurrentPlan && (
                      <View
                        style={[
                          s.popularBadge,
                          { backgroundColor: COLORS.green },
                        ]}
                      >
                        <View style={s.popularBadgeRow}>
                          <FontAwesome5 name="check" size={12} color="#fff" />
                          <Text style={s.popularBadgeText}>Current Plan</Text>
                        </View>
                      </View>
                    )}

                    <Text style={s.planName}>{plan.display_name}</Text>
                    {plan.description && (
                      <Text style={s.planDesc}>{plan.description}</Text>
                    )}

                    <View style={s.priceRow}>
                      {promoResult && discountedPrice < price ? (
                        <>
                          <Text style={s.priceOld}>{fmt(price, currency)}</Text>
                          <Text style={s.priceMain}>
                            {fmt(Math.max(0, discountedPrice), currency)}
                          </Text>
                        </>
                      ) : (
                        <Text style={s.priceMain}>{fmt(price, currency)}</Text>
                      )}
                      <Text style={s.priceInterval}>
                        /{isAnnual(plan.interval) ? "year" : "month"}
                      </Text>
                    </View>

                    {plan.trial_days > 0 && (
                      <View style={s.trialBadge}>
                        <View style={s.trialBadgeRow}>
                          <FontAwesome5
                            name="gift"
                            size={14}
                            color="#1e40af"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.trialBadgeText}>
                            {plan.trial_days}-day free trial
                          </Text>
                        </View>
                      </View>
                    )}

                    {plan.features?.length > 0 && (
                      <View style={s.planFeatures}>
                        {plan.features.map((f: string, i: number) => (
                          <View key={i} style={s.planFeatureRow}>
                            <FontAwesome5
                              name="check"
                              size={14}
                              color={COLORS.green}
                            />
                            <Text style={s.planFeatureText}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={s.planExtras}>
                      {plan.bookings_per_month && (
                        <View style={s.planExtraRow}>
                          <FontAwesome5
                            name="calendar-alt"
                            size={12}
                            color={COLORS.gray}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.planExtra}>
                            {plan.bookings_per_month} bookings/month
                          </Text>
                        </View>
                      )}
                      {plan.priority_matching && (
                        <View style={s.planExtraRow}>
                          <FontAwesome5
                            name="bolt"
                            size={12}
                            color={COLORS.gray}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.planExtra}>Priority job matching</Text>
                        </View>
                      )}
                      {plan.dedicated_support && (
                        <View style={s.planExtraRow}>
                          <FontAwesome5
                            name="ticket-alt"
                            size={12}
                            color={COLORS.gray}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.planExtra}>Dedicated support</Text>
                        </View>
                      )}
                      {plan.badge && (
                        <View style={s.planExtraRow}>
                          <FontAwesome5
                            name="trophy"
                            size={12}
                            color={COLORS.gray}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={s.planExtra}>
                            {plan.badge} badge on profile
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[s.planBtn, isCurrentPlan && s.planBtnCurrent]}
                      onPress={() => handleSubscribe(plan)}
                      disabled={isCurrentPlan || isSubscribing}
                    >
                      {isSubscribing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text
                          style={[
                            s.planBtnText,
                            isCurrentPlan && { color: COLORS.green },
                          ]}
                        >
                          {isCurrentPlan
                            ? "✓ Current Plan"
                            : isFree
                              ? `Subscribe — ${fmt(promoResult ? Math.max(0, discountedPrice) : price, currency)}`
                              : "Switch to this plan"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>

          {/* ── Invoices ── */}
          {invoices.length > 0 && (
            <View style={s.invoicesSection}>
              <Text style={s.sectionTitle}>Payment History</Text>
              {invoices.map((inv: any) => (
                <View key={inv.id} style={s.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.invoiceDate}>
                      {new Date(inv.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <Text style={s.invoiceAmount}>
                    {fmt(inv.amount, inv.currency)}
                  </Text>
                  <View
                    style={[
                      s.statusPill,
                      inv.status === "paid"
                        ? { backgroundColor: "#ecfdf5" }
                        : { backgroundColor: "#fffbeb" },
                    ]}
                  >
                    <Text
                      style={[
                        s.statusText,
                        {
                          color: inv.status === "paid" ? "#065f46" : "#92400e",
                        },
                      ]}
                    >
                      {inv.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.navy,
  },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 18, color: "#fff" },

  freeBanner: {
    margin: SPACING.md,
    backgroundColor: "#fffbeb",
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  freeBannerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#92400e",
    marginBottom: 4,
  },
  freeBannerSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#92400e",
    lineHeight: 20,
    opacity: 0.85,
  },

  currentCard: {
    margin: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  currentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  currentPlan: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.navy },
  currentInterval: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    textTransform: "capitalize",
    marginTop: 2,
  },
  currentAmount: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: SPACING.sm,
  },
  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    textTransform: "capitalize",
  },
  periodText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.sm,
  },

  featuresList: { marginBottom: SPACING.md },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  featureItem: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.green,
  },

  actionBtn: {
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  actionBtnText: { fontFamily: FONTS.bold, fontSize: 13 },

  promoSection: { paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  promoRow: { flexDirection: "row", gap: SPACING.sm },
  promoInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
  },
  promoBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: "center",
  },
  promoBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: "#fff" },
  promoResult: {
    backgroundColor: "#ecfdf5",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  promoResultRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  promoResultText: { fontFamily: FONTS.medium, fontSize: 13, color: "#065f46" },

  plansSection: { paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  planCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    position: "relative",
    overflow: "hidden",
  },
  planCardPopular: { borderColor: COLORS.navy, borderWidth: 2 },
  planCardCurrent: { borderColor: COLORS.green, backgroundColor: "#f0fdf4" },
  popularBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: COLORS.navy,
    borderBottomLeftRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  popularBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  popularBadgeText: { fontFamily: FONTS.bold, fontSize: 11, color: "#fff" },

  planName: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.navy,
    marginBottom: 4,
  },
  planDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: SPACING.sm,
  },
  priceMain: { fontFamily: FONTS.bold, fontSize: 28, color: COLORS.navy },
  priceOld: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.gray,
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  priceInterval: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 2,
  },

  trialBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: SPACING.md,
  },
  trialBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  trialBadgeText: { fontFamily: FONTS.bold, fontSize: 12, color: "#1e40af" },

  planFeatures: { marginBottom: SPACING.md },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  planFeatureText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.navy,
    flex: 1,
  },

  planExtras: { marginBottom: SPACING.md },
  planExtraRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  planExtra: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  planBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    alignItems: "center",
  },
  planBtnCurrent: { backgroundColor: "#ecfdf5" },
  planBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: "#fff" },

  invoicesSection: { paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  invoiceDate: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.navy },
  invoiceAmount: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
});
