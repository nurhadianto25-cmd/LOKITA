import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { Loading, EmptyState } from "@/src/components/ui";
import { OrderCard } from "@/src/components/OrderCard";
import { useAuth } from "@/src/auth/auth";
import { api } from "@/src/api/client";

export default function Pesanan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [scope, setScope] = useState<"active" | "history">("active");

  const orders = useQuery({
    queryKey: ["orders", role, scope],
    queryFn: () => api.get(`/orders/${role}?scope=${scope}`),
    refetchInterval: scope === "active" ? 8000 : false,
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Pesanan</Text>
        {user?.is_seller ? (
          <View style={styles.roleToggle}>
            {(["buyer", "seller"] as const).map((r) => (
              <Pressable key={r} testID={`role-${r}`} onPress={() => setRole(r)}
                style={[styles.roleBtn, role === r && { backgroundColor: colors.surface }]}>
                <Text style={[styles.roleText, role === r && { color: colors.onSurface, fontWeight: "600" }]}>
                  {r === "buyer" ? "Pembelian" : "Penjualan"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.tabs}>
          {(["active", "history"] as const).map((s) => (
            <Pressable key={s} testID={`scope-${s}`} onPress={() => setScope(s)} style={styles.tab}>
              <Text style={[styles.tabText, scope === s && { color: colors.brandPrimary, fontWeight: "700" }]}>
                {s === "active" ? "Aktif" : "Riwayat"}
              </Text>
              <View style={[styles.tabUnderline, { backgroundColor: scope === s ? colors.brandPrimary : "transparent" }]} />
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={orders.data || []}
        keyExtractor={(o: any) => o.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={orders.isFetching} onRefresh={() => orders.refetch()} tintColor={colors.brandPrimary} />}
        renderItem={({ item }) => <OrderCard order={item} role={role} onPress={() => router.push(`/order/${item.id}`)} />}
        ListEmptyComponent={orders.isLoading ? <Loading /> :
          <EmptyState icon="bag-handle-outline"
            title={scope === "active" ? "Belum ada pesanan aktif" : "Belum ada riwayat"}
            subtitle={role === "buyer" ? "Pesanan Anda akan muncul di sini." : "Pesanan masuk dari pembeli akan muncul di sini."} />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, gap: 12, paddingBottom: 0 },
  title: { fontSize: 24, fontWeight: "700", color: c.onSurface },
  roleToggle: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: 10, padding: 3 },
  roleBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  roleText: { fontSize: 13, color: c.muted },
  tabs: { flexDirection: "row", gap: 24 },
  tab: { alignItems: "center", gap: 8 },
  tabText: { fontSize: 15, color: c.muted, paddingTop: 4 },
  tabUnderline: { height: 3, width: 44, borderRadius: 2 },
}));
