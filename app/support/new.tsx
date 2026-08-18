import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { FontAwesome5 } from "@expo/vector-icons";

const CATEGORIES = [
  { label: "Booking Issue", icon: "calendar-alt" },
  { label: "Payment", icon: "credit-card" },
  { label: "Maid / Service", icon: "broom" },
  { label: "Account", icon: "user" },
  { label: "Technical", icon: "cogs" },
  { label: "Other", icon: "comment" },
];

const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

export default function NewSupportTicketScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { booking_id } = useLocalSearchParams<{ booking_id?: string }>();

  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [subject, setSubject] = useState(
    booking_id
      ? `Issue with booking #${booking_id.slice(0, 8).toUpperCase()}`
      : "",
  );
  const [message, setMessage] = useState(
    booking_id
      ? `Hi, I have an issue with my booking #${booking_id.slice(0, 8).toUpperCase()}. `
      : "",
  );
  const [attachments, setAttachments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handlePickAttachment() {
    if (attachments.length >= 5) {
      Alert.alert("Maximum 5 attachments allowed");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newOnes = result.assets.slice(0, 5 - attachments.length);
      setAttachments((prev) => [...prev, ...newOnes]);
    }
  }

  async function handleSubmit() {
    if (!category) {
      Alert.alert("Please select a category");
      return;
    }
    if (!subject.trim()) {
      Alert.alert("Please enter a subject");
      return;
    }
    if (!message.trim()) {
      Alert.alert("Please describe your issue");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1 — Create ticket WITH message included (backend requires all 3)
      const fullMessage = [
        message.trim(),
        booking_id
          ? `\n🔗 Booking: #${booking_id.slice(0, 8).toUpperCase()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const ticketRes = await fetch(`${API_URL}/api/maid-support`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: fullMessage, // ← include message here
          category,
          priority: priority.toLowerCase(),
        }),
      });
      const ticketData = await ticketRes.json();
      if (!ticketRes.ok)
        throw new Error(ticketData.error || "Failed to create ticket");

      const ticketId = ticketData.ticket.id;

      // Step 2 — Upload attachments
      for (const file of attachments) {
        try {
          const formData = new FormData();
          const fileType = file.mimeType || "image/jpeg";
          const fileName = file.fileName || `attachment_${Date.now()}.jpg`;
          formData.append("media", {
            uri: file.uri,
            type: fileType,
            name: fileName,
          } as any);
          const uploadRes = await fetch(
            `${API_URL}/api/maid-support/${ticketId}/media`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            },
          );
          if (!uploadRes.ok) console.warn("Attachment upload failed");
        } catch (e) {
          console.warn("Attachment error:", e);
        }
      }

      Alert.alert(
        "✅ Ticket Submitted!",
        "We typically reply within 24 hours.",
        [
          {
            text: "View Ticket",
            onPress: () =>
              router.replace({
                pathname: "/support/ticket",
                params: { ticket_id: ticketId },
              }),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert("Failed to submit", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <View style={s.backRow}>
            <FontAwesome5 name="arrow-left" size={18} color={COLORS.navy} />
            <Text style={s.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>New Support Ticket</Text>
          <Text style={s.headerSub}>We typically reply within 24 hours</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* ── Category ── */}
        <View style={s.field}>
          <Text style={s.label}>
            Category <Text style={s.required}>*</Text>
          </Text>
          <View style={s.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label}
                  style={[s.categoryCard, isActive && s.categoryCardActive]}
                  onPress={() => setCategory(cat.label)}
                  activeOpacity={0.8}
                >
                  <FontAwesome5
                    name={cat.icon}
                    size={28}
                    color={isActive ? COLORS.navy : COLORS.gray}
                  />
                  <Text
                    style={[s.categoryLabel, isActive && s.categoryLabelActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Priority ── */}
        <View style={s.field}>
          <Text style={s.label}>Priority</Text>
          <View style={s.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.priorityBtn, priority === p && s.priorityBtnActive]}
                onPress={() => setPriority(p)}
              >
                <Text
                  style={[
                    s.priorityText,
                    priority === p && s.priorityTextActive,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Subject ── */}
        <View style={s.field}>
          <Text style={s.label}>
            Subject <Text style={s.required}>*</Text>
          </Text>
          <TextInput
            style={s.input}
            placeholder="Brief description of your issue"
            placeholderTextColor={COLORS.grayLight}
            value={subject}
            onChangeText={setSubject}
            maxLength={120}
          />
          <Text style={s.charCount}>{subject.length}/120</Text>
        </View>

        {/* ── Message ── */}
        <View style={s.field}>
          <Text style={s.label}>
            Message <Text style={s.required}>*</Text>
          </Text>
          <TextInput
            style={[s.input, s.textarea]}
            placeholder="Describe your issue in detail..."
            placeholderTextColor={COLORS.grayLight}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={s.charCount}>{message.length}/2000</Text>
        </View>

        {/* ── Attachments ── */}
        <View style={s.field}>
          <Text style={s.label}>
            Attachments <Text style={s.optional}>(photos/videos, up to 5)</Text>
          </Text>

          {/* Preview grid */}
          {attachments.length > 0 && (
            <View style={s.attachGrid}>
              {attachments.map((a, i) => (
                <View key={i} style={s.attachThumbWrap}>
                  <Image source={{ uri: a.uri }} style={s.attachThumb} />
                  <TouchableOpacity
                    style={s.attachRemove}
                    onPress={() =>
                      setAttachments((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    <FontAwesome5 name="times" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.attachArea} onPress={handlePickAttachment}>
            <FontAwesome5 name="paperclip" size={32} color={COLORS.navy} />
            <Text style={s.attachAreaTitle}>
              Tap to attach photos or videos
            </Text>
            <Text style={s.attachAreaSub}>{attachments.length}/5 attached</Text>
          </TouchableOpacity>
        </View>

        {/* ── Booking reference ── */}
        {booking_id && (
          <View style={s.bookingRef}>
            <View style={s.bookingRefRow}>
              <FontAwesome5
                name="calendar-alt"
                size={16}
                color={COLORS.blue}
                style={{ marginRight: 8 }}
              />
              <Text style={s.bookingRefText}>
                Linked to booking #{booking_id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[s.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitBtnText}>Submit Ticket</Text>
          )}
        </TouchableOpacity>

        <Text style={s.poweredBy}>
          POWERED BY <Text style={{ color: COLORS.blue }}>GES</Text>TECH
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: SPACING.md, paddingTop: 2 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.navy },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.navy },
  headerSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  scroll: { padding: SPACING.lg },

  field: { marginBottom: SPACING.xl },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.navy,
    marginBottom: SPACING.md,
  },
  required: { color: COLORS.red },
  optional: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.gray },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  categoryCard: {
    width: "47.5%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  categoryCardActive: { borderColor: COLORS.navy, backgroundColor: "#f0f2ff" },
  categoryLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
  },
  categoryLabelActive: { color: COLORS.navy, fontFamily: FONTS.bold },

  priorityRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  priorityBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  priorityBtnActive: { borderColor: COLORS.blue, backgroundColor: "#f0f5ff" },
  priorityText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.gray },
  priorityTextActive: { color: COLORS.blue, fontFamily: FONTS.bold },

  input: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.navy,
  },
  textarea: { minHeight: 140, textAlignVertical: "top" },
  charCount: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
    textAlign: "right",
    marginTop: 4,
  },

  attachGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  attachThumbWrap: { position: "relative" },
  attachThumb: { width: 72, height: 72, borderRadius: RADIUS.md },
  attachRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.red,
    justifyContent: "center",
    alignItems: "center",
  },
  attachArea: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.cream,
  },
  attachAreaTitle: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.navy },
  attachAreaSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  bookingRef: {
    backgroundColor: COLORS.blueLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  bookingRefRow: { flexDirection: "row", alignItems: "center" },
  bookingRefText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.blue,
  },

  submitBtn: {
    height: 56,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    justifyContent: "center",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  submitBtnText: { fontFamily: FONTS.bold, fontSize: 17, color: "#fff" },

  poweredBy: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.grayLight,
    textAlign: "center",
    marginTop: SPACING.xl,
    letterSpacing: 1.5,
  },
});
