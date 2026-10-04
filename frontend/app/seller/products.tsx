import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, EmptyState, Badge } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl } from "@/src/api/client";
import { PRODUCT_STATUS, rupiah } from "@/src/constants";

export default function SellerProducts() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["my-products"], queryFn: () => api.get("/seller/products") });

  const stock = useMutation({
    mutationFn: ({ id, stock }: any) => api.put(`/seller/products/${id}/stock`, { stock }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-products"] }),
    onError: (e: any) => toast(e.message, "error"),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/seller/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-products"] }); toast("Produk dihapus", "success"); },
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Produk Saya" right={
        <Pressable testID="add-product-btn" onPress={() => router.push("/seller/product-edit")} hitSlop={8}><Icon name="add-circle" size={26} color={colors.brandPrimary} /></Pressable>
      } />
      <FlatList
        data={q.data || []}
        keyExtractor={(p: any) => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        renderItem={({ item }) => {
          const ps = PRODUCT_STATUS[item.status];
          const photo = fileUrl(item.photo_file_id);
          return (
            <View style={styles.card}>
              <Pressable testID={`edit-product-${item.id}`} onPress={() => router.push(`/seller/product-edit?id=${item.id}`)} style={styles.top}>
                <View style={styles.photo}>
                  {photo ? <Image source={{ uri: photo }} style={{ flex: 1 }} contentFit="cover" /> :
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }}><Icon name="fast-food-outline" size={22} color={colors.muted} /></View>}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.price}>{rupiah(item.price)}</Text>
                  {ps ? <Badge label={ps.label} tone={ps.tone} /> : null}
                </View>
                <Icon name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Stok</Text>
                <View style={styles.stepper}>
                  <Pressable testID={`stock-minus-${item.id}`} onPress={() => stock.mutate({ id: item.id, stock: Math.max(0, item.stock - 1) })} style={styles.stepBtn}><Icon name="remove" size={16} /></Pressable>
                  <Text style={styles.stockVal}>{item.stock}</Text>
                  <Pressable testID={`stock-plus-${item.id}`} onPress={() => stock.mutate({ id: item.id, stock: item.stock + 1 })} style={styles.stepBtn}><Icon name="add" size={16} /></Pressable>
                </View>
                <Pressable testID={`delete-product-${item.id}`} onPress={() => del.mutate(item.id)} style={styles.delBtn}><Icon name="trash-outline" size={18} color={colors.error} /></Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={q.isLoading ? <Loading /> :
          <EmptyState icon="cube-outline" title="Belum ada produk" subtitle="Tambahkan produk pertama Anda." />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  card: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 12, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 56, height: 56, borderRadius: 10, overflow: "hidden" },
  name: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  price: { fontSize: 14, color: c.brandPrimary, fontWeight: "600" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 10 },
  stockLabel: { fontSize: 13, color: c.muted, flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surfaceSecondary, borderRadius: 999, paddingHorizontal: 4, paddingVertical: 3 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  stockVal: { fontSize: 15, fontWeight: "700", color: c.onSurface, minWidth: 24, textAlign: "center" },
  delBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FDE7E7", alignItems: "center", justifyContent: "center" },
}));
