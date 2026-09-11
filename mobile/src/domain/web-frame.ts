const ANDROID_ASPECT_RATIO = 9 / 20;
const FRAME_MARGIN = 12;

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
