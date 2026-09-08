const ANDROID_ASPECT_RATIO = 9 / 20;
const FRAME_MARGIN = 12;

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
