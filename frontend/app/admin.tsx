import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Card } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { rupiah } from "@/src/constants";

export default function Admin() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const m = useQuery({ queryKey: ["admin-metrics"], queryFn: () => api.get("/admin/metrics") });

  if (m.isLoading) return <View style={styles.root}><ScreenHeader title="Dashboard Admin" /><Loading /></View>;
  const d = m.data || {};
  const tiles = [
    { label: "Pengguna", value: d.users, icon: "people", },
    { label: "Penjual", value: d.sellers, icon: "storefront" },
    { label: "Komunitas", value: d.communities, icon: "home" },
    { label: "Produk", value: d.products, icon: "cube" },
    { label: "Total Pesanan", value: d.orders, icon: "receipt" },
    { label: "Pesanan Selesai", value: d.completed_orders, icon: "checkmark-done" },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Dashboard Admin" subtitle="Ringkasan Platform" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}
        refreshControl={<RefreshControl refreshing={m.isFetching} onRefresh={() => m.refetch()} tintColor={colors.brandPrimary} />}>
        <Card style={{ backgroundColor: colors.brandPrimary }}>
          <Text style={{ color: colors.onBrandPrimary, fontSize: 13, opacity: 0.9 }}>Total GMV (Pesanan Selesai)</Text>
          <Text style={{ color: colors.onBrandPrimary, fontSize: 30, fontWeight: "700", marginTop: 4 }}>{rupiah(d.gmv || 0)}</Text>
        </Card>

        <View style={styles.grid}>
          {tiles.map((t) => (
            <Card key={t.label} style={styles.tile}>
              <Icon name={t.icon} size={20} color={colors.brandPrimary} />
              <Text style={styles.value}>{t.value ?? 0}</Text>
              <Text style={styles.label}>{t.label}</Text>
            </Card>
          ))}
        </View>

        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={styles.reportIcon}><Icon name="flag" size={18} color={colors.warning} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.value2}>{d.open_reports ?? 0}</Text>
            <Text style={styles.label}>Laporan Perlu Ditinjau</Text>
          </View>
        </Card>

        <Text style={styles.note}>Super Admin adalah peran eksekutif. Semua tindakan override tercatat di audit log.</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47%", gap: 6 },
  value: { fontSize: 24, fontWeight: "700", color: c.onSurface },
  value2: { fontSize: 22, fontWeight: "700", color: c.onSurface },
  label: { fontSize: 12, color: c.muted },
  reportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FEF3DC", alignItems: "center", justifyContent: "center" },
  note: { fontSize: 12, color: c.muted, lineHeight: 18, marginTop: 4 },
}));
