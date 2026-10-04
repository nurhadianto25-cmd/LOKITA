import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Button, Input, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, fileUrl, uploadImage } from "@/src/api/client";

const CATS = ["Makanan", "Minuman", "Sayur", "Buah", "Umum", "Jasa"];

export default function SellerStore() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const store = useQuery({ queryKey: ["my-store"], queryFn: () => api.get("/seller/store") });
  const [f, setF] = useState<any>({
    name: "", tagline: "", description: "", category: "Makanan", hours: "08:00 - 20:00",
    delivery_range: "Dalam komunitas", delivery_mode: "A", delivery_windows_text: "",
    supports_cod: true, supports_qris: true, qris_file_id: null, logo_file_id: null, cover_file_id: null,
  });

  useEffect(() => {
    if (store.data) setF({
      ...store.data,
      delivery_windows_text: (store.data.delivery_windows || []).join(", "),
    });
  }, [store.data]);

  const save = useMutation({
    mutationFn: () => api.post("/seller/store", {
      name: f.name, tagline: f.tagline, description: f.description, category: f.category,
      hours: f.hours, delivery_range: f.delivery_range, delivery_mode: f.delivery_mode,
      delivery_windows: f.delivery_mode === "B" ? String(f.delivery_windows_text || "").split(",").map((x: string) => x.trim()).filter(Boolean) : [],
      supports_cod: f.supports_cod, supports_qris: f.supports_qris,
      qris_file_id: f.qris_file_id, logo_file_id: f.logo_file_id, cover_file_id: f.cover_file_id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-store"] });
      qc.invalidateQueries({ queryKey: ["stores"] });
      toast("Toko tersimpan", "success");
      router.back();
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  async function pick(field: string, kind: string) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast("Izin galeri diperlukan", "error");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const up = await uploadImage(res.assets[0].uri, kind);
      setF((p: any) => ({ ...p, [field]: up.id }));
    } catch (e: any) { toast(e.message, "error"); }
  }

  if (store.isLoading) return <View style={styles.root}><ScreenHeader title="Toko" /><Loading /></View>;

  const set = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <View style={styles.root}>
      <ScreenHeader title={store.data ? "Edit Toko" : "Buat Toko"} />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <UploadBox label="Logo" fileId={f.logo_file_id} onPress={() => pick("logo_file_id", "store")} />
          <UploadBox label="Sampul" fileId={f.cover_file_id} onPress={() => pick("cover_file_id", "store")} wide />
        </View>

        <Field label="Nama Toko"><Input testID="store-name" value={f.name} onChangeText={set("name")} placeholder="mis. Warung Bu Sri" /></Field>
        <Field label="Tagline"><Input testID="store-tagline" value={f.tagline} onChangeText={set("tagline")} placeholder="Slogan singkat toko" /></Field>
        <Field label="Deskripsi"><Input testID="store-desc" value={f.description} onChangeText={set("description")} placeholder="Ceritakan tentang toko Anda" multiline style={{ minHeight: 70, textAlignVertical: "top" }} /></Field>

        <Field label="Kategori">
          <View style={styles.chips}>
            {CATS.map((c) => (
              <Pressable key={c} testID={`storecat-${c}`} onPress={() => set("category")(c)}
                style={[styles.chip, { backgroundColor: f.category === c ? colors.brandPrimary : colors.surfaceSecondary, borderColor: f.category === c ? colors.brandPrimary : colors.border }]}>
                <Text style={{ color: f.category === c ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontSize: 13 }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Jam Operasional"><Input testID="store-hours" value={f.hours} onChangeText={set("hours")} placeholder="08:00 - 20:00" /></Field>
        <Field label="Jangkauan Pengiriman"><Input testID="store-range" value={f.delivery_range} onChangeText={set("delivery_range")} placeholder="mis. Dalam komunitas" /></Field>

        <Field label="Mode Pengiriman">
          <View style={styles.chips}>
            <ModeChip active={f.delivery_mode === "A"} onPress={() => set("delivery_mode")("A")} label="Pembeli pilih waktu (A)" />
            <ModeChip active={f.delivery_mode === "B"} onPress={() => set("delivery_mode")("B")} label="Jadwal penjual (B)" />
          </View>
        </Field>
        {f.delivery_mode === "B" ? (
          <Field label="Jadwal Pengiriman (pisahkan dengan koma)">
            <Input testID="store-windows" value={f.delivery_windows_text} onChangeText={set("delivery_windows_text")} placeholder="mis. 10:00-12:00, 16:00-18:00" />
          </Field>
        ) : null}

        <Toggle label="Terima COD" value={f.supports_cod} onToggle={() => set("supports_cod")(!f.supports_cod)} testID="toggle-cod" />
        <Toggle label="Terima QRIS" value={f.supports_qris} onToggle={() => set("supports_qris")(!f.supports_qris)} testID="toggle-qris" />
        {f.supports_qris ? (
          <Field label="Gambar QRIS">
            <Pressable testID="upload-qris" onPress={() => pick("qris_file_id", "qris")} style={styles.qrisBox}>
              {f.qris_file_id ? <Image source={{ uri: fileUrl(f.qris_file_id) }} style={{ width: 120, height: 120 }} contentFit="contain" /> :
                <View style={{ alignItems: "center", gap: 6 }}><Icon name="qr-code-outline" size={30} color={colors.muted} /><Text style={styles.hint}>Unggah QRIS Anda</Text></View>}
            </Pressable>
          </Field>
        ) : null}
      </KeyboardAwareScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="save-store-btn" title="Simpan Toko" loading={save.isPending}
          onPress={() => { if (!f.name.trim()) return toast("Isi nama toko", "error"); save.mutate(); }} />
      </View>
    </View>
  );
}

function UploadBox({ label, fileId, onPress, wide }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={`upload-${label}`} onPress={onPress} style={[styles.uploadBox, wide && { flex: 2 }]}>
      {fileId ? <Image source={{ uri: fileUrl(fileId) }} style={{ flex: 1, borderRadius: 12 }} contentFit="cover" /> :
        <View style={{ alignItems: "center", gap: 4 }}><Icon name="image-outline" size={22} color={colors.muted} /><Text style={styles.hint}>{label}</Text></View>}
    </Pressable>
  );
}

function ModeChip({ active, onPress, label }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }]}>
      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ label, value, onToggle, testID }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onToggle} style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.switch, { backgroundColor: value ? colors.brandPrimary : colors.surfaceTertiary }]}>
        <View style={[styles.knob, { alignSelf: value ? "flex-end" : "flex-start" }]} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  uploadBox: { flex: 1, height: 90, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hint: { fontSize: 12, color: c.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  qrisBox: { height: 150, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  toggleLabel: { fontSize: 15, color: c.onSurface },
  switch: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
