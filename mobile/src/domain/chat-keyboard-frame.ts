// Compare absolute positions instead of subtracting keyboard height: Android
// may already have resized the application window before delivering the event.
export function getChatKeyboardHeight(
  availableHeight: number,
  keyboardTop: number | null,
  canvasTop: number,
  screenOriginInset = 0,
): number {
  if (keyboardTop === null || !Number.isFinite(keyboardTop)) return availableHeight;
  return Math.max(0, Math.min(availableHeight, keyboardTop - canvasTop - screenOriginInset));
}
