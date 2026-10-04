import React from "react";
import { View, Text, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Button, Badge } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";

export default function Sessions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["sessions"], queryFn: () => api.get("/auth/sessions") });
  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/auth/sessions/${id}/revoke`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); toast("Sesi dikeluarkan", "success"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Sesi & Perangkat" />
      <FlatList
        data={q.data || []}
        keyExtractor={(s: any) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.icon}><Icon name="phone-portrait-outline" size={20} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.device}>{item.device_name || "Perangkat"}</Text>
                {item.current ? <Badge label="Perangkat ini" tone="success" /> : null}
              </View>
              <Text style={styles.time}>Terakhir aktif: {item.last_seen_at ? new Date(item.last_seen_at).toLocaleString("id-ID") : "—"}</Text>
            </View>
            {!item.current ? <Button testID={`revoke-${item.id}`} title="Keluar" variant="outline" small onPress={() => revoke.mutate(item.id)} /> : null}
          </View>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : <Text style={{ color: colors.muted, padding: 20 }}>Tidak ada sesi aktif.</Text>}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  device: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  time: { fontSize: 12, color: c.muted, marginTop: 2 },
}));
