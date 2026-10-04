import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, Badge, Loading, EmptyState } from "@/src/components/ui";
import { api, fileUrl } from "@/src/api/client";
import { PRODUCT_STATUS, rupiah } from "@/src/constants";

export default function StoreDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({ queryKey: ["store", id], queryFn: () => api.get(`/market/stores/${id}`) });
  const cart = useQuery({ queryKey: ["cart"], queryFn: () => api.get("/market/cart") });

  if (q.isLoading) return <Loading />;
  const store = q.data?.store;
  const products = q.data?.products || [];
  const cover = fileUrl(store?.cover_file_id);
  const cartCount = (cart.data || []).reduce((s: number, g: any) => s + g.items.reduce((a: number, i: any) => a + i.qty, 0), 0);

  return (
    <View style={styles.root}>
      <FlatList
        data={products}
        keyExtractor={(p: any) => p.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        ListHeaderComponent={
          <View>
            <View style={styles.cover}>
              {cover ? <Image source={{ uri: cover }} style={{ flex: 1 }} contentFit="cover" /> :
                <LinearGradient colors={[colors.brandPrimary, "#0B7A3F"]} style={{ flex: 1 }} />}
              <LinearGradient colors={["rgba(0,0,0,0.3)", "transparent"]} style={styles.topScrim} />
              <Pressable testID="header-back" onPress={() => router.back()} style={[styles.backFloat, { top: insets.top + 8 }]}>
                <Icon name="arrow-back" size={22} color={"#FFF"} />
              </Pressable>
            </View>
            <View style={styles.info}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={styles.name}>{store?.name}</Text>
                <Badge label={store?.is_open ? "Buka" : "Tutup"} tone={store?.is_open ? "success" : "neutral"} />
              </View>
              <Text style={styles.tag}>{store?.tagline}</Text>
              <Text style={styles.desc}>{store?.description}</Text>
              <View style={styles.metaRow}>
                <Meta icon="star" text={`${(store?.rating || 0).toFixed(1)} (${store?.rating_count || 0})`} />
                <Meta icon="time-outline" text={store?.hours || "—"} />
                <Meta icon="bicycle-outline" text={store?.delivery_range || "—"} />
              </View>
              <View style={styles.payRow}>
                {store?.supports_cod ? <Badge label="COD" tone="brand" /> : null}
                {store?.supports_qris ? <Badge label="QRIS" tone="brand" /> : null}
              </View>
              {!store?.is_open ? (
                <View style={styles.closedNote}>
                  <Icon name="information-circle" size={16} color={colors.warning} />
                  <Text style={styles.closedText}>Toko sedang tutup. Anda belum bisa memesan.</Text>
                </View>
              ) : null}
              <Text style={styles.sectionTitle}>Produk</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const ps = PRODUCT_STATUS[item.status];
          const sold = item.status === "SOLD_OUT" || item.status === "INACTIVE";
          const photo = fileUrl(item.photo_file_id);
          return (
            <Pressable testID={`product-${item.id}`} onPress={() => router.push(`/product/${item.id}`)}
              style={[styles.product, sold && { opacity: 0.55 }]}>
              <View style={styles.pPhoto}>
                {photo ? <Image source={{ uri: photo }} style={{ flex: 1 }} contentFit="cover" /> :
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }}>
                    <Icon name="fast-food-outline" size={26} color={colors.muted} />
                  </View>}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.pName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.pDesc} numberOfLines={2}>{item.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <Text style={styles.price}>{rupiah(item.price)}</Text>
                  {ps && item.status !== "AVAILABLE" ? <Badge label={ps.label} tone={ps.tone} /> : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="Belum ada produk" />}
      />

      {cartCount > 0 ? (
        <Pressable testID="view-cart-btn" onPress={() => router.push("/cart")} style={[styles.cartBar, { bottom: insets.bottom + 12 }]}>
          <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
          <Text style={styles.cartBarText}>Lihat Keranjang</Text>
          <Icon name="arrow-forward" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text style={{ fontSize: 12, color: colors.onSurfaceSecondary }}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  cover: { height: 180, backgroundColor: c.surfaceTertiary },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 100 },
  backFloat: { position: "absolute", left: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  info: { padding: 16, gap: 6, borderBottomWidth: 8, borderBottomColor: c.surfaceSecondary },
  name: { fontSize: 22, fontWeight: "700", color: c.onSurface },
  tag: { fontSize: 14, color: c.onSurfaceSecondary },
  desc: { fontSize: 13, color: c.muted, lineHeight: 19 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  payRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  closedNote: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF3DC", padding: 10, borderRadius: 10, marginTop: 8 },
  closedText: { fontSize: 13, color: c.warning, flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: c.onSurface, marginTop: 12 },
  product: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.divider },
  pPhoto: { width: 76, height: 76, borderRadius: 12, overflow: "hidden" },
  pName: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  pDesc: { fontSize: 13, color: c.muted },
  price: { fontSize: 15, fontWeight: "700", color: c.brandPrimary },
  cartBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.brandPrimary, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14 },
  cartBadge: { backgroundColor: "rgba(255,255,255,0.25)", minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  cartBadgeText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  cartBarText: { flex: 1, color: c.onBrandPrimary, fontWeight: "600", fontSize: 15 },
}));
