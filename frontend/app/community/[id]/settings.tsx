import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Card, Button, Input, Field, Badge, Avatar, EmptyState } from "@/src/components/ui";
import { VERIFICATION } from "@/src/components/dashboard";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/auth";
import { api } from "@/src/api/client";

export default function CommunitySettings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const dash = useQuery({ queryKey: ["community-dashboard", id], queryFn: () => api.get(`/communities/${id}/dashboard`) });
  const verif = useQuery({ queryKey: ["community-verification", id], queryFn: () => api.get(`/communities/${id}/verification`) });
  const members = useQuery({ queryKey: ["community-members", id], queryFn: () => api.get(`/communities/${id}/members`) });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState<any>(null);

  useEffect(() => {
    if (dash.data) {
      setName(dash.data.name || "");
      setLocation(dash.data.location || "");
    }
  }, [dash.data]);

  const save = useMutation({
    mutationFn: () => api.put(`/communities/${id}/settings`, { name, description, location }),
    onSuccess: () => { toast("Pengaturan disimpan", "success"); qc.invalidateQueries({ queryKey: ["community-dashboard", id] }); qc.invalidateQueries({ queryKey: ["my-communities"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const requestVerif = useMutation({
    mutationFn: () => api.post(`/communities/${id}/verification/request`),
    onSuccess: () => { toast("Permintaan verifikasi dikirim", "success"); qc.invalidateQueries({ queryKey: ["community-verification", id] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const transfer = useMutation({
    mutationFn: (user_id: string) => api.post(`/communities/${id}/transfer`, { user_id }),
    onSuccess: async () => {
      toast("Kepemilikan dialihkan", "success");
      setConfirmTransfer(null); setShowTransfer(false);
      await refresh();
      qc.invalidateQueries({ queryKey: ["community-dashboard", id] });
      router.back();
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (dash.isLoading) return <View style={styles.root}><ScreenHeader title="Pengaturan" /><Loading /></View>;
  const myRole = dash.data?.my_role;
  const isOwner = myRole === "owner" || myRole === "super_admin";
  const vInfo = VERIFICATION[verif.data?.status] || VERIFICATION.unverified;
  const transferCandidates = (members.data || []).filter((m: any) => m.role !== "owner");

  return (
    <View style={styles.root}>
      <ScreenHeader title="Pengaturan Komunitas" subtitle={dash.data?.name} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 12 }}>
          <Text style={styles.cardTitle}>Profil Komunitas</Text>
          <Field label="Nama Komunitas">
            <Input testID="community-name-input" value={name} onChangeText={setName} placeholder="Nama komunitas" />
          </Field>
          <Field label="Lokasi">
            <Input testID="community-location-input" value={location} onChangeText={setLocation} placeholder="mis. Jakarta" />
          </Field>
          <Field label="Deskripsi">
            <Input testID="community-desc-input" value={description} onChangeText={setDescription}
              placeholder="Deskripsi singkat komunitas" multiline style={{ minHeight: 72, textAlignVertical: "top" }} />
          </Field>
          <Button testID="save-settings-btn" title="Simpan Perubahan" icon="save-outline"
            loading={save.isPending} onPress={() => save.mutate()} />
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.cardTitle}>Verifikasi</Text>
            <Badge testID="verif-status-badge" label={vInfo.label} tone={vInfo.tone} />
          </View>
          <Text style={styles.sub}>
            Verifikasi meningkatkan kepercayaan warga terhadap komunitas Anda.
          </Text>
          {verif.data?.status !== "verified" && verif.data?.status !== "review" ? (
            <Button testID="request-verif-btn" title="Ajukan Verifikasi" icon="shield-checkmark-outline" small variant="outline"
              loading={requestVerif.isPending} onPress={() => requestVerif.mutate()} />
          ) : null}
        </Card>

        {isOwner ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.cardTitle}>Transfer Kepemilikan</Text>
            <Text style={styles.sub}>
              Alihkan kepemilikan komunitas ke anggota lain. Anda akan menjadi Admin. Tindakan ini tercatat di audit log.
            </Text>
            <Button testID="open-transfer-btn" title="Transfer Kepemilikan" icon="swap-horizontal-outline" small variant="outline"
              onPress={() => setShowTransfer(true)} />
          </Card>
        ) : null}
      </ScrollView>

      {/* transfer picker */}
      <Modal visible={showTransfer} transparent animationType="slide" onRequestClose={() => setShowTransfer(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pilih pemilik baru</Text>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
              {transferCandidates.length === 0 ? (
                <EmptyState icon="people-outline" title="Tidak ada kandidat" />
              ) : transferCandidates.map((m: any) => (
                <Pressable key={m.user_id} testID={`transfer-pick-${m.user_id}`}
                  onPress={() => setConfirmTransfer(m)}
                  style={({ pressed }) => [styles.pickRow, { opacity: pressed ? 0.7 : 1 }]}>
                  <Avatar name={m.name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}</Text>
                    <Text style={styles.sub}>{m.phone}</Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              ))}
            </ScrollView>
            <Button testID="transfer-cancel-btn" title="Batal" variant="outline" onPress={() => setShowTransfer(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmTransfer} transparent animationType="fade" onRequestClose={() => setConfirmTransfer(null)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Konfirmasi transfer</Text>
            <Text style={styles.dialogBody}>
              Alihkan kepemilikan komunitas ke {confirmTransfer?.name}? Anda akan kehilangan hak pemilik dan menjadi Admin.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Button testID="cancel-transfer-btn" title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => setConfirmTransfer(null)} />
              <Button testID="confirm-transfer-btn" title="Transfer" variant="danger" style={{ flex: 1 }}
                loading={transfer.isPending} onPress={() => transfer.mutate(confirmTransfer.user_id)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  cardTitle: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: 13, color: c.muted, lineHeight: 19 },
  name: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 8 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: "center", marginBottom: 6 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 12, backgroundColor: c.surfaceSecondary },
  centerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 32 },
  dialog: { backgroundColor: c.surface, borderRadius: 18, padding: 20, gap: 8 },
  dialogTitle: { fontSize: 17, fontWeight: "700", color: c.onSurface },
  dialogBody: { fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 20 },
}));
