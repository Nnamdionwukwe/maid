import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { FontAwesome5 } from "@expo/vector-icons";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "#fff3cd", text: "#856404" },
  in_progress: { bg: "#cce5ff", text: "#004085" },
  resolved: { bg: "#d4edda", text: "#155724" },
  closed: { bg: "#e2e3e5", text: "#383d41" },
};

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchTicket(token: string, ticketId: string) {
  const res = await fetch(`${API_URL}/api/maid-support/${ticketId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load ticket");
  return res.json();
}

export default function SupportTicketScreen() {
  const router = useRouter();
  const { ticket_id } = useLocalSearchParams<{ ticket_id: string }>();
  const { token, user } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<any>(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["support-ticket", ticket_id],
    queryFn: () => fetchTicket(token!, ticket_id),
    enabled: !!token && !!ticket_id,
    staleTime: 0,
    refetchInterval: 15000,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, []),
  );

  useEffect(() => {
    if (data?.replies?.length) {
      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: false }),
        200,
      );
    }
  }, [data?.replies?.length]);

  async function handlePickAttachment() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAttachment(result.assets[0]);
  }

  async function handleSendReply() {
    if (!reply.trim() && !attachment) return;
    setSending(true);
    try {
      if (reply.trim()) {
        const res = await fetch(
          `${API_URL}/api/maid-support/${ticket_id}/reply`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message: reply.trim() }),
          },
        );
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error);
        }
        setReply("");
      }

      if (attachment) {
        const formData = new FormData();
        const fileType = attachment.mimeType || "image/jpeg";
        const fileName = attachment.fileName || `attachment_${Date.now()}.jpg`;
        // ⚠️ Do NOT set Content-Type header — let fetch set it with multipart boundary
        formData.append("media", {
          uri: attachment.uri,
          type: fileType,
          name: fileName,
        } as any);
        const res = await fetch(
          `${API_URL}/api/maid-support/${ticket_id}/media`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }, // NO Content-Type here
            body: formData,
          },
        );
        if (!res.ok) {
          const d = await res.json();
          console.warn("Media upload failed:", d.error);
        }
        setAttachment(null);
      }

      await refetch();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) {
      Alert.alert("Failed to send", err.message);
    } finally {
      setSending(false);
    }
  }

  const ticket = data?.ticket;
  const replies = data?.replies || [];
  const attachments = data?.attachments || [];

  if (isLoading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.cream,
        }}
      >
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );

  if (!ticket)
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
          </TouchableOpacity>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ color: COLORS.gray }}>Ticket not found</Text>
        </View>
      </SafeAreaView>
    );

  const sc = STATUS_COLORS[ticket.status || "open"] || STATUS_COLORS.open;
  const isClosed = ["resolved", "closed"].includes(ticket.status);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          Ticket #{ticket.id?.slice(0, 8).toUpperCase()}
        </Text>
        <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[s.statusText, { color: sc.text }]}>
            {(ticket.status || "open")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l: string) => l.toUpperCase())}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {/* ── Ticket info card ── */}
          <View style={s.ticketInfo}>
            <View style={s.ticketMeta}>
              <Text style={s.ticketCategory}>{ticket.category}</Text>
              <View style={s.priorityRow}>
                <FontAwesome5 name="bolt" size={12} color={COLORS.amber} />
                <Text style={s.ticketPriority}>{ticket.priority}</Text>
              </View>
            </View>
            <Text style={s.ticketSubject}>{ticket.subject}</Text>
            <Text style={s.ticketTime}>{timeAgo(ticket.created_at)}</Text>
          </View>

          {/* ── Original message ── */}
          <View style={s.messageWrap}>
            <View style={[s.bubble, s.bubbleMine]}>
              <Text style={s.bubbleText}>{ticket.message}</Text>
              <Text style={s.bubbleTime}>{timeAgo(ticket.created_at)}</Text>
            </View>
          </View>

          {/* ── Ticket attachments ── */}
          {attachments.map(
            (att: any) =>
              att.media_type === "image" && (
                <TouchableOpacity
                  key={att.id}
                  activeOpacity={0.85}
                  onPress={() => setPreviewImage(att.media_url)}
                >
                  <Image source={{ uri: att.media_url }} style={s.attachImg} />
                </TouchableOpacity>
              ),
          )}

          {/* ── Replies ── */}
          {replies.map((r: any) => {
            const isAdmin = r.user_id !== ticket.user_id;
            return (
              <View
                key={r.id}
                style={[
                  s.messageWrap,
                  isAdmin ? s.messageWrapAdmin : s.messageWrapMine,
                ]}
              >
                {isAdmin && (
                  <View style={s.adminAvatar}>
                    <FontAwesome5
                      name="ticket-alt"
                      size={14}
                      color={COLORS.blue}
                    />
                  </View>
                )}
                <View
                  style={[s.bubble, isAdmin ? s.bubbleAdmin : s.bubbleMine]}
                >
                  {isAdmin && <Text style={s.adminLabel}>Deusizi Support</Text>}
                  <Text style={[s.bubbleText, isAdmin && s.bubbleTextAdmin]}>
                    {r.message}
                  </Text>
                  <Text style={[s.bubbleTime, isAdmin && s.bubbleTimeAdmin]}>
                    {timeAgo(r.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}

          {isClosed && (
            <View style={s.closedBanner}>
              <View style={s.closedRow}>
                <FontAwesome5
                  name={ticket.status === "resolved" ? "check-circle" : "lock"}
                  size={16}
                  color={COLORS.green}
                />
                <Text style={s.closedText}>
                  {ticket.status === "resolved"
                    ? "Ticket resolved"
                    : "Ticket closed"}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Reply bar — hidden if closed ── */}
        {!isClosed && (
          <View>
            {attachment && (
              <View style={s.attachPreview}>
                <Image source={{ uri: attachment.uri }} style={s.attachThumb} />
                <Text style={s.attachName} numberOfLines={1}>
                  {attachment.fileName || "image.jpg"}
                </Text>
                <TouchableOpacity onPress={() => setAttachment(null)}>
                  <FontAwesome5 name="times" size={16} color={COLORS.red} />
                </TouchableOpacity>
              </View>
            )}
            <View style={s.inputBar}>
              <TouchableOpacity
                style={s.attachBtn}
                onPress={handlePickAttachment}
              >
                <FontAwesome5 name="paperclip" size={22} color={COLORS.navy} />
              </TouchableOpacity>
              <TextInput
                style={s.input}
                placeholder="Type a reply…"
                placeholderTextColor={COLORS.grayLight}
                value={reply}
                onChangeText={setReply}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[
                  s.sendBtn,
                  !reply.trim() && !attachment && s.sendBtnDisabled,
                ]}
                onPress={handleSendReply}
                disabled={sending || (!reply.trim() && !attachment)}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <FontAwesome5 name="arrow-up" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={s.previewOverlay}>
          <TouchableOpacity
            style={s.previewClose}
            onPress={() => setPreviewImage(null)}
          >
            <FontAwesome5 name="times" size={18} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={s.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewClose: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  previewCloseText: {
    fontSize: 18,
    color: "#fff",
    fontFamily: FONTS.bold,
  },
  previewImage: {
    width: "92%",
    height: "70%",
    borderRadius: RADIUS.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36 },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.navy,
    flex: 1,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusText: { fontFamily: FONTS.bold, fontSize: 10 },

  scroll: { padding: SPACING.md },

  ticketInfo: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ticketMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  ticketCategory: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.gray,
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ticketPriority: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.amber,
  },
  ticketSubject: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: 6,
  },
  ticketTime: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.grayLight,
  },

  messageWrap: { marginBottom: SPACING.sm, maxWidth: "80%" },
  messageWrapMine: { alignSelf: "flex-end" },
  messageWrapAdmin: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: SPACING.xs,
  },
  adminAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.blueLight,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
    flexShrink: 0,
  },

  bubble: { borderRadius: RADIUS.xl, padding: SPACING.md },
  bubbleMine: { backgroundColor: COLORS.navy, borderBottomRightRadius: 4 },
  bubbleAdmin: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adminLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.blue,
    marginBottom: 4,
  },
  bubbleText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#fff",
    lineHeight: 21,
  },
  bubbleTextAdmin: { color: COLORS.navy },
  bubbleTime: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    marginTop: 4,
    textAlign: "right",
  },
  bubbleTimeAdmin: { color: COLORS.grayLight },

  attachRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  attachImg: { width: 120, height: 90, borderRadius: RADIUS.md },

  closedBanner: {
    backgroundColor: COLORS.greenLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: "center",
    marginTop: SPACING.md,
  },
  closedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closedText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.green },

  attachPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.muted,
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachThumb: { width: 40, height: 40, borderRadius: RADIUS.sm },
  attachName: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.navy,
    flex: 1,
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: COLORS.muted,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.navy,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navy,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText: { fontFamily: FONTS.bold, fontSize: 18, color: "#fff" },
});
