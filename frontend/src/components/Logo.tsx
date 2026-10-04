import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";

const LOGO = require("../../assets/images/lokita-logo.png");

/**
 * Official LOKITA master logo (community + house + cart, green/orange, wordmark
 * "LOKiTA" with tagline "Your Community. Your Market."). Rendered from the master
 * asset — never redrawn or recolored.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" />
  );
}

export function LogoStacked({ size = 200 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Image source={LOGO} style={{ width: size, height: size }} contentFit="contain" />
    </View>
  );
}
