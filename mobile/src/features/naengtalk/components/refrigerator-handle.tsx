import React from "react";
import { Image, View } from "react-native";
import {
  getRefrigeratorHandlePlacement,
  getRefrigeratorHandleScaleY,
  type RefrigeratorDoorTone,
} from "../../../domain/home-layout.ts";
import { s } from "../../theme.ts";

export function RefrigeratorHandle({ tone }: { tone: RefrigeratorDoorTone }) {
  const placement = getRefrigeratorHandlePlacement(tone);
  return (
    <View pointerEvents="none"
      style={[
        s.refrigeratorHandle,
        placement === "bottom"
          ? s.refrigeratorHandleBottom
          : s.refrigeratorHandleTop,
      ]}
    >
      <Image source={require("../../../../assets/images/refrigerator-handle.png")} resizeMode="stretch"
        style={{width:"60%", height:16, opacity:0.52, transform:[{scaleY:getRefrigeratorHandleScaleY(tone)}]}} />
    </View>
  );
}
