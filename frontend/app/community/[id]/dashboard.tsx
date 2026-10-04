import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Card, Badge, EmptyState } from "@/src/components/ui";
import { StatTile, ActionTile, MiniBarChart, COMMUNITY_ROLE, VERIFICATION } from "@/src/components/dashboard";
import { api } from "@/src/api/client";

export default function CommunityDashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({ queryKey: ["community-dashboard", id], queryFn: () => api.get(`/communities/${id}/dashboard`) });

  if (q.isLoading) return <View style={styles.root}><ScreenHeader title="Dashboard Komunitas" /><Loading /></View>;
  if (q.isError) return (
    <View style={styles.root}>
      <ScreenHeader title="Dashboard Komunitas" />
      <EmptyState icon="lock-closed-outline" title="Akses Ditolak"
        subtitle="Anda tidak memiliki izin mengelola komunitas ini." />
    </View>
  );

  const d = q.data;
  const role = d.my_role as string;
  const isOwner = role === "owner" || role === "super_admin";
  const isAdmin = isOwner || role === "admin";
  const s = d.stats;
  const roleInfo = COMMUNITY_ROLE[role] || COMMUNITY_ROLE.member;
  const verif = VERIFICATION[d.verification_status] || VERIFICATION.unverified;

  const base = `/community/${id}`;
  const actions = [
    { icon: "people-outline", label: "Anggota", to: `${base}/members`, show: true, testID: "action-members" },
    { icon: "storefront-outline", label: "Seller & Toko", to: `${base}/stores`, show: true, testID: "action-stores" },
    { icon: "shield-checkmark-outline", label: "Admin & Moderator", to: `${base}/staff`, show: isAdmin, testID: "action-staff" },
    { icon: "qr-code-outline", label: "Undangan / QR", to: `${base}/invite`, show: isAdmin, testID: "action-invite" },
    { icon: "settings-outline", label: "Pengaturan", to: `${base}/settings`, show: isAdmin, testID: "action-settings" },
    { icon: "receipt-outline", label: "Audit Log", to: `${base}/audit`, show: isAdmin, testID: "action-audit" },
  ].filter((a) => a.show);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Dashboard Komunitas" subtitle={d.name} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 16 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}>

        {/* header card */}
        <Card testID="community-header-card" style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.logo}><Icon name="people" size={24} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{d.name}</Text>
              <Text style={styles.cLoc}>{d.location || "Komunitas Lokal"}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            <Badge testID="community-status-badge" label={d.status === "active" ? "Aktif" : d.status} tone="success" />
            <Badge testID="community-verif-badge" label={verif.label} tone={verif.tone} />
            <Badge testID="community-role-badge" label={`Peran: ${roleInfo.label}`} tone={roleInfo.tone} />
          </View>
        </Card>

        {/* overview stats */}
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Ringkasan</Text>
          <View style={styles.grid}>
            <StatTile testID="stat-members" icon="people" value={s.total_members} label="Anggota" />
            <StatTile testID="stat-active-members" icon="pulse" value={s.active_members} label="Anggota Aktif" />
            <StatTile testID="stat-sellers" icon="person-circle" value={s.total_sellers} label="Seller" />
            <StatTile testID="stat-stores" icon="storefront" value={`${s.active_stores}/${s.total_stores}`} label="Toko Aktif" />
            <StatTile testID="stat-products" icon="cube" value={s.total_products} label="Produk" />
            <StatTile testID="stat-orders" icon="receipt" value={s.total_orders} label="Pesanan" />
          </View>
        </View>

        {/* activity chart */}
        <Card style={{ gap: 6 }}>
          <Text style={styles.cardTitle}>Aktivitas Komunitas</Text>
          <Text style={styles.cardSub}>Pesanan 7 hari terakhir</Text>
          <MiniBarChart testID="community-activity-chart" data={d.activity || []} />
        </Card>

        {/* quick actions / menu */}
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Kelola</Text>
          <View style={styles.grid}>
            {actions.map((a) => (
              <ActionTile key={a.to} testID={a.testID} icon={a.icon} label={a.label}
                onPress={() => router.push(a.to as any)} />
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          Admin komunitas hanya dapat mengelola komunitas ini. Chat pesanan pembeli–penjual tetap privat.
        </Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  cName: { fontSize: 18, fontWeight: "700", color: c.onSurface },
  cLoc: { fontSize: 13, color: c.muted, marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  cardTitle: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  cardSub: { fontSize: 12, color: c.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  note: { fontSize: 12, color: c.muted, lineHeight: 18 },
}));
