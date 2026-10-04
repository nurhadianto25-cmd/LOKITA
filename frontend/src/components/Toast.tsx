import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

type ToastType = "success" | "error" | "info";
const Ctx = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<{ msg: string; type: ToastType } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  const show = useCallback((msg: string, type: ToastType = "info") => {
    setState({ msg, type });
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setState(null));
    }, 2600);
  }, [opacity]);

  const bg = state?.type === "error" ? colors.error : state?.type === "success" ? colors.success : colors.surfaceInverse;
  const icon = state?.type === "error" ? "alert-circle" : state?.type === "success" ? "checkmark-circle" : "information-circle";

  return (
    <Ctx.Provider value={show}>
      {children}
      {state ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", left: 16, right: 16, top: insets.top + 10, opacity,
            backgroundColor: bg, borderRadius: 12, padding: 14, flexDirection: "row",
            alignItems: "center", gap: 10, zIndex: 9999,
          }}
        >
          <Ionicons name={icon as any} size={20} color={"#FFFFFF"} />
          <Text style={{ color: "#FFFFFF", flex: 1, fontSize: 14 }}>{state.msg}</Text>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
