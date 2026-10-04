import React, { useState } from "react";
import { View, Text, FlatList, Pressable, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Card, Badge, Avatar, Button, EmptyState } from "@/src/components/ui";
import { COMMUNITY_ROLE } from "@/src/components/dashboard";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";

export default function CommunityStaff() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const dash = useQuery({ queryKey: ["community-dashboard", id], queryFn: () => api.get(`/communities/${id}/dashboard`) });
  const staff = useQuery({ queryKey: ["community-staff", id], queryFn: () => api.get(`/communities/${id}/staff`) });
  const members = useQuery({ queryKey: ["community-members", id], queryFn: () => api.get(`/communities/${id}/members`) });

  const [picker, setPicker] = useState<null | "admin" | "moderator">(null);
  const [confirmRemove, setConfirmRemove] = useState<any>(null);

  const myRole = dash.data?.my_role;
  const isOwner = myRole === "owner" || myRole === "super_admin";

  const add = useMutation({
    mutationFn: (p: { user_id: string; role: string }) => api.post(`/communities/${id}/staff`, p),
    onSuccess: () => {
      toast("Peran berhasil ditetapkan", "success");
      setPicker(null);
      qc.invalidateQueries({ queryKey: ["community-staff", id] });
      qc.invalidateQueries({ queryKey: ["community-members", id] });
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  const remove = useMutation({
    mutationFn: (uid: string) => api.del(`/communities/${id}/staff/${uid}`),
    onSuccess: () => {
      toast("Peran berhasil dicabut", "success");
      setConfirmRemove(null);
      qc.invalidateQueries({ queryKey: ["community-staff", id] });
      qc.invalidateQueries({ queryKey: ["community-members", id] });
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (staff.isLoading || dash.isLoading) return <View style={styles.root}><ScreenHeader title="Admin & Moderator" /><Loading /></View>;

  const candidates = (members.data || []).filter((m: any) => m.role !== "owner" && m.role !== "admin" && m.role !== "moderator");

  return (
    <View style={styles.root}>
      <ScreenHeader title="Admin & Moderator" />
      <FlatList
        data={staff.data || []}
        keyExtractor={(m: any) => m.user_id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Text style={styles.sub}>Pemilik dapat menunjuk Admin & Moderator. Admin dapat menunjuk Moderator.</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {isOwner ? (
                <Button testID="add-admin-btn" title="Tambah Admin" icon="shield-outline" small style={{ flex: 1 }}
                  onPress={() => setPicker("admin")} />
              ) : null}
              <Button testID="add-moderator-btn" title="Tambah Moderator" icon="person-add-outline" small variant="outline" style={{ flex: 1 }}
                onPress={() => setPicker("moderator")} />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const r = COMMUNITY_ROLE[item.role] || COMMUNITY_ROLE.member;
          const canRemove = item.role !== "owner" && (isOwner || item.role === "moderator");
          return (
            <Card testID={`staff-${item.user_id}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={item.name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.phone}</Text>
              </View>
              <Badge label={r.label} tone={r.tone} />
              {canRemove ? (
                <Pressable testID={`remove-staff-${item.user_id}`} hitSlop={8} onPress={() => setConfirmRemove(item)}>
                  <Icon name="close-circle" size={24} color={colors.error} />
                </Pressable>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={<EmptyState icon="shield-outline" title="Belum ada admin/moderator" />}
      />

      {/* member picker */}
      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pilih anggota untuk jadi {picker === "admin" ? "Admin" : "Moderator"}</Text>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
              {candidates.length === 0 ? (
                <EmptyState icon="people-outline" title="Tidak ada kandidat"
                  subtitle="Semua anggota sudah memiliki peran." />
              ) : candidates.map((m: any) => (
                <Pressable key={m.user_id} testID={`pick-${m.user_id}`}
                  disabled={add.isPending}
                  onPress={() => add.mutate({ user_id: m.user_id, role: picker! })}
                  style={({ pressed }) => [styles.pickRow, { opacity: pressed ? 0.7 : 1 }]}>
                  <Avatar name={m.name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}</Text>
                    <Text style={styles.meta}>{m.phone}</Text>
                  </View>
                  <Icon name="add-circle" size={22} color={colors.brandPrimary} />
                </Pressable>
              ))}
            </ScrollView>
            <Button testID="picker-cancel-btn" title="Batal" variant="outline" onPress={() => setPicker(null)} />
          </View>
        </View>
      </Modal>

      {/* remove confirm */}
      <Modal visible={!!confirmRemove} transparent animationType="fade" onRequestClose={() => setConfirmRemove(null)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Cabut peran?</Text>
            <Text style={styles.dialogBody}>
              Cabut peran {confirmRemove?.role === "admin" ? "Admin" : "Moderator"} dari {confirmRemove?.name}?
              Tindakan ini tercatat di audit log.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Button testID="cancel-remove-btn" title="Batal" variant="outline" style={{ flex: 1 }} onPress={() => setConfirmRemove(null)} />
              <Button testID="confirm-remove-btn" title="Cabut" variant="danger" style={{ flex: 1 }}
                loading={remove.isPending} onPress={() => remove.mutate(confirmRemove.user_id)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  sub: { fontSize: 13, color: c.muted, lineHeight: 18 },
  name: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted, marginTop: 2 },
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
