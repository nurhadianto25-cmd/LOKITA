import React from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Loading, Card, Badge, Avatar, EmptyState } from "@/src/components/ui";
import { COMMUNITY_ROLE } from "@/src/components/dashboard";
import { api } from "@/src/api/client";

export default function CommunityMembers() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["community-members", id], queryFn: () => api.get(`/communities/${id}/members`) });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Anggota" subtitle={`${q.data?.length ?? 0} anggota`} />
      <FlatList
        data={q.data || []}
        keyExtractor={(m: any) => m.user_id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        renderItem={({ item }) => {
          const r = COMMUNITY_ROLE[item.role] || COMMUNITY_ROLE.member;
          return (
            <Card testID={`member-${item.user_id}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={item.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.phone} · Gabung {new Date(item.joined_at).toLocaleDateString("id-ID")}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Badge label={r.label} tone={r.tone} />
                {item.is_seller ? <Text style={styles.seller}>Penjual</Text> : null}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={q.isLoading ? <Loading /> :
          <EmptyState icon="people-outline" title="Belum ada anggota" />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  name: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted, marginTop: 2 },
  seller: { fontSize: 11, color: c.brandSecondary, fontWeight: "600" },
}));
