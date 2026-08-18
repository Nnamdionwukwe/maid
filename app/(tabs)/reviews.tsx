import { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { FontAwesome5 } from "@expo/vector-icons";

// ── API ───────────────────────────────────────────────────────────────
const apiFetch = async (path: string, token: string) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

export default function MaidReviewsScreen() {
  const router = useRouter();
  const { token, user } = useAuthStore();

  // ── Reviews from public endpoint /api/maids/:id/reviews ────────
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["maid-reviews", user?.id],
    queryFn: () => apiFetch(`/api/maids/${user?.id}/reviews?limit=50`, token!),
    enabled: !!token && !!user?.id,
  });

  // ── Maid profile (for rating + total_reviews stats) ────────────
  const { data: maidData } = useQuery({
    queryKey: ["maid-self-profile", user?.id],
    queryFn: () => apiFetch(`/api/maids/${user?.id}`, token!),
    enabled: !!token && !!user?.id,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, []),
  );

  const reviews = data?.reviews || [];
  const profile = maidData?.maid;
  const avgRating = Number(profile?.rating || 0);
  const totalReviews = Number(profile?.total_reviews || reviews.length || 0);

  // ── Star distribution (1-5 breakdown) ──────────────────────────
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 5 stars, index 4 = 1 star
    reviews.forEach((r: any) => {
      const n = Number(r.rating);
      if (n >= 1 && n <= 5) counts[5 - n]++;
    });
    return counts;
  }, [reviews]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refetch()}
            tintColor={COLORS.navy}
          />
        }
      >
        {/* ═══════ TITLE ═══════ */}
        <View style={s.titleSection}>
          <Text style={s.bigTitle}>My Reviews</Text>
        </View>

        {isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.navy} />
          </View>
        ) : (
          <>
            {/* ═══════ STAT CARDS ═══════ */}
            <View style={s.statRow}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>AVERAGE RATING</Text>
                <View style={s.ratingRow}>
                  <FontAwesome5 name="star" size={28} color={COLORS.navy} />
                  <Text style={s.statValue}>{avgRating.toFixed(1)}</Text>
                </View>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>TOTAL REVIEWS</Text>
                <Text style={[s.statValue, { marginTop: 12 }]}>
                  {totalReviews}
                </Text>
              </View>
            </View>

            {/* ═══════ STAR DISTRIBUTION ═══════ */}
            {totalReviews > 0 && (
              <View style={s.distCard}>
                <Text style={s.distLabel}>RATING BREAKDOWN</Text>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = distribution[5 - stars];
                  const pct =
                    totalReviews > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <View key={stars} style={s.distRow}>
                      <View style={s.distStarsRow}>
                        <Text style={s.distStars}>{stars}</Text>
                        <FontAwesome5
                          name="star"
                          size={12}
                          color={COLORS.navy}
                        />
                      </View>
                      <View style={s.distBarTrack}>
                        <View style={[s.distBarFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={s.distCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ═══════ REVIEW LIST ═══════ */}
            {reviews.length === 0 ? (
              <View style={s.emptyState}>
                <FontAwesome5
                  name="star"
                  size={56}
                  color={COLORS.gray}
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={s.emptyText}>No reviews yet</Text>
                <Text style={s.emptySub}>
                  Complete bookings to receive reviews from customers
                </Text>
              </View>
            ) : (
              <View style={s.reviewList}>
                {reviews.map((r: any) => (
                  <View key={r.id} style={s.reviewCard}>
                    <View style={s.reviewTop}>
                      <View style={s.reviewerInfo}>
                        {r.customer_avatar ? (
                          <Image
                            source={{ uri: r.customer_avatar }}
                            style={s.reviewerAvatar}
                          />
                        ) : (
                          <View
                            style={[s.reviewerAvatar, s.reviewerAvatarFallback]}
                          >
                            <Text style={s.reviewerInit}>
                              {r.customer_name?.[0]?.toUpperCase() || "?"}
                            </Text>
                          </View>
                        )}
                        <Text style={s.reviewerName}>{r.customer_name}</Text>
                      </View>
                      <View style={s.starRow}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <FontAwesome5
                            key={n}
                            name="star"
                            size={16}
                            color={n > r.rating ? COLORS.border : "#fbbf24"}
                          />
                        ))}
                      </View>
                    </View>

                    {r.comment && (
                      <Text style={s.reviewComment}>"{r.comment}"</Text>
                    )}

                    <Text style={s.reviewDate}>
                      {new Date(r.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      at{" "}
                      {new Date(r.created_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
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

  titleSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  bigTitle: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.navy },

  loadingBox: { paddingVertical: 60, alignItems: "center" },

  // Stat cards
  statRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statValue: { fontFamily: FONTS.bold, fontSize: 32, color: COLORS.navy },

  // Distribution card
  distCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  distLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.gray,
    letterSpacing: 0.6,
    marginBottom: SPACING.md,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  distStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    width: 32,
  },
  distStars: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.navy,
  },
  distBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.muted,
    borderRadius: 4,
    overflow: "hidden",
  },
  distBarFill: { height: 8, backgroundColor: "#fbbf24", borderRadius: 4 },
  distCount: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.gray,
    width: 24,
    textAlign: "right",
  },

  // Review list
  reviewList: { paddingHorizontal: SPACING.md, gap: SPACING.md },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  reviewerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.muted,
  },
  reviewerAvatarFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.navy,
  },
  reviewerInit: { fontFamily: FONTS.bold, fontSize: 13, color: "#fff" },
  reviewerName: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.navy,
    flex: 1,
  },

  starRow: { flexDirection: "row", gap: 2 },

  reviewComment: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    fontStyle: "italic",
    lineHeight: 21,
    marginBottom: SPACING.sm,
  },
  reviewDate: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.grayLight,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 19,
  },
});
