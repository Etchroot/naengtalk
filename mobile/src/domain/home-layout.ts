const CARD_CHROME_HEIGHT = 116;
const INVENTORY_ROW_HEIGHT = 48;
const CONTENT_HORIZONTAL_PADDING = 16;
const TOOL_GRID_GAP = 12;

export type RefrigeratorDoorTone = "fresh" | "warm" | "neutral";
export type RefrigeratorHandlePlacement = "top" | "bottom";

const REFRIGERATOR_DOOR_BACKGROUNDS: Record<RefrigeratorDoorTone, string> = {
  fresh: "#eef5e9",
  warm: "#fff5df",
  neutral: "#eaf3f7",
};

export function getCompactHeaderMetrics() {
  return {
    padding: 14,
    gap: 8,
    controlSize: 32,
    controlRadius: 10,
    logoSize: 28,
    homeIconSize: 17,
    titleFontSize: 21,
    titleLineHeight: 26,
    taglineFontSize: 13,
    taglineLineHeight: 18,
  } as const;
}

export function getRefrigeratorDoorSurface(
  tone: RefrigeratorDoorTone,
  pressed = false,
) {
  return {
    backgroundColor: REFRIGERATOR_DOOR_BACKGROUNDS[tone],
    borderColor: "#ffffff",
    borderWidth: 3,
    shadowColor: "#788276",
    shadowOffset: pressed ? { width: 2, height: 3 } : { width: 5, height: 7 },
    shadowOpacity: pressed ? 0.15 : 0.24,
    shadowRadius: pressed ? 3 : 7,
    elevation: pressed ? 2 : 6,
    transform: pressed ? [{ translateX: 2 }, { translateY: 3 }] : [],
  };
}

export function getRefrigeratorHandlePlacement(
  tone: RefrigeratorDoorTone,
): RefrigeratorHandlePlacement {
  return tone === "fresh" ? "bottom" : "top";
}

export function getRefrigeratorHandleScaleY(
  tone: RefrigeratorDoorTone,
): 1 | -1 {
  return tone === "fresh" ? 1 : -1;
}

export function getToolCardLayout(
  frameWidth: number,
  frameHorizontalInset = 0,
) {
  if (!Number.isFinite(frameWidth) || frameWidth <= 0) {
    throw new Error("frameWidth must be a positive number");
  }
  if (!Number.isFinite(frameHorizontalInset) || frameHorizontalInset < 0) {
    throw new Error("frameHorizontalInset must be a non-negative number");
  }
  const contentWidth =
    frameWidth - (CONTENT_HORIZONTAL_PADDING + frameHorizontalInset) * 2;
  return {
    columns: 2 as const,
    cardWidth: (contentWidth - TOOL_GRID_GAP) / 2,
    aspectRatio: 1 as const,
  };
}

export function getUrgentCardMinHeight(visibleRows: number): number {
  if (!Number.isInteger(visibleRows) || visibleRows < 0) {
    throw new Error("visibleRows must be a non-negative integer");
  }
  return CARD_CHROME_HEIGHT + visibleRows * INVENTORY_ROW_HEIGHT;
}

export function getHomeActionTitleFontSize(frameWidth: number): number {
  if (frameWidth < 320) return 16;
  if (frameWidth < 380) return 17;
  return 19;
}

export function getUrgentInventoryLimit(frameHeight: number): number {
  if (frameHeight >= 784) return 6;
  if (frameHeight >= 736) return 5;
  return 4;
}
