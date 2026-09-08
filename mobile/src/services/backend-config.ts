export type BackendConfig =
  | { mode: "local" }
  | { mode: "supabase"; url: string; publicKey: string };

export function resolveBackendConfig(values: {
  url?: string;
  publicKey?: string;
}): BackendConfig {
  const url = values.url?.trim().replace(/\/$/, "");
  const publicKey = values.publicKey?.trim();
  if (!url && !publicKey) return { mode: "local" };
  if (!url || !publicKey) {
    throw new Error("Supabase URL과 공개 키를 함께 설정해주세요.");
  }
  if (!url.startsWith("https://")) {
    throw new Error("Supabase URL은 HTTPS여야 합니다.");
  }
  if (!new URL(url).hostname.endsWith(".supabase.co")) {
    throw new Error("올바른 Supabase 프로젝트 URL이 아닙니다.");
  }
  return { mode: "supabase", url, publicKey };
}

export const backendConfig = resolveBackendConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publicKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
