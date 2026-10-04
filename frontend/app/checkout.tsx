import React, { useState, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Button, Input, Field, Card } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { rupiah } from "@/src/constants";

export default function Checkout() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { store_id } = useLocalSearchParams<{ store_id: string }>();

  const cart = useQuery({ queryKey: ["cart"], queryFn: () => api.get("/market/cart") });
  const storeQ = useQuery({ queryKey: ["store", store_id], queryFn: () => api.get(`/market/stores/${store_id}`) });

  const [method, setMethod] = useState<"COD" | "QRIS">("COD");
  const [titip, setTitip] = useState(false);
  const [titipLoc, setTitipLoc] = useState("");
  const [titipNotes, setTitipNotes] = useState("");
  const [note, setNote] = useState("");
  const [window, setWindow] = useState<string | null>(null);

  const group = useMemo(() => (cart.data || []).find((g: any) => g.store_id === store_id), [cart.data, store_id]);
  const store = storeQ.data?.store;

  const place = useMutation({
    mutationFn: () => api.post("/orders/checkout", {
      store_id, payment_method: method, delivery_window: window, delivery_note: note,
      titip_allowed: titip, titip_location: titipLoc, titip_notes: titipNotes,
    }),
    onSuccess: (o: any) => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      router.replace(`/order/${o.id}`);
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (cart.isLoading || storeQ.isLoading) return <View style={styles.root}><ScreenHeader title="Checkout" /><Loading /></View>;
  if (!group) return <View style={styles.root}><ScreenHeader title="Checkout" /><Text style={{ padding: 24, color: colors.muted }}>Keranjang kosong.</Text></View>;

  const windows: string[] = store?.delivery_windows || [];
  const modeB = store?.delivery_mode === "B" && windows.length > 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Checkout" subtitle={group.store_name} />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 14 }}>
        <Card>
          <Text style={styles.cardTitle}>Ringkasan Pesanan</Text>
          {group.items.map((it: any) => (
            <View key={it.id} style={styles.sumRow}>
              <Text style={styles.sumItem} numberOfLines={1}>{it.qty}× {it.name}</Text>
              <Text style={styles.sumPrice}>{rupiah(it.line_total)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.sumRow}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.total}>{rupiah(group.subtotal)}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Metode Pembayaran</Text>
          <PayOption active={method === "COD"} disabled={!group.supports_cod} icon="cash-outline" label="Tunai / COD"
            desc={group.supports_cod ? "Bayar saat pesanan tiba" : "Toko tidak menerima COD"} onPress={() => setMethod("COD")} testID="pay-cod" />
          <PayOption active={method === "QRIS"} disabled={!group.supports_qris} icon="qr-code-outline" label="QRIS"
            desc={group.supports_qris ? "Scan QRIS penjual" : "Toko tidak menerima QRIS"} onPress={() => setMethod("QRIS")} testID="pay-qris" />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Pengiriman</Text>
          {modeB ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.hint}>Pilih jadwal pengiriman penjual</Text>
              {windows.map((w) => (
                <Pressable key={w} testID={`window-${w}`} onPress={() => setWindow(w)} style={styles.radio}>
                  <Icon name={window === w ? "radio-button-on" : "radio-button-off"} size={20} color={window === w ? colors.brandPrimary : colors.muted} />
                  <Text style={styles.radioLabel}>{w}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>Pengiriman oleh penjual sesuai jam operasional ({store?.hours || "—"}).</Text>
          )}
          <View style={{ height: 10 }} />
          <Field label="Catatan untuk penjual (opsional)">
            <Input testID="delivery-note" value={note} onChangeText={setNote} placeholder="mis. patokan rumah, warna pagar..." />
          </Field>
        </Card>

        <Card>
          <Pressable testID="titip-toggle" onPress={() => setTitip(!titip)} style={styles.titipHead}>
            <Icon name={titip ? "checkbox" : "square-outline"} size={22} color={titip ? colors.brandPrimary : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Izinkan Dititipkan</Text>
              <Text style={styles.hint}>Penjual boleh menitipkan pesanan jika Anda tidak di rumah (dengan foto bukti).</Text>
            </View>
          </Pressable>
          {titip ? (
            <View style={{ gap: 10, marginTop: 10 }}>
              <Field label="Lokasi penitipan">
                <Input testID="titip-location" value={titipLoc} onChangeText={setTitipLoc} placeholder="mis. teras, rak depan, pos satpam" />
              </Field>
              <Field label="Catatan penitipan (opsional)">
                <Input testID="titip-notes" value={titipNotes} onChangeText={setTitipNotes} placeholder="mis. letakkan di kursi teras" />
              </Field>
            </View>
          ) : null}
        </Card>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="place-order-btn" title={`Buat Pesanan · ${rupiah(group.subtotal)}`} loading={place.isPending}
          onPress={() => { if (titip && !titipLoc.trim()) return toast("Isi lokasi penitipan", "error"); place.mutate(); }} />
      </View>
    </View>
  );
}

function PayOption({ active, disabled, icon, label, desc, onPress, testID }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress}
      style={[styles.pay, { borderColor: active ? colors.brandPrimary : colors.border, opacity: disabled ? 0.45 : 1 }]}>
      <Icon name={icon} size={22} color={active ? colors.brandPrimary : colors.onSurfaceSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.payLabel}>{label}</Text>
        <Text style={styles.hint}>{desc}</Text>
      </View>
      <Icon name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? colors.brandPrimary : colors.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  cardTitle: { fontSize: 15, fontWeight: "700", color: c.onSurface, marginBottom: 6 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 10 },
  sumItem: { fontSize: 14, color: c.onSurfaceSecondary, flex: 1 },
  sumPrice: { fontSize: 14, color: c.onSurface },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: 8 },
  total: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  hint: { fontSize: 13, color: c.muted, lineHeight: 18 },
  pay: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: 12, padding: 12, marginTop: 8 },
  payLabel: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  radio: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  radioLabel: { fontSize: 14, color: c.onSurface },
  titipHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
