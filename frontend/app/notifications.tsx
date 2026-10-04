import React, { useEffect } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, EmptyState } from "@/src/components/ui";
import { api } from "@/src/api/client";

const ICONS: Record<string, string> = { order: "bag", payment: "cash", delivery: "bicycle", chat: "chatbubble", moderation: "flag" };

export default function Notifications() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications") });
  const readAll = useMutation({ mutationFn: () => api.post("/notifications/read-all"), onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["unread"] }); } });
  const readOne = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["unread"] }); } });

  useEffect(() => () => { qc.invalidateQueries({ queryKey: ["unread"] }); }, [qc]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Notifikasi" right={
        <Pressable testID="read-all-btn" onPress={() => readAll.mutate()} hitSlop={8}><Text style={styles.readAll}>Tandai dibaca</Text></Pressable>
      } />
      <FlatList
        data={q.data || []}
        keyExtractor={(n: any) => n.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <Pressable testID={`notif-${item.id}`} onPress={() => { readOne.mutate(item.id); if (item.order_id) router.push(`/order/${item.order_id}`); }}
            style={[styles.row, !item.read && { backgroundColor: colors.brandTertiary }]}>
            <View style={styles.icon}><Icon name={ICONS[item.type] || "notifications"} size={18} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{new Date(item.created_at).toLocaleString("id-ID")}</Text>
            </View>
            {!item.read ? <View style={styles.dot} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : <EmptyState icon="notifications-outline" title="Belum ada notifikasi" />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  readAll: { color: c.brandPrimary, fontSize: 13, fontWeight: "500" },
  row: { flexDirection: "row", gap: 12, padding: 16, alignItems: "flex-start" },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  body: { fontSize: 13, color: c.onSurfaceSecondary, marginTop: 2 },
  time: { fontSize: 11, color: c.muted, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brandSecondary, marginTop: 6 },
  sep: { height: 1, backgroundColor: c.divider, marginLeft: 66 },
}));
