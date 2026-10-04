import React, { useState } from "react";
import { View, Text, FlatList, Pressable, ScrollView, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, Input, Loading, EmptyState, Badge } from "@/src/components/ui";
import { useAuth } from "@/src/auth/auth";
import { api, fileUrl } from "@/src/api/client";
import { CATEGORY_ICONS } from "@/src/constants";

export default function Beranda() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");

  const community = useQuery({
    queryKey: ["community", user?.active_community_id],
    queryFn: () => api.get(`/communities/${user?.active_community_id}`),
    enabled: !!user?.active_community_id,
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api.get("/market/categories") });
  const stores = useQuery({
    queryKey: ["stores", q, cat],
    queryFn: () => api.get(`/market/stores?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`),
  });
  const activeOrders = useQuery({ queryKey: ["buyer-orders-active"], queryFn: () => api.get("/orders/buyer?scope=active") });
  const unread = useQuery({ queryKey: ["unread"], queryFn: () => api.get("/notifications/unread-count") });

  const cats: string[] = categories.data || ["Semua"];
  const activeCount = activeOrders.data?.length || 0;

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Komunitas</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="location" size={16} color={colors.brandPrimary} />
              <Text testID="active-community-name" style={styles.community} numberOfLines={1}>
                {community.data?.name || "Memuat..."}
              </Text>
            </View>
          </View>
          <Pressable testID="notifications-btn" onPress={() => router.push("/notifications")} style={styles.bell}>
            <Icon name="notifications-outline" size={22} />
            {(unread.data?.count || 0) > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Icon name="search" size={18} color={colors.muted} />
          <Input testID="search-input" value={q} onChangeText={setQ} placeholder="Cari toko atau produk..."
            style={styles.searchInput} returnKeyType="search" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={styles.chipRow}>
          {cats.map((c) => {
            const sel = c === cat;
            return (
              <Pressable key={c} testID={`cat-${c}`} onPress={() => setCat(c)}
                style={[styles.chip, { backgroundColor: sel ? colors.brandPrimary : colors.surfaceSecondary, borderColor: sel ? colors.brandPrimary : colors.border }]}>
                <Ionicon name={CATEGORY_ICONS[c] || "pricetag-outline"} sel={sel} />
                <Text style={{ color: sel ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontSize: 13, fontWeight: "500" }}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={stores.data || []}
        keyExtractor={(s: any) => s.id}
        contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: insets.bottom + 90, gap: 14 }}
        refreshControl={<RefreshControl refreshing={stores.isFetching} onRefresh={() => { stores.refetch(); categories.refetch(); }} tintColor={colors.brandPrimary} />}
        renderItem={({ item }) => <StoreCard store={item} onPress={() => router.push(`/store/${item.id}`)} />}
        ListEmptyComponent={stores.isLoading ? <Loading /> :
          <EmptyState icon="storefront-outline" title="Belum ada toko"
            subtitle="Belum ada penjual di komunitas ini. Ajak tetangga Anda berjualan!" />}
      />

      {activeCount > 0 ? (
        <Pressable testID="active-orders-fab" onPress={() => router.push("/(tabs)/pesanan")}
          style={[styles.fab, { bottom: insets.bottom + 76 }]}>
          <Icon name="bag-check" size={18} color={colors.onBrandSecondary} />
          <Text style={styles.fabText}>{activeCount} pesanan aktif</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Ionicon({ name, sel }: { name: string; sel: boolean }) {
  const { colors } = useTheme();
  return <Icon name={name} size={15} color={sel ? colors.onBrandPrimary : colors.onSurfaceSecondary} />;
}

function StoreCard({ store, onPress }: { store: any; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const cover = fileUrl(store.cover_file_id);
  return (
    <Pressable testID={`store-${store.id}`} onPress={onPress} style={styles.card}>
      <View style={styles.cover}>
        {cover ? (
          <Image source={{ uri: cover }} style={{ flex: 1 }} contentFit="cover" />
        ) : (
          <LinearGradient colors={[colors.brandPrimary, "#0B7A3F"]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Icon name="storefront" size={38} color={"#FFFFFF"} />
          </LinearGradient>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={styles.scrim} />
        <View style={styles.coverBottom}>
          <Badge label={store.is_open ? "Buka" : "Tutup"} tone={store.is_open ? "success" : "neutral"} />
        </View>
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
        </View>
        <Text style={styles.storeTag} numberOfLines={1}>{store.tagline || store.description}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="star" size={13} color={colors.brandSecondary} />
            <Text style={styles.meta}>{(store.rating || 0).toFixed(1)}</Text>
          </View>
          <Text style={styles.meta}>· {store.category}</Text>
          <Text style={styles.meta}>· {store.product_count || 0} produk</Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  hello: { fontSize: 12, color: c.muted },
  community: { fontSize: 18, fontWeight: "700", color: c.onSurface, maxWidth: 240 },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: c.brandSecondary, borderWidth: 1.5, borderColor: c.surface },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, paddingHorizontal: 12, backgroundColor: c.surfaceTertiary, borderRadius: 12 },
  searchInput: { flex: 1, backgroundColor: "transparent", paddingHorizontal: 0 },
  chipRow: { marginTop: 12, maxHeight: 40 },
  chip: { height: 36, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  card: { backgroundColor: c.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: c.border },
  cover: { height: 130, backgroundColor: c.surfaceTertiary },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 60 },
  coverBottom: { position: "absolute", left: 10, bottom: 10 },
  storeName: { fontSize: 16, fontWeight: "700", color: c.onSurface, flex: 1 },
  storeTag: { fontSize: 13, color: c.muted },
  meta: { fontSize: 12, color: c.onSurfaceSecondary },
  fab: { position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.brandSecondary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabText: { color: c.onBrandSecondary, fontWeight: "600", fontSize: 14 },
}));
