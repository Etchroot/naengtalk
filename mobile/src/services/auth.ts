import { supabase } from "./supabase.ts";

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

export async function resetRemoteGuestDemo(): Promise<void> {
  if (!supabase) throw new Error("Supabase 연결 설정이 필요합니다.");
  const { error } = await supabase.rpc("reset_guest_demo");
  if (error) throw error;
}
