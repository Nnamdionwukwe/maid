// apps/customer/app/(auth)/privacy.tsx

import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { Ionicons } from "@expo/vector-icons";

const SECTIONS = [
  {
    num: "01",
    title: "Introduction",
    body: "Deusizi Sparkle is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, share, and protect your data when you use our platform.\n\nWe will never sell your personal data to third parties. Your information is used solely to provide and improve our services, and to connect you with cleaning professionals.\n\nBy using our platform, you consent to the data practices described in this policy.",
  },
  {
    num: "02",
    title: "Information We Collect",
    body: "Account Information — when you register, we collect your name, email address, phone number, and country.\n\nGoogle Sign-In — if you use Google, we receive your name, email, and profile photo from your Google account.\n\nBooking Information — we collect your service address, booking dates, duration, and payment records.\n\nProfile Information — for maids, we collect bio, rates, services offered, location, and availability.\n\nUsage Data — we automatically collect device type, browser, and IP address.",
  },
  {
    num: "03",
    title: "How We Use Your Information",
    body: "We use the information we collect to:\n\n• Create and manage your account\n• Process bookings and facilitate payments\n• Connect customers with cleaning professionals\n• Send booking confirmations and service updates\n• Handle customer support and resolve disputes\n• Improve our platform and detect fraud\n• Send promotional communications (only with your consent)\n• Comply with our legal obligations",
  },
  {
    num: "04",
    title: "How We Share Your Information",
    body: "With Maids — when you make a booking, your name, address, and booking details are shared with the assigned cleaner.\n\nWith Payment Processors — your payment information is handled by Flutterwave (our payment partner) in accordance with their Privacy Policy. We do not store your full card details.\n\nWith Service Providers — trusted third-party providers process data on our behalf under strict agreements.\n\nWe never sell your personal data.",
  },
  {
    num: "05",
    title: "Data Storage & Security",
    body: "Your data is stored on secure servers and protected using:\n\n• Encryption in transit (HTTPS/TLS) and at rest\n• JWT-based authentication with secure token expiry\n• Regular security reviews and access controls\n• Staff access to personal data limited to those who need it\n\nWhile we take significant steps to protect your data, no internet transmission is 100% secure.",
  },
  {
    num: "06",
    title: "Your Rights",
    body: "Under applicable data protection law, you have the right to:\n\n• Access — request a copy of the personal data we hold\n• Correction — ask us to correct inaccurate data\n• Deletion — request deletion of your personal data\n• Portability — receive your data in a structured format\n• Objection — object to certain types of processing\n• Withdrawal — withdraw consent for marketing at any time\n\nContact us at hello@deusizisparkle.com to exercise any of these rights.",
  },
  {
    num: "07",
    title: "Children's Privacy",
    body: "Deusizi Sparkle is not directed at children under the age of 18. We do not knowingly collect personal information from minors.\n\nIf you believe a child has provided us with personal information without parental consent, please contact us immediately and we will remove that information.",
  },
  {
    num: "08",
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy periodically. When we make material changes, we will update the date below, send a notification to registered users via email, and display a notice on our platform.\n\nYour continued use of our platform after changes take effect constitutes your acceptance of the updated policy.",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.eyebrow}>Legal</Text>
          <Text style={s.title}>Privacy Policy</Text>
          <View style={s.dateBadge}>
            <Text style={s.dateText}>Last updated: August 2026</Text>
            <View style={s.currentBadge}>
              <Text style={s.currentText}>Current</Text>
            </View>
          </View>
        </View>

        {SECTIONS.map((section, i) => (
          <View key={i} style={s.section}>
            <Text style={s.sectionNum}>{section.num}</Text>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={s.contactCard}>
          <Text style={s.contactTitle}>Privacy questions or requests?</Text>
          <Text style={s.contactBody}>
            Contact our team to exercise your rights, request data deletion, or
            ask any privacy-related questions.
          </Text>
          <View style={s.contactItem}>
            <Ionicons name="mail-outline" size={18} color={COLORS.grayDark} />
            <Text style={s.contactText}>hello@deusizisparkle.com</Text>
          </View>
          <View style={s.contactItem}>
            <Ionicons name="call-outline" size={18} color={COLORS.grayDark} />
            <Text style={s.contactText}>+234 803 058 8774</Text>
          </View>
          <View style={s.contactItem}>
            <Ionicons
              name="location-outline"
              size={18}
              color={COLORS.grayDark}
            />
            <Text style={s.contactText}>Abuja, FCT, Nigeria</Text>
          </View>

          <View style={s.contactItem}>
            <Ionicons name="globe-outline" size={18} color={COLORS.grayDark} />
            <Text style={s.contactText}>www.deusizisparkle.com</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backBtn: {
    width: 40,
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    flex: 1,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  hero: {
    backgroundColor: COLORS.navy,
    padding: SPACING.xl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
  },
  eyebrow: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: "#fff",
    marginBottom: SPACING.md,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dateText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  currentBadge: {
    backgroundColor: COLORS.greenLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  currentText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.green,
  },
  section: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    marginBottom: 1,
  },
  sectionNum: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.grayLight,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  sectionBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.grayDark,
    lineHeight: 24,
  },
  contactCard: {
    margin: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: SPACING.sm,
  },
  contactBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  contactText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.grayDark,
  },
});
