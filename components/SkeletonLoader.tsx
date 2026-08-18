// components/Loader.tsx

import { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { COLORS, RADIUS } from "../constants";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Spinner Loader ────────────────────────────────────────────────────
export function SpinnerLoader({
  size = "small",
  color = COLORS.navy,
  animating = true,
}: {
  size?: "small" | "large";
  color?: string;
  animating?: boolean;
}) {
  return (
    <View style={styles.spinnerContainer}>
      <ActivityIndicator size={size} color={color} animating={animating} />
    </View>
  );
}

// ── Button Spinner ────────────────────────────────────────────────────
export function ButtonSpinner({
  size = "small",
  color = "#fff",
}: {
  size?: "small" | "large";
  color?: string;
}) {
  return (
    <View style={styles.buttonSpinner}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

// ── Loading Overlay ──────────────────────────────────────────────────
export function LoadingOverlay({
  message,
  visible = true,
}: {
  message?: string;
  visible?: boolean;
}) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <ActivityIndicator size="large" color={COLORS.navy} />
        {message && <Text style={styles.overlayText}>{message}</Text>}
      </View>
    </View>
  );
}

// ── Full Page Loader ──────────────────────────────────────────────────
export function FullPageLoader({
  color = COLORS.navy,
  size = "large",
}: {
  color?: string;
  size?: "small" | "large";
}) {
  return (
    <View style={styles.fullPage}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

// ── Spinner Button (replaces skeleton button) ────────────────────────
export function SpinnerButton({
  width = 80,
  height = 36,
  color = "#fff",
}: {
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <View style={[styles.spinnerButton, { width, height }]}>
      <ActivityIndicator size="small" color={color} />
    </View>
  );
}

// ── Spinner Action Row ──────────────────────────────────────────────
export function SpinnerActionRow({
  count = 2,
  color = "#fff",
}: {
  count?: number;
  color?: string;
}) {
  return (
    <View style={styles.actionRow}>
      {Array.from({ length: count }).map((_, i) => (
        <SpinnerButton key={i} width={80} height={36} color={color} />
      ))}
    </View>
  );
}

// ── Spinner Booking Card ─────────────────────────────────────────────
export function SpinnerBookingCard({ color = "#fff" }: { color?: string }) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <View style={[styles.placeholder, { width: 120, height: 18 }]} />
          <View
            style={[
              styles.placeholder,
              { width: 100, height: 12, marginTop: 6 },
            ]}
          />
        </View>
        <View
          style={[
            styles.placeholder,
            { width: 70, height: 24, borderRadius: 12 },
          ]}
        />
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <View style={[styles.placeholder, { width: 80, height: 14 }]} />
        <View
          style={[styles.placeholder, { width: 100, height: 14, marginTop: 4 }]}
        />
        <View
          style={[styles.placeholder, { width: 150, height: 14, marginTop: 4 }]}
        />
      </View>

      {/* Actions with spinners */}
      <SpinnerActionRow count={2} color={color} />
    </View>
  );
}

// ── Spinner Wallet Card ──────────────────────────────────────────────
export function SpinnerWalletCard() {
  return (
    <View style={styles.walletCard}>
      <View style={styles.walletHeader}>
        <View
          style={[
            styles.placeholder,
            { width: 60, height: 24, borderRadius: 8 },
          ]}
        />
        <View style={{ alignItems: "flex-end" }}>
          <View
            style={[
              styles.placeholder,
              { width: 80, height: 12, borderRadius: 4 },
            ]}
          />
          <View
            style={[
              styles.placeholder,
              { width: 60, height: 16, borderRadius: 4, marginTop: 4 },
            ]}
          />
        </View>
      </View>
      <View
        style={[
          styles.placeholder,
          { width: 120, height: 32, borderRadius: 4 },
        ]}
      />
      <View
        style={[
          styles.placeholder,
          { width: 60, height: 12, borderRadius: 4, marginTop: 4 },
        ]}
      />
      <View style={styles.walletBar}>
        <View
          style={[
            styles.placeholder,
            { width: "60%", height: 6, borderRadius: 3 },
          ]}
        />
      </View>
      <View style={styles.walletBadgeRow}>
        <View
          style={[
            styles.placeholder,
            { width: 80, height: 16, borderRadius: 4 },
          ]}
        />
        <View
          style={[
            styles.placeholder,
            { width: 80, height: 16, borderRadius: 4 },
          ]}
        />
      </View>
    </View>
  );
}

// ── Spinner Stats Row ────────────────────────────────────────────────
export function SpinnerStatsRow() {
  return (
    <View style={styles.statsRow}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.statCard}>
          <ActivityIndicator size="small" color={COLORS.navy} />
          <View style={{ marginLeft: 8 }}>
            <View
              style={[
                styles.placeholder,
                { width: 40, height: 10, borderRadius: 4 },
              ]}
            />
            <View
              style={[
                styles.placeholder,
                { width: 30, height: 20, borderRadius: 4, marginTop: 4 },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Spinner Profile Header ───────────────────────────────────────────
export function SpinnerProfileHeader() {
  return (
    <View style={styles.profileHeader}>
      <View style={styles.profileLeft}>
        <View
          style={[
            styles.placeholder,
            { width: 48, height: 48, borderRadius: 24 },
          ]}
        />
        <View>
          <View
            style={[
              styles.placeholder,
              { width: 120, height: 18, borderRadius: 4 },
            ]}
          />
          <View
            style={[
              styles.placeholder,
              { width: 80, height: 12, borderRadius: 4, marginTop: 4 },
            ]}
          />
        </View>
      </View>
      <View style={styles.profileRight}>
        {[1, 2, 3].map((i) => (
          <ActivityIndicator key={i} size="small" color={COLORS.navy} />
        ))}
      </View>
    </View>
  );
}

// ── Full Page Spinner ────────────────────────────────────────────────
export function MaidHomeSpinner() {
  return (
    <View style={styles.container}>
      <SpinnerProfileHeader />

      {/* Availability */}
      <View style={styles.availSection}>
        <View>
          <View
            style={[
              styles.placeholder,
              { width: 100, height: 18, borderRadius: 4 },
            ]}
          />
          <View
            style={[
              styles.placeholder,
              { width: 160, height: 12, borderRadius: 4, marginTop: 4 },
            ]}
          />
        </View>
        <View
          style={[
            styles.placeholder,
            { width: 50, height: 30, borderRadius: 15 },
          ]}
        />
      </View>

      {/* Stats */}
      <SpinnerStatsRow />

      {/* Wallet */}
      <SpinnerWalletCard />

      {/* Bookings Title */}
      <View style={styles.bookingsHeader}>
        <View
          style={[
            styles.placeholder,
            { width: 140, height: 22, borderRadius: 4 },
          ]}
        />
        <View style={styles.tabRow}>
          {["All", "Pending", "Confirmed"].map((_, i) => (
            <View
              key={i}
              style={[
                styles.placeholder,
                { width: 70, height: 32, borderRadius: 16 },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Booking Cards */}
      {[1, 2].map((i) => (
        <SpinnerBookingCard key={i} />
      ))}
    </View>
  );
}

// ── Text component for overlay ──────────────────────────────────────
import { Text } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  placeholder: {
    backgroundColor: COLORS.borderLight,
    overflow: "hidden",
  },

  // Spinner
  spinnerContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  buttonSpinner: {
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },
  spinnerButton: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Overlay
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  overlayCard: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    minWidth: 150,
  },
  overlayText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.navy,
    marginTop: 12,
  },

  // Full Page
  fullPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.cream,
  },

  // Profile Header
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  profileLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileRight: {
    flexDirection: "row",
    gap: 12,
  },

  // Availability
  availSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Wallet
  walletCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.xl,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  walletBar: {
    marginTop: 8,
    marginBottom: 12,
  },
  walletBadgeRow: {
    flexDirection: "row",
    gap: 12,
  },

  // Bookings
  bookingsHeader: {
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  // Action Row
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardBody: {
    marginBottom: 12,
  },
});
