import React from "react";
import {
  View, Text, Pressable, ActivityIndicator, TextInput, ScrollView,
  StyleProp, ViewStyle, TextStyle,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme, ThemeColors } from "@/src/theme";
import { Tone } from "@/src/constants";

export function Icon({ name, size = 22, color }: { name: any; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.onSurface} />;
}

function toneColors(colors: ThemeColors, tone: Tone) {
  switch (tone) {
    case "brand": return { bg: colors.brandTertiary, fg: colors.onBrandTertiary };
    case "accent": return { bg: "#FFEFD9", fg: colors.brandSecondary };
    case "success": return { bg: "#E6F6EC", fg: colors.success };
    case "warning": return { bg: "#FEF3DC", fg: colors.warning };
    case "error": return { bg: "#FDE7E7", fg: colors.error };
    case "info": return { bg: colors.surfaceSecondary, fg: colors.onSurfaceSecondary };
    default: return { bg: colors.surfaceSecondary, fg: colors.muted };
  }
}

export function Badge({ label, tone = "neutral", testID }: { label: string; tone?: Tone; testID?: string }) {
  const { colors } = useTheme();
  const { bg, fg } = toneColors(colors, tone);
  return (
    <View testID={testID} style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, testID, style, small }: BtnProps) {
  const { colors } = useTheme();
  const bg = variant === "primary" ? colors.brandPrimary
    : variant === "secondary" ? colors.brandSecondary
    : variant === "danger" ? colors.error
    : "transparent";
  const fg = variant === "outline" ? colors.onSurface
    : variant === "ghost" ? colors.brandPrimary
    : colors.onBrandPrimary;
  const border = variant === "outline" ? { borderWidth: 1, borderColor: colors.border } : {};
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [{
        backgroundColor: bg,
        opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        paddingVertical: small ? 9 : 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }, border, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon as any} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: small ? 14 : 15, fontWeight: "500" }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, children }: { label?: string; error?: string; children: React.ReactNode }) {
  const styles = useFieldStyles();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput> & { testID?: string }) {
  const { colors } = useTheme();
  const styles = useFieldStyles();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, props.style]}
      {...props}
    />
  );
}

const useFieldStyles = makeStyles((c) => ({
  label: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "500" },
  error: { color: c.error, fontSize: 12 },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: c.onSurface,
  },
}));

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[{
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    }, style]}>
      {children}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 10 }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as any} size={34} color={colors.brandPrimary} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "500", color: colors.onSurface, textAlign: "center" }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}

export function Avatar({ name, size = 40, uri }: { name?: string; size?: number; uri?: string }) {
  const { colors } = useTheme();
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Text style={{ color: colors.onBrandTertiary, fontWeight: "500", fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

export { ScrollView };
