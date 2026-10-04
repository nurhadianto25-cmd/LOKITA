import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Button, Input, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl, uploadImage } from "@/src/api/client";

const CATS = ["Makanan", "Minuman", "Sayur", "Buah", "Umum"];

export default function ProductEdit() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const list = useQuery({ queryKey: ["my-products"], queryFn: () => api.get("/seller/products"), enabled: editing });
  const [f, setF] = useState<any>({ name: "", description: "", price: "", stock: "", category: "Makanan", photo_file_id: null, variants: [], addons: [] });

  useEffect(() => {
    if (editing && list.data) {
      const p = list.data.find((x: any) => x.id === id);
      if (p) setF({ ...p, price: String(p.price), stock: String(p.stock), variants: p.variants || [], addons: p.addons || [] });
    }
  }, [editing, list.data, id]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, description: f.description, price: Number(f.price) || 0, stock: Number(f.stock) || 0,
        category: f.category, photo_file_id: f.photo_file_id,
        variants: f.variants.filter((v: any) => v.name), addons: f.addons.filter((a: any) => a.name),
      };
      return editing ? api.put(`/seller/products/${id}`, body) : api.post("/seller/products", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-products"] }); toast("Produk tersimpan", "success"); router.back(); },
    onError: (e: any) => toast(e.message, "error"),
  });

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast("Izin galeri diperlukan", "error");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    try { const up = await uploadImage(res.assets[0].uri, "product"); setF((p: any) => ({ ...p, photo_file_id: up.id })); }
    catch (e: any) { toast(e.message, "error"); }
  }

  const set = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const addVariant = () => setF((p: any) => ({ ...p, variants: [...p.variants, { name: "", price_delta: 0 }] }));
  const addAddon = () => setF((p: any) => ({ ...p, addons: [...p.addons, { name: "", price: 0 }] }));

  if (editing && list.isLoading) return <View style={styles.root}><ScreenHeader title="Produk" /><Loading /></View>;

  return (
    <View style={styles.root}>
      <ScreenHeader title={editing ? "Edit Produk" : "Produk Baru"} />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 14 }}>
        <Pressable testID="product-photo" onPress={pickPhoto} style={styles.photo}>
          {f.photo_file_id ? <Image source={{ uri: fileUrl(f.photo_file_id) }} style={{ flex: 1 }} contentFit="cover" /> :
            <View style={{ alignItems: "center", gap: 6 }}><Icon name="camera-outline" size={30} color={colors.muted} /><Text style={styles.hint}>Tambah Foto Produk</Text></View>}
        </Pressable>

        <Field label="Nama Produk"><Input testID="p-name" value={f.name} onChangeText={set("name")} placeholder="mis. Nasi Goreng" /></Field>
        <Field label="Deskripsi"><Input testID="p-desc" value={f.description} onChangeText={set("description")} placeholder="Deskripsi produk" multiline style={{ minHeight: 60, textAlignVertical: "top" }} /></Field>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Harga (Rp)"><Input testID="p-price" value={f.price} onChangeText={set("price")} keyboardType="number-pad" placeholder="0" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Stok"><Input testID="p-stock" value={f.stock} onChangeText={set("stock")} keyboardType="number-pad" placeholder="0" /></Field></View>
        </View>

        <Field label="Kategori">
          <View style={styles.chips}>
            {CATS.map((c) => (
              <Pressable key={c} testID={`pcat-${c}`} onPress={() => set("category")(c)}
                style={[styles.chip, { backgroundColor: f.category === c ? colors.brandPrimary : colors.surfaceSecondary, borderColor: f.category === c ? colors.brandPrimary : colors.border }]}>
                <Text style={{ color: f.category === c ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontSize: 13 }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Varian</Text>
          <Pressable testID="add-variant" onPress={addVariant}><Icon name="add-circle-outline" size={22} color={colors.brandPrimary} /></Pressable>
        </View>
        {f.variants.map((v: any, i: number) => (
          <View key={i} style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 2 }}><Input placeholder="Nama varian" value={v.name} onChangeText={(t) => setF((p: any) => { const a = [...p.variants]; a[i] = { ...a[i], name: t }; return { ...p, variants: a }; })} /></View>
            <View style={{ flex: 1 }}><Input placeholder="+Rp" keyboardType="number-pad" value={String(v.price_delta || "")} onChangeText={(t) => setF((p: any) => { const a = [...p.variants]; a[i] = { ...a[i], price_delta: Number(t) || 0 }; return { ...p, variants: a }; })} /></View>
          </View>
        ))}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Tambahan</Text>
          <Pressable testID="add-addon" onPress={addAddon}><Icon name="add-circle-outline" size={22} color={colors.brandPrimary} /></Pressable>
        </View>
        {f.addons.map((a: any, i: number) => (
          <View key={i} style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 2 }}><Input placeholder="Nama tambahan" value={a.name} onChangeText={(t) => setF((p: any) => { const arr = [...p.addons]; arr[i] = { ...arr[i], name: t }; return { ...p, addons: arr }; })} /></View>
            <View style={{ flex: 1 }}><Input placeholder="Rp" keyboardType="number-pad" value={String(a.price || "")} onChangeText={(t) => setF((p: any) => { const arr = [...p.addons]; arr[i] = { ...arr[i], price: Number(t) || 0 }; return { ...p, addons: arr }; })} /></View>
          </View>
        ))}
      </KeyboardAwareScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="save-product-btn" title="Simpan Produk" loading={save.isPending}
          onPress={() => { if (!f.name.trim()) return toast("Isi nama produk", "error"); save.mutate(); }} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  photo: { height: 160, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hint: { fontSize: 13, color: c.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
