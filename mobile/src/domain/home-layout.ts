const CARD_CHROME_HEIGHT = 116;
const INVENTORY_ROW_HEIGHT = 48;

export function getUrgentCardMinHeight(visibleRows: number): number {
  if (!Number.isInteger(visibleRows) || visibleRows < 0) {
    throw new Error("visibleRows must be a non-negative integer");
  }
  return CARD_CHROME_HEIGHT + visibleRows * INVENTORY_ROW_HEIGHT;
}

export function getHomeActionTitleFontSize(frameWidth: number): number {
  if (frameWidth < 320) return 14;
  if (frameWidth < 380) return 15;
  return 17;
}

export function getUrgentInventoryLimit(frameHeight: number): number {
  if (frameHeight >= 784) return 6;
  if (frameHeight >= 736) return 5;
  return 4;
}
