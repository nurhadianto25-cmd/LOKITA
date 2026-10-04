import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Card, Button, Input, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/auth";
import { api } from "@/src/api/client";

const STEPS = [
  { icon: "create-outline", title: "Isi informasi komunitas", sub: "Nama, lokasi, dan deskripsi" },
  { icon: "people-outline", title: "Komunitas dibuat", sub: "Anda otomatis menjadi Pemilik" },
  { icon: "qr-code-outline", title: "Undang warga", sub: "Bagikan kode / QR undangan" },
  { icon: "shield-checkmark-outline", title: "Ajukan verifikasi", sub: "Tingkatkan kepercayaan (opsional)" },
];

export default function CreateCommunity() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { refresh } = useAuth();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/communities/create", { name: name.trim(), location: location.trim(), description: description.trim() }),
    onSuccess: async (c: any) => {
      await refresh();
      qc.invalidateQueries({ queryKey: ["my-communities"] });
      toast("Komunitas berhasil dibuat", "success");
      router.replace(`/community/${c.id}/dashboard` as any);
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Buat Komunitas" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 14 }}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNo}><Text style={styles.stepNoText}>{i + 1}</Text></View>
              <View style={styles.stepIcon}><Icon name={s.icon} size={18} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepSub}>{s.sub}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 12 }}>
          <Text style={styles.cardTitle}>Informasi Komunitas</Text>
          <Field label="Nama Komunitas">
            <Input testID="create-name-input" value={name} onChangeText={setName} placeholder="mis. Perumahan Grand Harmoni" />
          </Field>
          <Field label="Lokasi">
            <Input testID="create-location-input" value={location} onChangeText={setLocation} placeholder="mis. Bekasi" />
          </Field>
          <Field label="Deskripsi">
            <Input testID="create-desc-input" value={description} onChangeText={setDescription}
              placeholder="Deskripsi singkat komunitas" multiline style={{ minHeight: 72, textAlignVertical: "top" }} />
          </Field>
          <Button testID="submit-create-btn" title="Buat Komunitas" icon="add-circle-outline"
            disabled={!name.trim()} loading={create.isPending} onPress={() => create.mutate()} />
        </Card>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  cardTitle: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNoText: { color: c.onBrandPrimary, fontSize: 12, fontWeight: "700" },
  stepIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  stepTitle: { fontSize: 14, fontWeight: "600", color: c.onSurface },
  stepSub: { fontSize: 12, color: c.muted, marginTop: 1 },
}));
