import React from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Loading, Card, Avatar, Button, EmptyState, Icon } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";

export default function JoinRequests() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({ queryKey: ["join-requests", id], queryFn: () => api.get(`/communities/${id}/join-requests`) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["join-requests", id] });
    qc.invalidateQueries({ queryKey: ["community-dashboard", id] });
    qc.invalidateQueries({ queryKey: ["community-members", id] });
  };

  const approve = useMutation({
    mutationFn: (reqId: string) => api.post(`/communities/${id}/join-requests/${reqId}/approve`),
    onSuccess: () => { toast("Anggota diterima", "success"); invalidate(); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const reject = useMutation({
    mutationFn: (reqId: string) => api.post(`/communities/${id}/join-requests/${reqId}/reject`),
    onSuccess: () => { toast("Permintaan ditolak", "info"); invalidate(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Permintaan Bergabung" subtitle={`${q.data?.length ?? 0} menunggu`} />
      <FlatList
        data={q.data || []}
        keyExtractor={(r: any) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        renderItem={({ item }) => (
          <Card testID={`request-${item.id}`} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={item.user_name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.user_name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Icon name="shield-checkmark" size={13} color={colors.brandPrimary} />
                  <Text style={styles.meta}>{item.phone} · Skor {item.reliability}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button testID={`reject-${item.id}`} title="Tolak" variant="outline" small style={{ flex: 1 }}
                loading={reject.isPending} onPress={() => reject.mutate(item.id)} />
              <Button testID={`approve-${item.id}`} title="Terima" small style={{ flex: 1 }}
                loading={approve.isPending} onPress={() => approve.mutate(item.id)} />
            </View>
          </Card>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> :
          <EmptyState icon="person-add-outline" title="Tidak ada permintaan"
            subtitle="Permintaan bergabung dari warga akan muncul di sini untuk Anda setujui." />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted },
}));
