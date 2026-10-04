import React, { useState } from "react";
import { View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Icon, Button, Input, Field, Card } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/auth";
import { api } from "@/src/api/client";

export default function DeleteAccount() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useAuth();
  const [pin, setPin] = useState("");

  const del = useMutation({
    mutationFn: () => api.post("/account/delete", { pin }),
    onSuccess: async () => { toast("Akun berhasil dihapus", "success"); await signOut(); router.replace("/login"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Hapus Akun" />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
        <View style={styles.warn}>
          <Icon name="warning" size={22} color={colors.error} />
          <Text style={styles.warnText}>Tindakan ini permanen. Data pribadi Anda akan dianonimkan dan Anda tidak dapat masuk kembali.</Text>
        </View>

        <Card>
          <Text style={styles.h}>Yang akan terjadi</Text>
          <Bullet text="Identitas Anda (nama, nomor telepon, alamat) dianonimkan." />
          <Bullet text="Semua sesi perangkat dikeluarkan." />
          <Bullet text="Toko Anda (jika ada) ditutup." />
          <Bullet text="Catatan transaksi tertentu disimpan untuk kewajiban hukum, tanpa identitas pribadi." />
          <Bullet text="Selesaikan dahulu pesanan aktif sebelum menghapus akun." />
        </Card>

        <Text style={styles.note}>Penghapusan juga tersedia via web: https://lokita.app/hapus-akun</Text>

        <Field label="Masukkan PIN untuk konfirmasi">
          <Input testID="delete-pin" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry
            placeholder="______" style={{ letterSpacing: 8, fontSize: 20 }} />
        </Field>

        <Button testID="confirm-delete-btn" title="Hapus Akun Saya Secara Permanen" variant="danger"
          loading={del.isPending} disabled={pin.length !== 6} onPress={() => del.mutate()} />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
      <Icon name="ellipse" size={6} color={colors.muted} />
      <Text style={styles.bullet}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  warn: { flexDirection: "row", gap: 10, backgroundColor: "#FDE7E7", padding: 14, borderRadius: 12, alignItems: "flex-start" },
  warnText: { flex: 1, fontSize: 13, color: c.error, lineHeight: 19 },
  h: { fontSize: 15, fontWeight: "700", color: c.onSurface, marginBottom: 4 },
  bullet: { flex: 1, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19, marginTop: -4 },
  note: { fontSize: 12, color: c.muted },
}));
