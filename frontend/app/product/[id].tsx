import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, Badge, Loading, Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl } from "@/src/api/client";
import { PRODUCT_STATUS, rupiah } from "@/src/constants";

export default function ProductDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState<string | null>(null);
  const [addons, setAddons] = useState<string[]>([]);

  const q = useQuery({ queryKey: ["product", id], queryFn: () => api.get(`/market/products/${id}`) });

  const add = useMutation({
    mutationFn: () => api.post("/market/cart", { product_id: id, qty, variant, addons }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast("Ditambahkan ke keranjang", "success");
      router.back();
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (q.isLoading) return <Loading />;
  const p = q.data?.product;
  const store = q.data?.store;
  const ps = PRODUCT_STATUS[p?.status];
  const sold = p?.status === "SOLD_OUT" || p?.status === "INACTIVE";
  const photo = fileUrl(p?.photo_file_id);

  let unit = p?.price || 0;
  (p?.variants || []).forEach((v: any) => { if (v.name === variant) unit += v.price_delta; });
  const addonMap: Record<string, number> = {};
  (p?.addons || []).forEach((a: any) => (addonMap[a.name] = a.price));
  addons.forEach((a) => (unit += addonMap[a] || 0));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.photo}>
          {photo ? <Image source={{ uri: photo }} style={{ flex: 1 }} contentFit="cover" /> :
            <LinearGradient colors={[colors.brandTertiary, colors.surfaceTertiary]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Icon name="fast-food-outline" size={48} color={colors.muted} />
            </LinearGradient>}
          <Pressable testID="header-back" onPress={() => router.back()} style={[styles.backFloat, { top: insets.top + 8 }]}>
            <Icon name="arrow-back" size={22} color={"#FFF"} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{p?.name}</Text>
          <Text style={styles.store}>{store?.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
            <Text style={styles.price}>{rupiah(p?.price)}</Text>
            {ps ? <Badge label={ps.label} tone={ps.tone} /> : null}
          </View>
          <Text style={styles.desc}>{p?.description}</Text>

          {(p?.variants?.length || 0) > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Varian</Text>
              {p.variants.map((v: any) => (
                <Pressable key={v.name} testID={`variant-${v.name}`} onPress={() => setVariant(variant === v.name ? null : v.name)} style={styles.option}>
                  <Icon name={variant === v.name ? "radio-button-on" : "radio-button-off"} size={20} color={variant === v.name ? colors.brandPrimary : colors.muted} />
                  <Text style={styles.optLabel}>{v.name}</Text>
                  {v.price_delta ? <Text style={styles.optPrice}>+{rupiah(v.price_delta)}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {(p?.addons?.length || 0) > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Tambahan</Text>
              {p.addons.map((a: any) => {
                const on = addons.includes(a.name);
                return (
                  <Pressable key={a.name} testID={`addon-${a.name}`} onPress={() => setAddons(on ? addons.filter((x) => x !== a.name) : [...addons, a.name])} style={styles.option}>
                    <Icon name={on ? "checkbox" : "square-outline"} size={20} color={on ? colors.brandPrimary : colors.muted} />
                    <Text style={styles.optLabel}>{a.name}</Text>
                    <Text style={styles.optPrice}>+{rupiah(a.price)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.qtyRow}>
            <Text style={styles.groupTitle}>Jumlah</Text>
            <View style={styles.qtyCtrl}>
              <Pressable testID="qty-minus" onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn}><Icon name="remove" size={18} /></Pressable>
              <Text testID="qty-value" style={styles.qtyVal}>{qty}</Text>
              <Pressable testID="qty-plus" onPress={() => setQty(qty + 1)} style={styles.qtyBtn}><Icon name="add" size={18} /></Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="add-to-cart-btn" title={sold ? "Stok Habis" : `Tambah · ${rupiah(unit * qty)}`}
          icon={sold ? undefined : "cart"} disabled={sold} loading={add.isPending} onPress={() => add.mutate()} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  photo: { height: 260, backgroundColor: c.surfaceTertiary },
  backFloat: { position: "absolute", left: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 6 },
  name: { fontSize: 22, fontWeight: "700", color: c.onSurface },
  store: { fontSize: 14, color: c.muted },
  price: { fontSize: 20, fontWeight: "700", color: c.brandPrimary },
  desc: { fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 20, marginTop: 6 },
  group: { marginTop: 16, gap: 4 },
  groupTitle: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  option: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  optLabel: { flex: 1, fontSize: 14, color: c.onSurface },
  optPrice: { fontSize: 13, color: c.muted },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  qtyCtrl: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: c.surfaceSecondary, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  qtyVal: { fontSize: 16, fontWeight: "700", color: c.onSurface, minWidth: 20, textAlign: "center" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
