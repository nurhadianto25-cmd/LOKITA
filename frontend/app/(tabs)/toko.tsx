import React from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, Loading, Card, Button, Badge } from "@/src/components/ui";
import { useAuth } from "@/src/auth/auth";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl } from "@/src/api/client";

export default function TokoSaya() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, refresh } = useAuth();

  const store = useQuery({ queryKey: ["my-store"], queryFn: () => api.get("/seller/store"), enabled: !!user?.is_seller });
  const products = useQuery({ queryKey: ["my-products"], queryFn: () => api.get("/seller/products"), enabled: !!user?.is_seller });

  useFocusEffect(React.useCallback(() => { store.refetch(); products.refetch(); }, []));

  const becomeSeller = useMutation({
    mutationFn: () => api.post("/seller/activate"),
    onSuccess: async () => { await refresh(); router.push("/seller/store"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (!user?.is_seller) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
          <View style={styles.heroIcon}><Icon name="storefront" size={34} color={colors.onBrandPrimary} /></View>
          <Text style={styles.heroTitle}>Buka Toko Anda</Text>
          <Text style={styles.heroSub}>Jualan ke tetangga sekomunitas. Toko permanen, katalog, dan pesanan dalam satu tempat.</Text>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          {[
            { icon: "pricetags-outline", t: "Katalog & Stok", s: "Kelola produk, harga, varian, dan stok." },
            { icon: "receipt-outline", t: "Kelola Pesanan", s: "Terima, proses, dan antar pesanan warga." },
            { icon: "wallet-outline", t: "COD & QRIS", s: "Terima pembayaran tunai atau QRIS." },
          ].map((f) => (
            <Card key={f.t} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={styles.featIcon}><Icon name={f.icon} size={20} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featTitle}>{f.t}</Text>
                <Text style={styles.featSub}>{f.s}</Text>
              </View>
            </Card>
          ))}
          <Button testID="become-seller-btn" title="Buka Toko Sekarang" icon="add-circle-outline"
            loading={becomeSeller.isPending} onPress={() => becomeSeller.mutate()} />
        </View>
      </ScrollView>
    );
  }

  if (store.isLoading) return <View style={styles.root}><Loading /></View>;
  const s = store.data;
  const cover = fileUrl(s?.cover_file_id);
  const productCount = products.data?.length || 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      refreshControl={<RefreshControl refreshing={store.isFetching} onRefresh={() => { store.refetch(); products.refetch(); }} tintColor={colors.brandPrimary} />}>
      <View style={[styles.cover, { paddingTop: insets.top }]}>
        {cover ? <Image source={{ uri: cover }} style={styles.coverImg} contentFit="cover" /> :
          <LinearGradient colors={[colors.brandPrimary, "#0B7A3F"]} style={styles.coverImg} />}
        <View style={styles.coverOverlay} />
      </View>

      {!s ? (
        <View style={{ padding: 16, gap: 12, marginTop: 8 }}>
          <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
            <Icon name="storefront-outline" size={40} color={colors.muted} />
            <Text style={styles.featTitle}>Lengkapi Toko Anda</Text>
            <Text style={[styles.featSub, { textAlign: "center" }]}>Isi detail toko agar bisa mulai berjualan.</Text>
            <Button testID="setup-store-btn" title="Atur Toko" small onPress={() => router.push("/seller/store")} />
          </Card>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, marginTop: -40, gap: 14 }}>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.logo}>
                {s.logo_file_id ? <Image source={{ uri: fileUrl(s.logo_file_id) }} style={{ flex: 1, borderRadius: 14 }} contentFit="cover" /> :
                  <Icon name="storefront" size={24} color={colors.brandPrimary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{s.name}</Text>
                <Text style={styles.storeTag} numberOfLines={1}>{s.tagline || s.category}</Text>
              </View>
              <Badge label={s.is_open ? "Buka" : "Tutup"} tone={s.is_open ? "success" : "neutral"} />
            </View>
            <View style={styles.statRow}>
              <Stat icon="star" label="Rating" value={`${(s.rating || 0).toFixed(1)}`} />
              <Stat icon="cube-outline" label="Produk" value={productCount} />
              <Stat icon="time-outline" label="Jam" value={s.hours || "-"} />
            </View>
          </Card>

          <View style={styles.actions}>
            <ActionBtn icon="create-outline" label="Edit Toko" onPress={() => router.push("/seller/store")} testID="edit-store-btn" />
            <ActionBtn icon="cube-outline" label="Produk" onPress={() => router.push("/seller/products")} testID="manage-products-btn" />
            <ActionBtn icon="speedometer-outline" label="Dashboard" onPress={() => router.push("/seller")} testID="seller-dashboard-btn" />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={15} color={colors.brandSecondary} />
      <Text style={styles.statVal} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, testID }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.actionIcon}><Icon name={icon} size={20} color={colors.brandPrimary} /></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  hero: { backgroundColor: c.brandPrimary, alignItems: "center", paddingHorizontal: 24, paddingBottom: 28, gap: 8 },
  heroIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: c.onBrandPrimary, marginTop: 6 },
  heroSub: { fontSize: 14, color: c.onBrandPrimary, opacity: 0.9, textAlign: "center", lineHeight: 20 },
  featIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  featTitle: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  featSub: { fontSize: 13, color: c.muted, marginTop: 2 },
  cover: { height: 150, backgroundColor: c.surfaceTertiary },
  coverImg: { flex: 1 },
  coverOverlay: { ...{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0 }, backgroundColor: "rgba(0,0,0,0.12)" },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  storeName: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  storeTag: { fontSize: 13, color: c.muted, marginTop: 2 },
  statRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, marginTop: 2 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statVal: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  statLabel: { fontSize: 11, color: c.muted },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 14, alignItems: "center", gap: 8 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12, fontWeight: "600", color: c.onSurface },
}));
