import React from "react";
import { Image } from "react-native";
import {
  getRefrigeratorHandlePlacement,
  getRefrigeratorHandleScaleY,
  type RefrigeratorDoorTone,
} from "../../../domain/home-layout.ts";
import { s } from "../../theme.ts";

export function RefrigeratorHandle({ tone }: { tone: RefrigeratorDoorTone }) {
  const placement = getRefrigeratorHandlePlacement(tone);
  return (
    <Image
      source={require("../../../../assets/images/refrigerator-handle.png")}
      resizeMode="stretch"
      style={[
        s.refrigeratorHandle,
        placement === "bottom"
          ? s.refrigeratorHandleBottom
          : s.refrigeratorHandleTop,
        { transform: [{ scaleY: getRefrigeratorHandleScaleY(tone) }] },
      ]}
    />
  );
}
