import React from "react";
import { View, Text } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

/**
 * LOKITA placeholder wordmark + community/cart mark in the locked green/orange palette.
 * This is an explicit placeholder — swap in the official master logo asset when provided.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{
        width: size * 1.1, height: size * 1.1, borderRadius: size * 0.32,
        backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="storefront" size={size * 0.62} color={colors.onBrandPrimary} />
      </View>
      <Text style={{ fontSize: size * 0.82, fontWeight: "700", letterSpacing: 0.5, color: colors.brandPrimary }}>
        LOK<Text style={{ color: colors.brandSecondary }}>i</Text>TA
      </Text>
    </View>
  );
}

export function LogoStacked() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 22, backgroundColor: colors.brandPrimary,
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="storefront" size={40} color={colors.onBrandPrimary} />
      </View>
      <Text style={{ fontSize: 30, fontWeight: "700", letterSpacing: 0.5, color: colors.brandPrimary }}>
        LOK<Text style={{ color: colors.brandSecondary }}>i</Text>TA
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted }}>Your Community. Your Market.</Text>
    </View>
  );
}
