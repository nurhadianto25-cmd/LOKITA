import React from "react";
import { View, Text } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { Card } from "@/src/components/ui";

// human-readable labels + icon for audit actions
export const AUDIT_META: Record<string, { label: string; icon: string }> = {
  "account.create": { label: "Akun dibuat", icon: "person-add" },
  "account.delete": { label: "Akun dihapus", icon: "trash" },
  "seller.activate": { label: "Aktivasi penjual", icon: "storefront" },
  "store.create": { label: "Toko dibuat", icon: "storefront" },
  "community.create": { label: "Komunitas dibuat", icon: "add-circle" },
  "community.settings.update": { label: "Pengaturan diperbarui", icon: "settings" },
  "community.invite.regenerate": { label: "Kode undangan dibuat ulang", icon: "refresh" },
  "community.verification.request": { label: "Permintaan verifikasi", icon: "shield-checkmark" },
  "community.ownership.transfer": { label: "Kepemilikan dialihkan", icon: "swap-horizontal" },
  "community.staff.appoint.admin": { label: "Admin ditunjuk", icon: "shield" },
  "community.staff.appoint.moderator": { label: "Moderator ditunjuk", icon: "person-add" },
  "community.staff.revoke.admin": { label: "Admin dicabut", icon: "shield-outline" },
  "community.staff.revoke.moderator": { label: "Moderator dicabut", icon: "person-remove" },
  "report.create": { label: "Laporan dibuat", icon: "flag" },
};

export function AuditRow({ item }: { item: any }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meta = AUDIT_META[item.action] || { label: item.action, icon: "ellipse" };
  return (
    <Card testID={`audit-${item.id}`} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={styles.icon}><Ionicons name={meta.icon as any} size={16} color={colors.brandPrimary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.action}>{meta.label}</Text>
        <Text style={styles.actor}>oleh {item.actor_name}</Text>
      </View>
      <Text style={styles.time}>{new Date(item.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  action: { fontSize: 14, fontWeight: "600", color: c.onSurface },
  actor: { fontSize: 12, color: c.muted, marginTop: 2 },
  time: { fontSize: 11, color: c.muted },
}));
