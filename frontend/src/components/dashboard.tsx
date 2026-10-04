import React from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { Tone } from "@/src/constants";

// --------------------------------------------------------------- role labels
export const COMMUNITY_ROLE: Record<string, { label: string; tone: Tone }> = {
  owner: { label: "Pemilik", tone: "brand" },
  admin: { label: "Admin", tone: "accent" },
  moderator: { label: "Moderator", tone: "info" },
  seller: { label: "Penjual", tone: "success" },
  member: { label: "Anggota", tone: "neutral" },
  super_admin: { label: "Super Admin", tone: "brand" },
};

export const VERIFICATION: Record<string, { label: string; tone: Tone }> = {
  unverified: { label: "Belum Diverifikasi", tone: "neutral" },
  review: { label: "Dalam Review", tone: "warning" },
  verified: { label: "Terverifikasi", tone: "success" },
  rejected: { label: "Ditolak", tone: "error" },
};

// --------------------------------------------------------------- stat tile
export function StatTile({ icon, value, label, delta, testID }:
  { icon: string; value: React.ReactNode; label: string; delta?: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.tile}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon as any} size={18} color={colors.brandPrimary} />
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      {delta ? <Text style={styles.tileDelta}>{delta}</Text> : null}
    </View>
  );
}

// --------------------------------------------------------------- action tile
export function ActionTile({ icon, label, onPress, disabled, testID }:
  { icon: string; label: string; onPress?: () => void; disabled?: boolean; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon as any} size={20} color={colors.brandPrimary} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

// --------------------------------------------------------------- mini bar chart
export function MiniBarChart({ data, testID }:
  { data: { label: string; value: number }[]; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View testID={testID} style={styles.chart}>
      {data.map((d, i) => (
        <View key={i} style={styles.chartCol}>
          <Text style={styles.chartVal}>{d.value || ""}</Text>
          <View style={styles.chartTrack}>
            <View style={[styles.chartBar, {
              height: `${Math.round((d.value / max) * 100)}%`,
              backgroundColor: colors.brandPrimary,
            }]} />
          </View>
          <Text style={styles.chartLabel}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  tile: {
    width: "31%", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1,
    borderColor: c.border, padding: 12, gap: 4,
  },
  tileIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: c.brandTertiary,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  tileValue: { fontSize: 19, fontWeight: "700", color: c.onSurface },
  tileLabel: { fontSize: 11, color: c.muted },
  tileDelta: { fontSize: 11, color: c.success, fontWeight: "600" },

  action: {
    width: "31%", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1,
    borderColor: c.border, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", gap: 8,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  actionLabel: { fontSize: 12, color: c.onSurface, textAlign: "center", fontWeight: "500" },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 150, paddingTop: 8 },
  chartCol: { flex: 1, alignItems: "center", gap: 4 },
  chartVal: { fontSize: 10, color: c.muted, height: 12 },
  chartTrack: { flex: 1, width: "70%", justifyContent: "flex-end", alignItems: "center" },
  chartBar: { width: "100%", borderRadius: 6, minHeight: 3 },
  chartLabel: { fontSize: 9, color: c.muted },
}));
