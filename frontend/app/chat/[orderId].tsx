import React, { useState, useRef, useEffect } from "react";
import { View, Text, FlatList, Pressable, Platform, TextInput } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading } from "@/src/components/ui";
import { Badge } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl, uploadImage } from "@/src/api/client";
import { ORDER_STATUS } from "@/src/constants";

export default function ChatThread() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const q = useQuery({ queryKey: ["chat", orderId], queryFn: () => api.get(`/chat/${orderId}/messages`), refetchInterval: 4000 });

  const send = useMutation({
    mutationFn: (body: any) => api.post(`/chat/${orderId}/messages`, body),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["chat", orderId] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  useEffect(() => {
    if (q.data?.messages?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [q.data?.messages?.length]);

  async function sendPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast("Izin galeri diperlukan", "error");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const up = await uploadImage(res.assets[0].uri, "chat", orderId);
      send.mutate({ photo_file_id: up.id });
    } catch (e: any) { toast(e.message, "error"); }
  }

  if (q.isLoading || !q.data) return <View style={styles.root}><ScreenHeader title="Chat" /><Loading /></View>;
  const viewOnly = q.data.view_only;
  const st = ORDER_STATUS[q.data.status];

  return (
    <View style={styles.root}>
      <ScreenHeader title={`Pesanan #${q.data.order_no}`} right={st ? <Badge label={st.label} tone={st.tone} /> : undefined} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={q.data.messages}
          keyExtractor={(m: any) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
              {item.photo_file_id ? (
                <Image source={{ uri: fileUrl(item.photo_file_id) }} style={styles.photo} contentFit="cover" />
              ) : (
                <Text style={[styles.msgText, item.mine && { color: colors.onBrandPrimary }]}>{item.text}</Text>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Mulai percakapan terkait pesanan ini.</Text>}
        />
        {viewOnly ? (
          <View style={[styles.viewOnly, { paddingBottom: insets.bottom + 12 }]}>
            <Icon name="lock-closed" size={16} color={colors.muted} />
            <Text style={styles.viewOnlyText}>Pesanan selesai. Chat hanya dapat dilihat.</Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <Pressable testID="chat-photo-btn" onPress={sendPhoto} style={styles.attach}><Icon name="image-outline" size={22} color={colors.brandPrimary} /></Pressable>
            <View style={styles.inputWrap}>
              <TextInput
                testID="chat-input"
                value={text}
                onChangeText={setText}
                placeholder="Tulis pesan..."
                placeholderTextColor={colors.muted}
                multiline
                style={{ fontSize: 15, color: colors.onSurface, maxHeight: 100, paddingTop: 0 }}
              />
            </View>
            <Pressable testID="chat-send-btn" disabled={!text.trim()} onPress={() => text.trim() && send.mutate({ text })} style={[styles.send, { opacity: text.trim() ? 1 : 0.4 }]}>
              <Icon name="send" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  mine: { alignSelf: "flex-end", backgroundColor: c.brandPrimary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
  msgText: { fontSize: 15, color: c.onSurface },
  photo: { width: 180, height: 180, borderRadius: 10 },
  empty: { textAlign: "center", color: c.muted, fontSize: 13, marginTop: 40 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 8, paddingHorizontal: 12, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  attach: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  inputWrap: { flex: 1, backgroundColor: c.surfaceTertiary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, justifyContent: "center" },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  viewOnly: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  viewOnlyText: { fontSize: 13, color: c.muted },
}));
