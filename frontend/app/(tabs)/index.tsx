import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, Loading, Avatar } from "@/src/components/ui";
import { Logo } from "@/src/components/Logo";
import { useAuth } from "@/src/auth/auth";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl } from "@/src/api/client";
import { rupiah } from "@/src/constants";

const CATEGORIES = [
  { key: "Makanan", label: "Makanan", icon: "fast-food" },
  { key: "Sembako", label: "Sembako", icon: "basket" },
  { key: "Fashion", label: "Fashion", icon: "shirt" },
  { key: "Rumah", label: "Rumah\ndan Taman", icon: "home" },
  { key: "Jasa", label: "Jasa", icon: "construct" },
  { key: "Tanaman", label: "Tanaman", icon: "leaf" },
  { key: "Semua", label: "Lainnya", icon: "grid" },
];

export default function Beranda() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const [cat, setCat] = useState("Semua");

  const community = useQuery({
    queryKey: ["community", user?.active_community_id],
    queryFn: () => api.get(`/communities/${user?.active_community_id}`),
    enabled: !!user?.active_community_id,
  });
  const stores = useQuery({ queryKey: ["stores-all"], queryFn: () => api.get("/market/stores?q=&category=Semua") });
  const products = useQuery({ queryKey: ["products-all"], queryFn: () => api.get("/market/search?q=") });
  const unread = useQuery({ queryKey: ["unread"], queryFn: () => api.get("/notifications/unread-count") });

  const addToCart = useMutation({
    mutationFn: (pid: string) => api.post("/market/cart", { product_id: pid, qty: 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cart"] }); toast("Ditambahkan ke keranjang", "success"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const storeMap = useMemo(() => {
    const m: Record<string, any> = {};
    (stores.data || []).forEach((s: any) => { m[s.id] = s; });
    return m;
  }, [stores.data]);

  const openStores = useMemo(() => (stores.data || [])
    .filter((s: any) => s.is_open)
    .filter((s: any) => cat === "Semua" || s.category === cat), [stores.data, cat]);

  const recommended = useMemo(() => (products.data || [])
    .filter((p: any) => cat === "Semua" || p.category === cat)
    .slice(0, 8), [products.data, cat]);

  const avatar = fileUrl(user?.avatar_file_id);
  const unreadCount = unread.data?.count || 0;

  return (
    <View style={styles.root}>
      {/* Sticky app bar */}
      <View style={[styles.appbar, { paddingTop: insets.top + 8 }]}>
        <Logo size={40} />
        <View style={{ flex: 1 }} />
        <Pressable testID="notifications-btn" onPress={() => router.push("/notifications")} style={styles.bell}>
          <Icon name="notifications-outline" size={22} />
          {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View> : null}
        </Pressable>
        <Pressable testID="profile-chip" onPress={() => router.push("/(tabs)/akun")} style={styles.profile}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.profileImg} contentFit="cover" /> : <Avatar name={user?.name} size={36} />}
          <View>
            <Text style={styles.hello}>Halo,</Text>
            <Text style={styles.helloName} numberOfLines={1}>{(user?.name || "Warga").split(" ")[0]}</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={stores.isFetching || products.isFetching}
          onRefresh={() => { stores.refetch(); products.refetch(); community.refetch(); }} tintColor={colors.brandPrimary} />}>

        {/* Active community */}
        <Pressable testID="active-community-card" onPress={() => router.push("/community/select")} style={styles.commCard}>
          <View style={styles.commThumb}><Icon name="business" size={24} color={colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.commLabel}>Komunitas Aktif</Text>
            <Text testID="active-community-name" style={styles.commName} numberOfLines={1}>{community.data?.name || "Pilih Komunitas"}</Text>
            <Text style={styles.commMeta}>{(stores.data?.length ?? 0)} toko • {community.data?.member_count ?? 0} anggota</Text>
          </View>
          <Icon name="chevron-down" size={20} color={colors.muted} />
        </Pressable>

        {/* Search */}
        <Pressable testID="search-bar" onPress={() => router.push("/community/select")} style={styles.search}>
          <Icon name="search" size={20} color={colors.muted} />
          <Text style={styles.searchPlaceholder}>Cari produk, toko, atau jasa...</Text>
          <Icon name="scan-outline" size={20} color={colors.brandPrimary} />
        </Pressable>

        {/* Promo banner */}
        <LinearGradient colors={["#0B7A3F", colors.brandPrimary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Belanja{"\n"}Lebih Dekat{"\n"}Lebih Bermakna</Text>
            <Text style={styles.bannerSub}>Dukung usaha warga, kuatkan komunitas kita.</Text>
          </View>
          <View style={styles.bannerArt}>
            <Text style={styles.bannerScript}>Dari{"\n"}Warga{"\n"}Untuk{"\n"}Warga</Text>
            <Icon name="heart" size={16} color={colors.onBrandPrimary} />
          </View>
        </LinearGradient>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingVertical: 4 }}>
          {CATEGORIES.map((c) => {
            const sel = c.key === cat;
            return (
              <Pressable key={c.label} testID={`cat-${c.key}`} onPress={() => setCat(c.key)} style={styles.catItem}>
                <View style={[styles.catIcon, sel && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                  <Icon name={c.icon} size={24} color={sel ? colors.onBrandPrimary : colors.brandPrimary} />
                </View>
                <Text style={styles.catLabel}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Promo cards */}
        <View style={styles.promoRow}>
          <View style={[styles.promo, { backgroundColor: "#FDECE3" }]}>
            <View style={[styles.promoIcon, { backgroundColor: colors.brandSecondary }]}><Icon name="pricetag" size={18} color={colors.onBrandSecondary} /></View>
            <Text style={[styles.promoTitle, { color: colors.brandSecondary }]}>Promo Hari Ini</Text>
            <Text style={styles.promoSub}>Produk pilihan dengan harga spesial untuk warga</Text>
          </View>
          <View style={[styles.promo, { backgroundColor: colors.brandTertiary }]}>
            <View style={[styles.promoIcon, { backgroundColor: colors.brandPrimary }]}><Icon name="bicycle" size={18} color={colors.onBrandPrimary} /></View>
            <Text style={[styles.promoTitle, { color: colors.onBrandTertiary }]}>Toko Terdekat</Text>
            <Text style={styles.promoSub}>Lihat toko yang sedang buka di sekitar Anda</Text>
          </View>
        </View>

        {/* Toko Sedang Buka */}
        <SectionHead icon="storefront" title="Toko Sedang Buka" onMore={() => router.push("/community/select")} />
        {stores.isLoading ? <Loading /> : openStores.length === 0 ? (
          <Text style={styles.emptyRow}>Belum ada toko yang buka.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {openStores.map((s: any) => (
              <Pressable key={s.id} testID={`store-${s.id}`} onPress={() => router.push(`/store/${s.id}`)} style={styles.storeCard}>
                <View style={styles.storeCover}>
                  {s.cover_file_id ? <Image source={{ uri: fileUrl(s.cover_file_id) }} style={{ flex: 1 }} contentFit="cover" /> :
                    <LinearGradient colors={[colors.brandPrimary, "#0B7A3F"]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Icon name="storefront" size={30} color="#FFFFFF" /></LinearGradient>}
                  <View style={styles.openBadge}><Text style={styles.openBadgeText}>Buka</Text></View>
                </View>
                <View style={{ padding: 10, gap: 3 }}>
                  <Text style={styles.storeName} numberOfLines={1}>{s.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Icon name="star" size={12} color={colors.brandSecondary} />
                    <Text style={styles.storeMeta}>{(s.rating || 0).toFixed(1)} ({s.rating_count || 0})</Text>
                  </View>
                  <Text style={styles.storeMeta} numberOfLines={1}>{s.category}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Rekomendasi */}
        <SectionHead icon="star" iconColor={colors.brandSecondary} title="Rekomendasi untuk Anda" onMore={() => router.push("/community/select")} />
        {products.isLoading ? <Loading /> : recommended.length === 0 ? (
          <Text style={styles.emptyRow}>Belum ada produk.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {recommended.map((p: any) => (
              <Pressable key={p.id} testID={`product-${p.id}`} onPress={() => router.push(`/product/${p.id}`)} style={styles.prodCard}>
                <View style={styles.prodImg}>
                  {p.photo_file_id ? <Image source={{ uri: fileUrl(p.photo_file_id) }} style={{ flex: 1 }} contentFit="cover" /> :
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }}><Icon name="fast-food-outline" size={28} color={colors.muted} /></View>}
                </View>
                <View style={{ padding: 10, gap: 2 }}>
                  <Text style={styles.prodName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.prodPrice}>{rupiah(p.price)}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={styles.prodStore} numberOfLines={1}>{storeMap[p.store_id]?.name || "Toko"}</Text>
                    <Pressable testID={`add-${p.id}`} onPress={() => addToCart.mutate(p.id)} disabled={p.status === "SOLD_OUT"}
                      style={[styles.addBtn, { opacity: p.status === "SOLD_OUT" ? 0.4 : 1 }]}>
                      <Icon name="add" size={18} color={colors.onBrandPrimary} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHead({ icon, iconColor, title, onMore }: { icon: string; iconColor?: string; title: string; onMore: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHead}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={icon} size={20} color={iconColor || colors.brandPrimary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Pressable onPress={onMore} style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={styles.more}>Lihat Semua</Text>
        <Icon name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  appbar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  bell: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 1.5, borderColor: c.surface },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  profile: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 130 },
  profileImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceTertiary },
  hello: { fontSize: 11, color: c.muted },
  helloName: { fontSize: 15, fontWeight: "700", color: c.onSurface },

  commCard: { flexDirection: "row", alignItems: "center", gap: 12, margin: 16, marginBottom: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  commThumb: { width: 54, height: 54, borderRadius: 12, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  commLabel: { fontSize: 12, color: c.muted },
  commName: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  commMeta: { fontSize: 12, color: c.muted, marginTop: 1 },

  search: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, paddingHorizontal: 14, height: 48, borderRadius: 14, backgroundColor: c.surfaceSecondary },
  searchPlaceholder: { flex: 1, fontSize: 14, color: c.muted },

  banner: { flexDirection: "row", margin: 16, borderRadius: 18, padding: 18, minHeight: 150, overflow: "hidden" },
  bannerTitle: { fontSize: 24, fontWeight: "800", color: c.onBrandPrimary, lineHeight: 30 },
  bannerSub: { fontSize: 13, color: c.onBrandPrimary, opacity: 0.92, marginTop: 10, lineHeight: 18 },
  bannerArt: { alignItems: "flex-end", justifyContent: "center", gap: 4 },
  bannerScript: { fontSize: 18, fontWeight: "800", fontStyle: "italic", color: c.onBrandPrimary, textAlign: "right", lineHeight: 22, opacity: 0.95 },

  catItem: { alignItems: "center", gap: 6, width: 64 },
  catIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: c.brandTertiary, borderWidth: 1, borderColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  catLabel: { fontSize: 11, color: c.onSurfaceSecondary, textAlign: "center", fontWeight: "500" },

  promoRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 14 },
  promo: { flex: 1, borderRadius: 14, padding: 14, gap: 6 },
  promoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  promoTitle: { fontSize: 14, fontWeight: "800" },
  promoSub: { fontSize: 11, color: c.onSurfaceSecondary, lineHeight: 15 },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: c.onSurface },
  more: { fontSize: 13, color: c.muted, fontWeight: "500" },
  emptyRow: { paddingHorizontal: 16, fontSize: 13, color: c.muted },

  storeCard: { width: 160, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" },
  storeCover: { height: 100, backgroundColor: c.surfaceTertiary },
  openBadge: { position: "absolute", top: 8, left: 8, backgroundColor: c.brandPrimary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  openBadgeText: { color: c.onBrandPrimary, fontSize: 11, fontWeight: "700" },
  storeName: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  storeMeta: { fontSize: 12, color: c.muted },

  prodCard: { width: 150, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" },
  prodImg: { height: 110, backgroundColor: c.surfaceTertiary },
  prodName: { fontSize: 13, fontWeight: "600", color: c.onSurface, minHeight: 34 },
  prodPrice: { fontSize: 15, fontWeight: "800", color: c.brandPrimary },
  prodStore: { fontSize: 11, color: c.muted, flex: 1 },
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
