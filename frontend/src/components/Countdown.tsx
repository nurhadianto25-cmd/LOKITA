import React, { useEffect, useRef, useState } from "react";
import { Text, TextStyle, StyleProp } from "react-native";
import { mmss } from "@/src/constants";

/** Client-side ticking countdown seeded from a server-provided seconds value. */
export function Countdown({ seconds, style, onDone, prefix = "" }: {
  seconds: number; style?: StyleProp<TextStyle>; onDone?: () => void; prefix?: string;
}) {
  const [left, setLeft] = useState(seconds);
  const doneRef = useRef(false);

  useEffect(() => { setLeft(seconds); doneRef.current = false; }, [seconds]);

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(t);
          if (!doneRef.current) { doneRef.current = true; onDone?.(); }
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [seconds, onDone]);

  return <Text style={style}>{prefix}{mmss(left)}</Text>;
}
