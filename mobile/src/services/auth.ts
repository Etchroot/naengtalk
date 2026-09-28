import { supabase } from "./supabase.ts";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { runNativeGoogleOAuth } from "../domain/google-oauth-flow.ts";

export async function currentAccount(): Promise<{ id: string; kind: "guest" | "user" }> {
  if (!supabase) throw new Error("Supabase 연결 설정이 필요합니다.");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("로그인 세션이 없습니다.");
  const { data, error } = await supabase.from("profiles")
    .select("is_guest")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: profileError } = await supabase.from("profiles")
      .insert({ user_id: auth.user.id, is_guest: false });
    if (profileError) throw profileError;
  }
  return { id: auth.user.id, kind: data?.is_guest ? "guest" : "user" };
}

export async function signInGoogle(): Promise<void> {
  if (!supabase) throw new Error("Supabase 연결 설정이 필요합니다.");
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
    return;
  }
  const redirectTo = Linking.createURL("");
  await runNativeGoogleOAuth(
    supabase.auth,
    redirectTo,
    (url, redirect) => WebBrowser.openAuthSessionAsync(url, redirect),
  );
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Google 로그인 결과를 확인하지 못했습니다.");
  const { error: profileError } = await supabase.from("profiles")
    .upsert({ user_id: data.user.id, is_guest: false, expires_at: null }, { onConflict: "user_id" });
  if (profileError) throw profileError;
}

export async function restoreRemoteSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return Boolean(data.session);
}

export async function signInGuest(): Promise<"local" | "supabase"> {
  if (!supabase) return "local";
  const { error: authError } = await supabase.auth.signInAnonymously();
  if (authError) throw authError;
  const { error: bootstrapError } = await supabase.rpc("bootstrap_guest_inventory");
  if (bootstrapError) {
    await supabase.auth.signOut({ scope: "local" });
    throw bootstrapError;
  }
  return "supabase";
}

export async function signOutSession(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  if (!supabase) throw new Error("Supabase 연결 설정이 필요합니다.");
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirm: "DELETE" },
  });
  if (error || data?.deleted !== true) throw error ?? new Error("계정 삭제 결과를 확인하지 못했습니다.");
  await supabase.auth.signOut({ scope: "local" });
}

export async function resetRemoteGuestDemo(): Promise<void> {
  if (!supabase) throw new Error("Supabase 연결 설정이 필요합니다.");
  const { error } = await supabase.rpc("reset_guest_demo");
  if (error) throw error;
}
