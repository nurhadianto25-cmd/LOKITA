import React from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Loading, EmptyState, Avatar, Badge } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { ORDER_STATUS } from "@/src/constants";

export default function ChatList() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const threads = useQuery({ queryKey: ["threads"], queryFn: () => api.get("/chat/threads"), refetchInterval: 10000 });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Chat</Text>
      </View>
      <FlatList
        data={threads.data || []}
        keyExtractor={(t: any) => t.order_id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={threads.isFetching} onRefresh={() => threads.refetch()} tintColor={colors.brandPrimary} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const st = ORDER_STATUS[item.status];
          return (
            <Pressable testID={`thread-${item.order_id}`} onPress={() => router.push(`/chat/${item.order_id}`)} style={styles.row}>
              <Avatar name={item.other_name} size={48} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.other_name}</Text>
                  <Text style={styles.no}>#{item.order_no}</Text>
                </View>
                <Text style={styles.last} numberOfLines={1}>{item.last_message}</Text>
              </View>
              {st ? <Badge label={st.label} tone={st.tone} /> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={threads.isLoading ? <Loading /> :
          <EmptyState icon="chatbubbles-outline" title="Belum ada pesan"
            subtitle="Chat akan muncul saat Anda membuat atau menerima pesanan." />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  title: { fontSize: 24, fontWeight: "700", color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  name: { fontSize: 15, fontWeight: "600", color: c.onSurface, flexShrink: 1 },
  no: { fontSize: 12, color: c.muted },
  last: { fontSize: 13, color: c.muted, marginTop: 2 },
  sep: { height: 1, backgroundColor: c.divider, marginLeft: 76 },
}));
