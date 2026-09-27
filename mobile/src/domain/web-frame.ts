const ANDROID_ASPECT_RATIO = 9 / 20;
const FRAME_MARGIN = 12;
const KEYBOARD_HEIGHT_DELTA = 120;
const KEYBOARD_WIDTH_TOLERANCE = 48;
const APP_DESIGN_WIDTH = 360;
const APP_DESIGN_HEIGHT = 800;

type PhoneShellStyle = {
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  overflow: "hidden";
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export function getAndroidWebFrame(
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const availableWidth = Math.max(0, viewportWidth - FRAME_MARGIN * 2);
  const availableHeight = Math.max(0, viewportHeight - FRAME_MARGIN * 2);

  let height = availableHeight;
  let width = height * ANDROID_ASPECT_RATIO;

  if (width > availableWidth) {
    width = availableWidth;
    height = width / ANDROID_ASPECT_RATIO;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

export function getKeyboardAwareWebFrame(
  viewport: { width: number; height: number },
  stableViewport: { width: number; height: number },
  chatInputFocused: boolean,
): { frame: { width: number; height: number }; keyboardOpen: boolean } {
  const keyboardOpen =
    chatInputFocused &&
    Math.abs(viewport.width - stableViewport.width) <= KEYBOARD_WIDTH_TOLERANCE &&
    stableViewport.height - viewport.height >= KEYBOARD_HEIGHT_DELTA;
  const frameViewport = keyboardOpen ? stableViewport : viewport;

  return {
    frame: getAndroidWebFrame(frameViewport.width, frameViewport.height),
    keyboardOpen,
  };
}

export function getChatComposerLayout(frameWidth: number): {
  horizontalPadding: number;
  gap: number;
  sendButtonWidth: number;
} {
  if (frameWidth < 340) {
    return { horizontalPadding: 8, gap: 6, sendButtonWidth: 58 };
  }

  return { horizontalPadding: 12, gap: 8, sendButtonWidth: 64 };
}

export function getResponsiveAppCanvas(
  availableWidth: number,
  availableHeight: number,
): {
  designWidth: number;
  designHeight: number;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
} {
  const safeWidth = Math.max(0, availableWidth);
  const safeHeight = Math.max(0, availableHeight);
  const scale = Math.min(
    safeWidth / APP_DESIGN_WIDTH,
    safeHeight / APP_DESIGN_HEIGHT,
  );

  return {
    designWidth: APP_DESIGN_WIDTH,
    designHeight: APP_DESIGN_HEIGHT,
    scale,
    renderedWidth: Math.round(APP_DESIGN_WIDTH * scale),
    renderedHeight: Math.round(APP_DESIGN_HEIGHT * scale),
  };
}

export function getPhoneShellStyle(
  platform: string,
): PhoneShellStyle | undefined {
  if (platform !== "web") return undefined;

  return {
    borderWidth: 8,
    borderColor: "#20251f",
    borderRadius: 38,
    overflow: "hidden",
    shadowColor: "#111811",
    shadowOpacity: 0.26,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  };
}
