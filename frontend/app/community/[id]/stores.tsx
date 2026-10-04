import React from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Card, Badge, EmptyState } from "@/src/components/ui";
import { api } from "@/src/api/client";

export default function CommunityStores() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["community-stores", id], queryFn: () => api.get(`/communities/${id}/stores`) });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Seller & Toko" subtitle={`${q.data?.length ?? 0} toko`} />
      <FlatList
        data={q.data || []}
        keyExtractor={(s: any) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        renderItem={({ item }) => (
          <Card testID={`store-${item.id}`} style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.logo}><Icon name="storefront" size={22} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.owner_name} · {item.category}</Text>
              </View>
              <Badge label={item.is_open ? "Buka" : "Tutup"} tone={item.is_open ? "success" : "neutral"} />
            </View>
            <View style={styles.statsRow}>
              <Stat icon="cube-outline" label="Produk" value={item.products} />
              <Stat icon="receipt-outline" label="Pesanan" value={item.orders} />
              <Stat icon="star" label="Rating" value={`${item.rating || 0} (${item.rating_count || 0})`} />
            </View>
          </Card>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> :
          <EmptyState icon="storefront-outline" title="Belum ada toko"
            subtitle="Belum ada penjual yang membuka toko di komunitas ini." />}
      />
    </View>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={15} color={colors.muted} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  statVal: { fontSize: 13, fontWeight: "600", color: c.onSurface },
  statLabel: { fontSize: 11, color: c.muted },
}));
