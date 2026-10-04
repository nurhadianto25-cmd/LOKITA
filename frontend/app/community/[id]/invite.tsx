import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Loading, Card, Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";

export default function CommunityInvite() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({ queryKey: ["community-invite", id], queryFn: () => api.get(`/communities/${id}/invite`) });
  const regen = useMutation({
    mutationFn: () => api.post(`/communities/${id}/invite/regenerate`),
    onSuccess: () => { toast("Kode undangan diperbarui", "success"); qc.invalidateQueries({ queryKey: ["community-invite", id] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  if (q.isLoading) return <View style={styles.root}><ScreenHeader title="Undangan / QR" /><Loading /></View>;
  const d = q.data;

  const copy = async () => { await Clipboard.setStringAsync(d.invite_code); toast("Kode disalin", "success"); };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Undangan / QR" subtitle={d.name} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
        <Card style={{ alignItems: "center", gap: 16, paddingVertical: 24 }}>
          <Text style={styles.label}>Pindai untuk bergabung</Text>
          <View testID="community-qr" style={styles.qrBox}>
            <QRCode value={d.qr_payload} size={200} color={colors.onSurface} backgroundColor={colors.surface} />
          </View>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Kode Undangan</Text>
            <Text testID="invite-code-value" style={styles.code}>{d.invite_code}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
            <Button testID="copy-code-btn" title="Salin Kode" icon="copy-outline" variant="outline" small style={{ flex: 1 }} onPress={copy} />
            <Button testID="regenerate-code-btn" title="Buat Ulang" icon="refresh-outline" small style={{ flex: 1 }}
              loading={regen.isPending} onPress={() => regen.mutate()} />
          </View>
        </Card>

        <Card style={{ flexDirection: "row", gap: 12 }}>
          <Icon name="information-circle-outline" size={20} color={colors.brandPrimary} />
          <Text style={styles.note}>
            Bagikan kode atau QR ini kepada warga. Kode hanya berlaku untuk komunitas ini — memanipulasi kode tidak memberi akses ke komunitas lain.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  label: { fontSize: 14, color: c.muted },
  qrBox: { padding: 16, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  codeBox: { alignItems: "center", gap: 2 },
  codeLabel: { fontSize: 12, color: c.muted },
  code: { fontSize: 28, fontWeight: "800", color: c.brandPrimary, letterSpacing: 3 },
  note: { flex: 1, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
}));
