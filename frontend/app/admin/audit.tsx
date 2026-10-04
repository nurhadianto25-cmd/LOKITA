import React from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { makeStyles, useTheme } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Loading, EmptyState } from "@/src/components/ui";
import { AuditRow } from "@/src/components/audit";
import { api } from "@/src/api/client";

export default function AdminAudit() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => api.get("/admin/audit") });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Audit Log Platform" subtitle="Semua tindakan admin tercatat" />
      <FlatList
        data={q.data || []}
        keyExtractor={(a: any) => a.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
        renderItem={({ item }) => <AuditRow item={item} />}
        ListEmptyComponent={q.isLoading ? <Loading /> :
          <EmptyState icon="receipt-outline" title="Belum ada aktivitas tercatat" />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
}));
