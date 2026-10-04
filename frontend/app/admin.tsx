import React from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Card, Badge } from "@/src/components/ui";
import { StatTile, VERIFICATION } from "@/src/components/dashboard";
import { AuditRow } from "@/src/components/audit";
import { api } from "@/src/api/client";
import { rupiah } from "@/src/constants";

export default function Admin() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const m = useQuery({ queryKey: ["admin-metrics"], queryFn: () => api.get("/admin/metrics") });
  const comms = useQuery({ queryKey: ["admin-communities"], queryFn: () => api.get("/admin/communities") });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => api.get("/admin/audit") });

  if (m.isLoading) return <View style={styles.root}><ScreenHeader title="Dashboard Platform" /><Loading /></View>;
  const d = m.data || {};

  return (
    <View style={styles.root}>
      <ScreenHeader title="Dashboard Platform" subtitle="Super Admin · LOKITA" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 16 }}
        refreshControl={<RefreshControl refreshing={m.isFetching} onRefresh={() => { m.refetch(); comms.refetch(); audit.refetch(); }} tintColor={colors.brandPrimary} />}>

        {/* revenue / gmv */}
        <Card testID="gmv-card" style={{ backgroundColor: colors.brandPrimary }}>
          <Text style={{ color: colors.onBrandPrimary, fontSize: 13, opacity: 0.9 }}>Total Transaksi (Pesanan Selesai)</Text>
          <Text style={{ color: colors.onBrandPrimary, fontSize: 30, fontWeight: "800", marginTop: 4 }}>{rupiah(d.gmv || 0)}</Text>
          <Text style={{ color: colors.onBrandPrimary, fontSize: 12, opacity: 0.9, marginTop: 2 }}>{d.completed_orders ?? 0} pesanan selesai</Text>
        </Card>

        {/* stats grid */}
        <View style={styles.grid}>
          <StatTile testID="stat-users" icon="people" value={d.users ?? 0} label="Total User" />
          <StatTile testID="stat-active-users" icon="pulse" value={d.active_users ?? 0} label="User Aktif" />
          <StatTile testID="stat-sellers" icon="person-circle" value={d.sellers ?? 0} label="Total Seller" />
          <StatTile testID="stat-communities" icon="home" value={d.communities ?? 0} label="Komunitas" />
          <StatTile testID="stat-products" icon="cube" value={d.products ?? 0} label="Total Produk" />
          <StatTile testID="stat-orders" icon="receipt" value={d.orders ?? 0} label="Total Order" />
        </View>

        {/* reports banner */}
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={styles.reportIcon}><Icon name="flag" size={18} color={colors.warning} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.value2}>{d.open_reports ?? 0}</Text>
            <Text style={styles.label}>Laporan Perlu Ditinjau</Text>
          </View>
        </Card>

        {/* communities */}
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Komunitas</Text>
          {(comms.data || []).map((c: any) => {
            const v = VERIFICATION[c.verification_status] || VERIFICATION.unverified;
            return (
              <Pressable key={c.id} testID={`admin-community-${c.id}`} onPress={() => router.push(`/community/${c.id}/dashboard` as any)}>
                <Card style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={styles.cIcon}><Icon name="people" size={18} color={colors.brandPrimary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cName}>{c.name}</Text>
                      <Text style={styles.label}>{c.location || "Komunitas"} · Pemilik {c.owner_name}</Text>
                    </View>
                    <Badge label={v.label} tone={v.tone} />
                  </View>
                  <View style={styles.cStats}>
                    <Text style={styles.cStat}>{c.members} anggota</Text>
                    <Text style={styles.cDot}>·</Text>
                    <Text style={styles.cStat}>{c.stores} toko</Text>
                    <Text style={styles.cDot}>·</Text>
                    <Text style={styles.cStat}>{c.orders} pesanan</Text>
                    <Icon name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        {/* recent audit */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>Audit Log</Text>
            <Pressable testID="view-all-audit-btn" onPress={() => router.push("/admin/audit")}>
              <Text style={styles.link}>Lihat Semua</Text>
            </Pressable>
          </View>
          {(audit.data || []).slice(0, 5).map((a: any) => <AuditRow key={a.id} item={a} />)}
        </View>

        <Text style={styles.note}>Super Admin adalah peran eksekutif. Semua tindakan tercatat di audit log.</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  value2: { fontSize: 22, fontWeight: "700", color: c.onSurface },
  label: { fontSize: 12, color: c.muted },
  reportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FEF3DC", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  link: { fontSize: 13, color: c.brandPrimary, fontWeight: "600" },
  cIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  cName: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  cStats: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 },
  cStat: { fontSize: 12, color: c.onSurfaceSecondary },
  cDot: { fontSize: 12, color: c.muted },
  note: { fontSize: 12, color: c.muted, lineHeight: 18, marginTop: 4 },
}));
