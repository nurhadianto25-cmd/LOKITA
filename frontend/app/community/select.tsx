import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Button, Input, Field, Icon, Loading, EmptyState, Card } from "@/src/components/ui";
import { Logo } from "@/src/components/Logo";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/auth";
import { api } from "@/src/api/client";

export default function CommunitySelect() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");

  const mine = useQuery({ queryKey: ["my-communities"], queryFn: () => api.get("/communities/mine") });
  const results = useQuery({
    queryKey: ["community-search", search],
    queryFn: () => api.get(`/communities/search?q=${encodeURIComponent(search.trim())}`),
    enabled: search.trim().length >= 2,
  });

  const requestJoin = useMutation({
    mutationFn: (id: string) => api.post(`/communities/${id}/request-join`),
    onSuccess: () => {
      toast("Permintaan bergabung dikirim. Menunggu persetujuan admin.", "success");
      qc.invalidateQueries({ queryKey: ["community-search"] });
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  const join = useMutation({
    mutationFn: (invite_code: string) => api.post("/communities/join", { invite_code }),
    onSuccess: async () => {
      await refresh();
      toast("Berhasil bergabung dengan komunitas", "success");
      qc.invalidateQueries({ queryKey: ["my-communities"] });
      router.replace("/(tabs)");
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  const switchTo = useMutation({
    mutationFn: (id: string) => api.post(`/communities/${id}/switch`),
    onSuccess: async () => {
      await refresh();
      router.replace("/(tabs)");
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Logo size={40} />
      </View>
      <FlatList
        data={mine.data || []}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={mine.isFetching} onRefresh={() => mine.refetch()} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 4 }}>
            <View style={{ gap: 4 }}>
              <Text style={styles.h1}>Pilih Komunitas</Text>
              <Text style={styles.sub}>Gabung dengan kode undangan dari komunitas Anda.</Text>
            </View>
            <Card>
              <Field label="Kode Undangan Komunitas">
                <Input testID="invite-code-input" value={code} onChangeText={(t) => setCode(t.toUpperCase())}
                  placeholder="mis. LOKITA" autoCapitalize="characters" />
              </Field>
              <View style={{ height: 10 }} />
              <Button testID="join-community-btn" title="Gabung Komunitas" icon="enter-outline"
                loading={join.isPending} onPress={() => code.trim() && join.mutate(code.trim())} />
            </Card>
            <Button testID="create-community-btn" title="Buat Komunitas Baru" icon="add-circle-outline" variant="outline"
              onPress={() => router.push("/community/create")} />

            <Card>
              <Field label="Cari Komunitas berdasarkan nama">
                <Input testID="community-search-input" value={search} onChangeText={setSearch}
                  placeholder="mis. Taman Harapan" autoCapitalize="none" />
              </Field>
              {search.trim().length >= 2 ? (
                <View style={{ marginTop: 10, gap: 8 }}>
                  {results.isFetching ? <Text style={styles.sub}>Mencari...</Text> :
                    (results.data?.length ?? 0) === 0 ? <Text style={styles.sub}>Tidak ada komunitas ditemukan.</Text> :
                    results.data.map((r: any) => (
                      <View key={r.id} testID={`search-result-${r.id}`} style={styles.resultRow}>
                        <View style={styles.cIcon}><Icon name="people" size={18} color={colors.brandPrimary} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cName} numberOfLines={1}>{r.name}</Text>
                          <Text style={styles.cMeta}>{r.location || "Komunitas"} · {r.member_count} anggota</Text>
                        </View>
                        {r.join_status === "member" ? (
                          <Text style={styles.statusMember}>Terdaftar</Text>
                        ) : r.join_status === "pending" ? (
                          <Text style={styles.statusPending}>Menunggu</Text>
                        ) : (
                          <Button testID={`request-join-${r.id}`} title="Bergabung" small
                            loading={requestJoin.isPending} onPress={() => requestJoin.mutate(r.id)} />
                        )}
                      </View>
                    ))}
                </View>
              ) : null}
            </Card>

            {(mine.data?.length ?? 0) > 0 ? <Text style={styles.section}>Komunitas Saya</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const active = item.id === user?.active_community_id;
          const canManage = ["owner", "admin", "moderator"].includes(item.my_role || "");
          return (
            <Pressable testID={`community-${item.id}`} onPress={() => switchTo.mutate(item.id)}>
              <Card style={active ? { borderColor: colors.brandPrimary, borderWidth: 2 } : undefined}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.cIcon}><Icon name="people" color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cName}>{item.name}</Text>
                    <Text style={styles.cMeta}>{item.location || "Komunitas"} · {item.member_count} anggota</Text>
                  </View>
                  {active ? <Icon name="checkmark-circle" color={colors.brandPrimary} /> : <Icon name="chevron-forward" color={colors.muted} />}
                </View>
                {canManage ? (
                  <Pressable testID={`manage-${item.id}`} onPress={() => router.push(`/community/${item.id}/dashboard`)}
                    style={styles.manageBtn}>
                    <Icon name="shield-checkmark" size={16} color={colors.brandPrimary} />
                    <Text style={styles.manageText}>Kelola Komunitas</Text>
                  </Pressable>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={mine.isLoading ? <Loading /> :
          <EmptyState icon="people-outline" title="Belum ada komunitas"
            subtitle="Masukkan kode undangan untuk bergabung. Coba kode demo: LOKITA" />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  h1: { fontSize: 22, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: 14, color: c.muted },
  section: { fontSize: 13, fontWeight: "500", color: c.onSurfaceSecondary, marginTop: 4 },
  cIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  cName: { fontSize: 16, fontWeight: "500", color: c.onSurface },
  cMeta: { fontSize: 13, color: c.muted, marginTop: 2 },
  manageBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  manageText: { fontSize: 13, color: c.brandPrimary, fontWeight: "600" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  statusMember: { fontSize: 12, color: c.success, fontWeight: "600" },
  statusPending: { fontSize: 12, color: c.warning, fontWeight: "600" },
}));
