import React, { useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { makeStyles, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/ui";

function mapUrl(lat: number, lng: number): string {
  // Free static map (no API key). Yandex expects ll=lon,lat.
  return `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=15&size=560,260&l=map&pt=${lng},${lat},pm2orgl`;
}

/** Static delivery map pinned on the seller's store. Falls back gracefully. */
export function DeliveryMap({ lat, lng, label }: { lat?: number | null; lng?: number | null; label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const hasCoords = typeof lat === "number" && typeof lng === "number";

  if (!hasCoords || failed) {
    return (
      <View style={[styles.map, styles.fallback]}>
        <Icon name="map-outline" size={30} color={colors.muted} />
        <Text style={styles.fallbackText}>{label || "Lokasi penjual"}</Text>
      </View>
    );
  }
  return (
    <View style={styles.map}>
      <Image source={{ uri: mapUrl(lat!, lng!) }} style={{ flex: 1 }} contentFit="cover" onError={() => setFailed(true)} />
      <View style={styles.pinBadge}>
        <Icon name="storefront" size={14} color={colors.onBrandPrimary} />
        <Text style={styles.pinText} numberOfLines={1}>{label || "Toko"}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  map: { height: 160, borderRadius: 12, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  fallback: { alignItems: "center", justifyContent: "center", gap: 6 },
  fallbackText: { fontSize: 13, color: c.muted },
  pinBadge: { position: "absolute", left: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.brandPrimary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: "80%" },
  pinText: { color: c.onBrandPrimary, fontSize: 12, fontWeight: "600" },
}));
