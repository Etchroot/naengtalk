export function availableLoginMethods(platform: string) {
  return { google: true, guest: platform === 'web' };
}
