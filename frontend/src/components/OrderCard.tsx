import React from "react";
import { View, Text, Pressable } from "react-native";
import { makeStyles, useTheme } from "@/src/theme";
import { Badge, Icon } from "@/src/components/ui";
import { Countdown } from "@/src/components/Countdown";
import { ORDER_STATUS, PAYMENT_STATUS, rupiah, FLOW } from "@/src/constants";

export function OrderCard({ order, role, onPress }: { order: any; role: "buyer" | "seller"; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const st = ORDER_STATUS[order.status] || { label: order.status, tone: "neutral" as const };
  const pay = PAYMENT_STATUS[order.payment_status];
  const flowIdx = FLOW.indexOf(order.status);
  const who = role === "buyer" ? order.store_name : order.buyer_name;
  const itemCount = order.items?.reduce((s: number, i: any) => s + i.qty, 0) || 0;

  return (
    <Pressable testID={`order-${order.id}`} onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.no}>#{order.order_no}</Text>
          <Text style={styles.who} numberOfLines={1}>{who}</Text>
        </View>
        <Badge label={st.label} tone={st.tone} />
      </View>

      {/* progress rail */}
      {flowIdx >= 0 ? (
        <View style={styles.rail}>
          {FLOW.map((_, i) => (
            <View key={i} style={[styles.railSeg, { backgroundColor: i <= flowIdx ? colors.brandPrimary : colors.surfaceTertiary }]} />
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.meta}>{itemCount} item · {rupiah(order.total)}</Text>
        {order.status === "MENUNGGU_KONFIRMASI" && order.seconds_to_confirm > 0 ? (
          <View style={styles.timer}>
            <Icon name="time-outline" size={14} color={colors.warning} />
            <Countdown seconds={order.seconds_to_confirm} prefix="" style={styles.timerText} />
          </View>
        ) : pay ? (
          <Text style={[styles.meta, { color: pay.tone === "success" ? colors.success : colors.muted }]}>{pay.label}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  no: { fontSize: 13, color: c.muted, fontWeight: "500" },
  who: { fontSize: 16, fontWeight: "700", color: c.onSurface, marginTop: 1 },
  rail: { flexDirection: "row", gap: 3 },
  railSeg: { flex: 1, height: 4, borderRadius: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meta: { fontSize: 13, color: c.onSurfaceSecondary },
  timer: { flexDirection: "row", alignItems: "center", gap: 4 },
  timerText: { fontSize: 14, fontWeight: "700", color: c.warning },
}));
