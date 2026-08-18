import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../stores/authStore";
import { API_URL, COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { useAppToast } from "../../components/AppToast";
import { FontAwesome5 } from "@expo/vector-icons";

// ── API helpers ───────────────────────────────────────────────────────
async function fetchConversation(token: string) {
  const res = await fetch(`${API_URL}/api/maid-support-chat/conversation`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

async function markRead(token: string, conversationId: string) {
  await fetch(`${API_URL}/api/maid-support-chat/${conversationId}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function deleteMsg(token: string, messageId: string) {
  const res = await fetch(
    `${API_URL}/api/maid-support-chat/messages/${messageId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Failed to delete");
  }
  return res.json();
}

// ── Time helpers ──────────────────────────────────────────────────────
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDay(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Main screen ───────────────────────────────────────────────────────
export default function SupportChatScreen() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const qc = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { toast } = useAppToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["support-chat-conversation"],
    queryFn: () => fetchConversation(token!),
    enabled: !!token,
    staleTime: 0,
    refetchInterval: 8000,
  });

  const conversationId = data?.conversation?.id;

  // Mark as read on open
  useEffect(() => {
    if (conversationId && token) {
      markRead(token, conversationId);
    }
  }, [conversationId]);

  // Scroll to bottom when messages change
  const messages: any[] = data?.messages || [];
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    }
  }, [messages.length]);

  // Invalidate unread on leave
  useFocusEffect(
    useCallback(() => {
      return () => {
        qc.invalidateQueries({ queryKey: ["support-chat-unread"] });
      };
    }, []),
  );

  // ── Pick image ──────────────────────────────────────────────────
  async function handlePickAttachment() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachment(result.assets[0]);
    }
  }

  // ── Send ────────────────────────────────────────────────────────
  async function handleSend() {
    if ((!text.trim() && !attachment) || !conversationId) return;
    setSending(true);
    try {
      if (attachment) {
        const formData = new FormData();
        formData.append("media", {
          uri: attachment.uri,
          type: attachment.mimeType || "image/jpeg",
          name: attachment.fileName || "image.jpg",
        } as any);
        if (text.trim()) formData.append("content", text.trim());

        const res = await fetch(
          `${API_URL}/api/maid-support-chat/${conversationId}/messages/media`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to send");
        }
        setAttachment(null);
      } else {
        const res = await fetch(
          `${API_URL}/api/maid-support-chat/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ content: text.trim() }),
          },
        );
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to send");
        }
      }
      setText("");
      await refetch();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) {
      toast({ type: "error", title: "Failed to send", message: err.message });
    } finally {
      setSending(false);
    }
  }

  // ── Delete message ──────────────────────────────────────────────
  function handleDeleteMessage(msgId: string) {
    toast({
      type: "warning",
      title: "Delete message?",
      message: "Hold confirmed — deleting...",
      duration: 1000,
    });
    setTimeout(async () => {
      try {
        await deleteMsg(token!, msgId);
        refetch();
        toast({ type: "success", title: "Message deleted" });
      } catch (err: any) {
        toast({ type: "error", title: "Error", message: err.message });
      }
    }, 500);
  }

  // ── Group by day ────────────────────────────────────────────────
  function buildGrouped() {
    const items: any[] = [];
    let lastDay = "";
    messages.forEach((msg: any) => {
      const day = formatDay(msg.created_at);
      if (day !== lastDay) {
        items.push({ _type: "day", _id: `day-${msg.id}`, label: day });
        lastDay = day;
      }
      items.push({ _type: "msg", ...msg });
    });
    return items;
  }

  const grouped = buildGrouped();
  const isMine = (msg: any) =>
    String(msg.sender_id).toLowerCase() === String(user?.id).toLowerCase();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>S</Text>
            <View style={s.headerOnline} />
          </View>
          <View>
            <Text style={s.headerName}>Support Team</Text>
            <Text style={s.headerStatus}>
              We typically reply within minutes
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages ── */}
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.navy} />
            <Text style={s.loadingText}>Loading…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={s.center}>
            <View style={s.emptyBubble}>
              <FontAwesome5 name="comment-dots" size={32} color={COLORS.gray} />
            </View>
            <Text style={s.emptyTitle}>Chat with Support</Text>
            <Text style={s.emptySub}>
              Send a message and we'll get back to you shortly
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={grouped}
            keyExtractor={(item: any) => item._id || item.id}
            contentContainerStyle={s.messageList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item._type === "day") {
                return (
                  <View style={s.dayRow}>
                    <View style={s.dayLine} />
                    <Text style={s.dayLabel}>{item.label}</Text>
                    <View style={s.dayLine} />
                  </View>
                );
              }

              const mine = isMine(item);
              const deleted = item.deleted_at != null;
              const content =
                deleted && item.content === "deleted"
                  ? "This message was deleted"
                  : item.content;

              return (
                <Pressable
                  onLongPress={() => {
                    if (mine && !deleted) handleDeleteMessage(item.id);
                  }}
                  style={[s.msgWrap, mine ? s.msgWrapMine : s.msgWrapTheirs]}
                >
                  {/* Admin avatar */}
                  {!mine && (
                    <View style={s.senderAvatar}>
                      {item.sender_avatar ? (
                        <Image
                          source={{ uri: item.sender_avatar }}
                          style={s.senderAvatarImg}
                        />
                      ) : (
                        <Text style={s.senderAvatarText}>
                          {(item.sender_name || "S")[0]?.toUpperCase()}
                        </Text>
                      )}
                    </View>
                  )}

                  <View
                    style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}
                  >
                    {/* Sender name (admin only) */}
                    {!mine && item.sender_name && (
                      <Text style={s.senderName}>{item.sender_name}</Text>
                    )}

                    {/* Image attachment */}
                    {item.media_url &&
                      item.media_type === "image" &&
                      !deleted && (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setPreviewImage(item.media_url)}
                        >
                          <Image
                            source={{ uri: item.media_url }}
                            style={s.msgImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      )}

                    {/* Text */}
                    {content && (
                      <Text
                        style={[
                          s.bubbleText,
                          mine ? s.bubbleTextMine : s.bubbleTextTheirs,
                          deleted && s.deletedText,
                        ]}
                      >
                        {content}
                      </Text>
                    )}

                    {/* Time + read receipt */}
                    <View style={s.bubbleMeta}>
                      <Text style={[s.bubbleTime, mine && s.bubbleTimeMine]}>
                        {formatTime(item.created_at)}
                      </Text>
                      {mine &&
                        !deleted && ( // ← add !deleted here
                          <Text
                            style={[
                              s.readReceipt,
                              item.is_read && s.readReceiptRead,
                            ]}
                          >
                            {item.is_read ? "✓✓" : "✓"}
                          </Text>
                        )}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* ── Attachment preview ── */}
        {attachment && (
          <View style={s.attachPreview}>
            <Image source={{ uri: attachment.uri }} style={s.attachThumb} />
            <View style={{ flex: 1 }}>
              <Text style={s.attachName} numberOfLines={1}>
                {attachment.fileName || "image.jpg"}
              </Text>
              <Text style={s.attachHint}>Ready to send</Text>
            </View>
            <TouchableOpacity onPress={() => setAttachment(null)}>
              <FontAwesome5 name="times" size={18} color={COLORS.red} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={s.inputBar}>
          <TouchableOpacity style={s.attachBtn} onPress={handlePickAttachment}>
            <FontAwesome5 name="paperclip" size={22} color={COLORS.navy} />
          </TouchableOpacity>
          <TextInput
            style={s.input}
            placeholder="Type your message..."
            placeholderTextColor={COLORS.grayLight}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              s.sendBtn,
              !text.trim() && !attachment && s.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={sending || (!text.trim() && !attachment)}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome5
                name="play"
                size={14}
                color="#fff"
                style={{ marginLeft: 2 }}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* ── Hold to delete hint ── */}
        <View style={s.hintRow}>
          <FontAwesome5
            name="lightbulb"
            size={14}
            color={COLORS.gray}
            style={{ marginRight: 6 }}
          />
          <Text style={s.hintText}>
            Hold a message to delete it within 5 mins
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* ── Image preview modal ── */}
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

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  backArrow: { fontSize: 22, color: "#fff", fontFamily: FONTS.bold },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  headerAvatarText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: "#fff",
  },
  headerOnline: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.green,
    borderWidth: 2,
    borderColor: COLORS.navy,
  },
  headerName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#fff",
  },
  headerStatus: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    marginTop: 1,
  },

  // Center / empty
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
  },
  emptyBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.muted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.navy,
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
  },

  // Messages
  messageList: { padding: SPACING.md, paddingBottom: SPACING.sm },

  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dayLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.gray,
    paddingHorizontal: SPACING.sm,
  },

  msgWrap: { marginBottom: SPACING.sm, maxWidth: "80%" },
  msgWrapMine: { alignSelf: "flex-end" },
  msgWrapTheirs: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: SPACING.xs,
  },

  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navy,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
    flexShrink: 0,
    overflow: "hidden",
  },
  senderAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  senderAvatarText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: "#fff",
  },

  senderName: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.navy,
    marginBottom: 4,
  },

  bubble: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    maxWidth: "100%",
  },
  bubbleMine: {
    backgroundColor: COLORS.navy,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  bubbleText: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22 },
  bubbleTextMine: { color: "#fff" },
  bubbleTextTheirs: { color: COLORS.navy },
  deletedText: { fontStyle: "italic", opacity: 0.5 },

  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    justifyContent: "flex-end",
  },
  bubbleTime: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.grayLight,
  },
  bubbleTimeMine: { color: "rgba(255,255,255,0.5)" },
  readReceipt: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  readReceiptRead: { color: "#60d7a9" },

  msgImage: {
    width: 200,
    height: 150,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
  },

  // Attachment preview
  attachPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.muted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachThumb: { width: 44, height: 44, borderRadius: RADIUS.sm },
  attachName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.navy,
  },
  attachHint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  // Input bar
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
    marginBottom: 2,
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
    marginBottom: 2,
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnIcon: { fontSize: 14, color: "#fff", marginLeft: 2 },

  // Image preview modal
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
  hintRow: {
    backgroundColor: COLORS.muted,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  hintText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.gray,
  },
  previewImage: {
    width: "92%",
    height: "70%",
    borderRadius: RADIUS.md,
  },
});
