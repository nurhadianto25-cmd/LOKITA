import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon, Avatar, Button } from "@/src/components/ui";
import { useAuth } from "@/src/auth/auth";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";

function MenuItem({ icon, label, onPress, danger, testID, value }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.menuItem}>
      <View style={[styles.menuIcon, { backgroundColor: danger ? "#FDE7E7" : colors.surfaceSecondary }]}>
        <Icon name={icon} size={18} color={danger ? colors.error : colors.onSurfaceSecondary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Akun() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, signOut, refresh } = useAuth();

  const becomeSeller = useMutation({
    mutationFn: () => api.post("/seller/activate"),
    onSuccess: async () => { await refresh(); router.push("/seller"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const isPlatform = (user?.platform_roles?.length || 0) > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Avatar name={user?.name} size={64} />
        <Text style={styles.name}>{user?.name || "Pengguna"}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.rel}>
          <Icon name="shield-checkmark" size={15} color={colors.brandPrimary} />
          <Text style={styles.relText}>Skor Keandalan {user?.reliability?.score ?? 100} · {user?.reliability?.transactions ?? 0} transaksi</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Penjual</Text>
        {user?.is_seller ? (
          <MenuItem testID="seller-dashboard-btn" icon="storefront" label="Kelola Toko Saya" onPress={() => router.push("/seller")} />
        ) : (
          <View style={styles.sellerCta}>
            <Text style={styles.ctaTitle}>Mulai berjualan di komunitas</Text>
            <Text style={styles.ctaSub}>Buka toko permanen, kelola katalog, dan terima pesanan.</Text>
            <Button testID="become-seller-btn" title="Buka Toko" icon="add-circle-outline" small
              loading={becomeSeller.isPending} onPress={() => becomeSeller.mutate()} />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Akun</Text>
        <MenuItem testID="communities-btn" icon="people" label="Komunitas Saya" onPress={() => router.push("/community/select")} />
        <MenuItem testID="sessions-btn" icon="phone-portrait" label="Sesi & Perangkat" onPress={() => router.push("/account/sessions")} />
        {isPlatform ? (
          <MenuItem testID="admin-btn" icon="bar-chart" label="Dashboard Admin" onPress={() => router.push("/admin")} />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bantuan & Hukum</Text>
        <MenuItem testID="privacy-btn" icon="lock-closed" label="Kebijakan Privasi" onPress={() => router.push("/account/privacy")} />
        <MenuItem testID="terms-btn" icon="document-text" label="Syarat & Ketentuan" onPress={() => router.push("/account/terms")} />
        <MenuItem testID="delete-account-btn" icon="trash" label="Hapus Akun" danger onPress={() => router.push("/account/delete")} />
      </View>

      <View style={{ padding: 16 }}>
        <Button testID="logout-btn" title="Keluar" variant="outline" icon="log-out-outline"
          onPress={async () => { await signOut(); router.replace("/login"); }} />
        <Text style={styles.version}>LOKITA · Your Community. Your Market.</Text>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { backgroundColor: c.surface, alignItems: "center", paddingBottom: 20, gap: 4, borderBottomWidth: 1, borderBottomColor: c.border },
  name: { fontSize: 20, fontWeight: "700", color: c.onSurface, marginTop: 8 },
  phone: { fontSize: 14, color: c.muted },
  rel: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: c.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  relText: { fontSize: 12, color: c.onBrandTertiary, fontWeight: "500" },
  section: { marginTop: 16, backgroundColor: c.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: c.muted, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, color: c.onSurface },
  menuValue: { fontSize: 13, color: c.muted },
  sellerCta: { padding: 16, gap: 8 },
  ctaTitle: { fontSize: 16, fontWeight: "600", color: c.onSurface },
  ctaSub: { fontSize: 13, color: c.muted, marginBottom: 6 },
  version: { fontSize: 12, color: c.muted, textAlign: "center", marginTop: 16 },
}));
