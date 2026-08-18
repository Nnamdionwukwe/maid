// apps/customer/app/(auth)/terms.tsx

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
    title: "Acceptance of Terms",
    body: "By accessing or using the Deusizi Sparkle platform — including our website at deusizisparkle.com, mobile application, or any related services — you agree to be bound by these Terms of Service.\n\nIf you do not agree with any part of these terms, you must not use our platform. Continued use constitutes your acceptance of these terms as updated from time to time.",
  },
  {
    num: "02",
    title: "Description of Services",
    body: "Deusizi Sparkle is a global online marketplace that connects customers seeking home cleaning services with independent professional cleaning providers across multiple countries worldwide.\n\nOur platform provides a booking system, secure payment processing via Paystack and Stripe, a review and rating system, live GPS tracking, customer support services, and an SOS emergency alert system.\n\nDeusizi Sparkle acts as an intermediary between customers and maids. We are not the employer of the cleaning professionals listed on our platform.",
  },
  {
    num: "03",
    title: "Independent Contractor Status",
    body: "All cleaning professionals on Deusizi Sparkle are independent contractors, not employees, agents, joint venturers, or partners of Deusizi Sparkle.\n\nDeusizi Sparkle does not direct, control, or supervise the cleaning services provided, set the working hours or methods of cleaning professionals, guarantee the quality or safety of any cleaning service, or provide tools or equipment.\n\nCleaning professionals are solely responsible for the services they provide, their conduct, their tax obligations, and compliance with applicable laws in their jurisdiction.",
  },
  {
    num: "04",
    title: "User Accounts",
    body: "To access most features of our platform, you must create an account. You may register using your email or Google account.\n\nBy creating an account, you agree to:\n• Provide accurate, current, and complete information\n• Keep your login credentials secure and confidential\n• Notify us immediately of any unauthorized use of your account\n• Accept responsibility for all activities under your account\n• Not create multiple accounts or impersonate another person\n\nWe reserve the right to suspend or terminate accounts that violate these terms.",
  },
  {
    num: "05",
    title: "Bookings & Payments",
    body: "When you make a booking through Deusizi Sparkle:\n\n• All payments are processed securely via Paystack (African currencies including NGN, GHS, KES, ZAR, and more) or Stripe (USD, GBP, EUR, CAD, AUD, and all other international currencies)\n• Payments are not processed through Apple In-App Purchase or Google Play Billing systems\n• Your booking is confirmed only after successful payment authorisation\n• Funds are held in escrow until the customer confirms job completion\n• The cleaning professional receives 100% of their quoted rate; platform fees are applied separately on top of the maid's rate\n\nCancellation Policy:\n• Cancellations more than 24 hours before the service: full refund\n• Cancellations within 24 hours: 75% refund\n• No-shows (customer not present): no refund\n• If a maid cancels a confirmed booking: full refund\n\nDeusizi Sparkle does not guarantee the availability of any specific maid.",
  },
  {
    num: "06",
    title: "Multi-Currency & Global Payments",
    body: "Deusizi Sparkle is a global platform and supports payments in all major currencies worldwide, including but not limited to:\n\n• African currencies — NGN (Nigerian Naira), GHS (Ghanaian Cedi), KES (Kenyan Shilling), ZAR (South African Rand), and more via Paystack\n• International currencies — USD (US Dollar), GBP (British Pound), EUR (Euro), CAD (Canadian Dollar), AUD (Australian Dollar), INR (Indian Rupee), and all other Stripe-supported currencies\n\nExchange rates are determined by our payment processors at the time of transaction. Deusizi Sparkle is not responsible for exchange rate fluctuations or bank conversion fees charged by your financial institution.\n\nWithdrawal of earnings by cleaning professionals is subject to the availability of withdrawal methods in their country and currency.",
  },
  {
    num: "07",
    title: "User Conduct",
    body: "All users agree not to:\n\n• Use the platform for any unlawful, fraudulent, or harmful purpose\n• Harass, threaten, intimidate, or abuse other users, maids, or staff\n• Arrange private payments with maids outside our system\n• Post false, misleading, defamatory, or malicious reviews\n• Attempt to gain unauthorized access to accounts or our systems\n• Upload malicious code, viruses, or harmful content\n• Violate any applicable local, national, or international law\n• Discriminate against others on the basis of race, gender, religion, nationality, disability, or any other protected characteristic\n\nViolation may result in immediate account suspension, forfeiture of payments, permanent ban, and legal action where appropriate.",
  },
  {
    num: "08",
    title: "SOS Emergency Feature",
    body: "Deusizi Sparkle provides an in-app SOS emergency alert feature available during active bookings. When triggered:\n\n• Administrators are immediately notified\n• Emergency contacts registered by both parties are notified with location details\n• The GPS location of the triggered alert is recorded and shared with administrators\n\nImportant: The SOS feature is not a substitute for official emergency services. In any life-threatening emergency, always contact your local emergency services first — 112 in Nigeria, 999 in the UK, 911 in the USA, or your local equivalent. Deusizi Sparkle does not guarantee response times and is not liable for outcomes arising from use or non-use of the SOS feature.",
  },
  {
    num: "09",
    title: "Intellectual Property",
    body: "The Deusizi Sparkle name, logo, platform design, software, content, and all related intellectual property are owned by Deusizi Sparkle and are protected by copyright, trademark, and other applicable laws worldwide.\n\nYou may not copy, reproduce, distribute, modify, or create derivative works from our platform or content without our prior written consent.\n\nBy uploading content to our platform (including profile photos, reviews, and messages), you retain ownership but grant Deusizi Sparkle a worldwide, royalty-free, non-exclusive licence to use, display, and distribute that content solely for the purpose of operating and improving our services.",
  },
  {
    num: "10",
    title: "Limitation of Liability",
    body: "Deusizi Sparkle acts as a marketplace intermediary. To the maximum extent permitted by law:\n\n• We are not liable for the quality, safety, legality, or outcome of services provided by maids\n• We are not liable for any property damage, personal injury, theft, or loss arising from cleaning services\n• We are not liable for service disruptions, technical failures, or platform downtime\n• Our total liability shall not exceed the value of your most recent booking or the equivalent of USD 100, whichever is greater\n• We are not liable for indirect, incidental, special, punitive, or consequential damages\n\nNothing in these terms limits our liability for death or personal injury caused by our negligence, or for fraud or fraudulent misrepresentation.",
  },
  {
    num: "11",
    title: "Dispute Resolution",
    body: "If you experience an issue with a booking or service quality:\n\n• Contact the other party directly through in-app messaging\n• If unresolved, raise a support ticket through the platform within 7 days of the service date\n• Our support team will review evidence from both parties and respond within 5 business days\n• Deusizi Sparkle's decision on disputes involving escrow release is final\n\nFor payment disputes, contact our support team before initiating a chargeback with your bank, as chargebacks may result in account suspension. We encourage all parties to resolve disputes informally before pursuing legal action.",
  },
  {
    num: "12",
    title: "Termination",
    body: "Either party may terminate the relationship under these terms at any time:\n\n• You may close your account through the app Settings or by contacting our support team\n• We may suspend or terminate your account immediately if you breach these terms\n• Outstanding obligations — including payments due — survive termination\n• Upon termination, your right to use the platform ceases immediately\n\nWe reserve the right to discontinue or modify the platform at any time with reasonable notice to users.",
  },
  {
    num: "13",
    title: "Governing Law",
    body: "These Terms of Service are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes shall be subject to the exclusive jurisdiction of the courts of the Federal Capital Territory, Abuja, Nigeria, except where applicable consumer protection laws in your country of residence require otherwise.\n\nUsers in the United Kingdom and European Union retain the right to bring claims before the courts of their country of residence under applicable consumer protection legislation.\n\nWe encourage users to contact us directly to resolve any disputes informally before pursuing legal action.",
  },
  {
    num: "14",
    title: "Changes to Terms",
    body: "We reserve the right to update these Terms of Service at any time. When we make material changes, we will:\n\n• Update the 'Last updated' date at the top of this page\n• Notify registered users via email\n• Display a prominent notice within the platform\n\nYour continued use of the platform after changes take effect constitutes your acceptance of the revised terms. If you do not agree with the updated terms, you must stop using the platform and may delete your account.",
  },
];

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.eyebrow}>Legal</Text>
          <Text style={s.title}>Terms of Service</Text>
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
          <Text style={s.contactTitle}>Questions about our Terms?</Text>
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
    marginBottom: SPACING.md,
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
