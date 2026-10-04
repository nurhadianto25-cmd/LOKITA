import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, EmptyState, Button, Badge } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl } from "@/src/api/client";
import { rupiah } from "@/src/constants";

export default function Cart() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const cart = useQuery({ queryKey: ["cart"], queryFn: () => api.get("/market/cart") });

  const setQty = useMutation({
    mutationFn: ({ id, qty }: any) => api.put(`/market/cart/${id}`, { qty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e: any) => toast(e.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/market/cart/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (cart.isLoading) return <View style={styles.root}><ScreenHeader title="Keranjang" /><Loading /></View>;
  const groups = cart.data || [];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Keranjang" />
      {groups.length === 0 ? (
        <EmptyState icon="cart-outline" title="Keranjang kosong" subtitle="Tambahkan produk dari toko untuk mulai memesan."
          action={<Button title="Jelajahi Toko" onPress={() => router.replace("/(tabs)")} />} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
          {groups.map((g: any) => (
            <View key={g.store_id} style={styles.group}>
              <View style={styles.groupHead}>
                <Icon name="storefront" size={18} color={colors.brandPrimary} />
                <Text style={styles.storeName}>{g.store_name}</Text>
                {!g.is_open ? <Badge label="Tutup" tone="neutral" /> : null}
              </View>
              {g.items.map((it: any) => {
                const photo = fileUrl(it.photo_file_id);
                return (
                  <View key={it.id} style={styles.item}>
                    <View style={styles.photo}>
                      {photo ? <Image source={{ uri: photo }} style={{ flex: 1 }} contentFit="cover" /> :
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }}>
                          <Icon name="fast-food-outline" size={20} color={colors.muted} /></View>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                      {it.variant ? <Text style={styles.itemVar}>{it.variant}</Text> : null}
                      <Text style={styles.itemPrice}>{rupiah(it.unit_price)}</Text>
                    </View>
                    <View style={styles.qtyCtrl}>
                      <Pressable testID={`minus-${it.id}`} onPress={() => it.qty > 1 ? setQty.mutate({ id: it.id, qty: it.qty - 1 }) : remove.mutate(it.id)} style={styles.qtyBtn}>
                        <Icon name={it.qty > 1 ? "remove" : "trash-outline"} size={16} color={it.qty > 1 ? colors.onSurface : colors.error} /></Pressable>
                      <Text style={styles.qtyVal}>{it.qty}</Text>
                      <Pressable testID={`plus-${it.id}`} onPress={() => setQty.mutate({ id: it.id, qty: it.qty + 1 })} style={styles.qtyBtn}><Icon name="add" size={16} /></Pressable>
                    </View>
                  </View>
                );
              })}
              <View style={styles.groupFoot}>
                <Text style={styles.subtotal}>Subtotal: <Text style={{ fontWeight: "700", color: colors.onSurface }}>{rupiah(g.subtotal)}</Text></Text>
              </View>
              <Button testID={`checkout-${g.store_id}`} title={g.is_open ? "Checkout Toko Ini" : "Toko Tutup"} disabled={!g.is_open}
                icon="arrow-forward" small onPress={() => router.push(`/checkout?store_id=${g.store_id}`)} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  group: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  storeName: { fontSize: 16, fontWeight: "700", color: c.onSurface, flex: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 56, height: 56, borderRadius: 10, overflow: "hidden" },
  itemName: { fontSize: 14, fontWeight: "600", color: c.onSurface },
  itemVar: { fontSize: 12, color: c.muted },
  itemPrice: { fontSize: 14, color: c.brandPrimary, fontWeight: "600", marginTop: 2 },
  qtyCtrl: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  qtyVal: { fontSize: 15, fontWeight: "700", color: c.onSurface, minWidth: 16, textAlign: "center" },
  groupFoot: { borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 10 },
  subtotal: { fontSize: 14, color: c.muted },
}));
