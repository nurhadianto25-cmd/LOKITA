import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Button, Card, Badge, EmptyState } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";

export default function SellerDashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const store = useQuery({ queryKey: ["my-store"], queryFn: () => api.get("/seller/store") });
  const products = useQuery({ queryKey: ["my-products"], queryFn: () => api.get("/seller/products"), enabled: !!store.data });
  const orders = useQuery({ queryKey: ["orders", "seller", "active"], queryFn: () => api.get("/orders/seller?scope=active") });

  const toggle = useMutation({
    mutationFn: () => api.post("/seller/store/toggle"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store"] }),
    onError: (e: any) => toast(e.message, "error"),
  });

  if (store.isLoading) return <View style={styles.root}><ScreenHeader title="Toko Saya" /><Loading /></View>;

  if (!store.data) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Toko Saya" />
        <EmptyState icon="storefront-outline" title="Buat Toko Anda"
          subtitle="Siapkan toko permanen Anda untuk mulai menerima pesanan dari komunitas."
          action={<Button testID="create-store-btn" title="Buat Toko" icon="add" onPress={() => router.push("/seller/store")} />} />
      </View>
    );
  }

  const s = store.data;
  const activeOrders = orders.data?.length || 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Toko Saya" right={
        <Pressable testID="edit-store-btn" onPress={() => router.push("/seller/store")} hitSlop={8}><Icon name="create-outline" size={22} color={colors.brandPrimary} /></Pressable>
      } />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.logo}><Icon name="storefront" size={24} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.tag} numberOfLines={1}>{s.tagline || s.category}</Text>
            </View>
            <Badge label={s.is_open ? "Buka" : "Tutup"} tone={s.is_open ? "success" : "neutral"} />
          </View>
          <View style={{ height: 12 }} />
          <Button testID="toggle-store-btn" title={s.is_open ? "Tutup Toko" : "Buka Toko"} small
            variant={s.is_open ? "outline" : "primary"} icon={s.is_open ? "lock-closed-outline" : "lock-open-outline"}
            loading={toggle.isPending} onPress={() => toggle.mutate()} />
        </Card>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Stat label="Produk" value={products.data?.length ?? "—"} icon="cube" onPress={() => router.push("/seller/products")} />
          <Stat label="Pesanan Aktif" value={activeOrders} icon="bag" onPress={() => router.push("/(tabs)/pesanan")} />
          <Stat label="Rating" value={(s.rating || 0).toFixed(1)} icon="star" />
        </View>

        <Button testID="manage-products-btn" title="Kelola Produk" icon="list-outline" variant="outline" onPress={() => router.push("/seller/products")} />
        <Button testID="view-orders-btn" title="Lihat Pesanan Masuk" icon="receipt-outline" variant="outline" onPress={() => router.push("/(tabs)/pesanan")} />
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, icon, onPress }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.stat}>
      <Icon name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 17, fontWeight: "700", color: c.onSurface },
  tag: { fontSize: 13, color: c.muted },
  stat: { flex: 1, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontWeight: "700", color: c.onSurface },
  statLabel: { fontSize: 11, color: c.muted },
}));
