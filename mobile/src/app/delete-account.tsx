import React, { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../components/app-text.tsx";
import { accountStateKey } from "../domain/account-local-state.ts";
import { currentAccount, deleteAccount, restoreRemoteSession, signInGoogle } from "../services/auth.ts";

type Status = "checking" | "signed-out" | "signed-in" | "deleting" | "deleted";

export default function DeleteAccountPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const session = await restoreRemoteSession();
        if (!active) return;
        if (!session) { setStatus("signed-out"); return; }
        const account = await currentAccount();
        if (!active) return;
        setAccountId(account.id);
        setStatus("signed-in");
      } catch {
        if (active) { setStatus("signed-out"); setError("로그인 상태를 확인하지 못했습니다."); }
      }
    };
    void check();
    return () => { active = false; };
  }, []);

  const remove = async () => {
    if (!accountId || status !== "signed-in") return;
    if (Platform.OS === "web" && !window.confirm("냉톡 계정과 연결된 데이터를 영구 삭제할까요?")) return;
    setStatus("deleting");
    setError("");
    try {
      await deleteAccount();
      await AsyncStorage.removeItem(accountStateKey(accountId));
      setAccountId(null);
      setStatus("deleted");
    } catch {
      setStatus("signed-in");
      setError("계정을 삭제하지 못했습니다. 다시 시도해주세요.");
    }
  };

  if (Platform.OS !== "web") return null;
  return <View style={{ flex: 1, alignItems: "center", padding: 24, backgroundColor: "#f8faf7" }}>
    <View style={{ width: "100%", maxWidth: 560, gap: 16 }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>냉톡 계정 삭제 / Delete NaengTalk account</Text>
      <Text>앱을 삭제한 뒤에도 이 페이지에서 Google 계정으로 로그인하여 계정 삭제를 요청할 수 있습니다.</Text>
      <Text>You can sign in with Google and delete your account here, even if you have uninstalled the app.</Text>
      <Text>삭제하면 계정, 재고, 저장한 레시피와 공유한 레시피가 영구 삭제됩니다.</Text>
      <Text>Deletion permanently removes your account, inventory, saved recipes, and shared recipes.</Text>
      {status === "checking" && <Text>로그인 상태를 확인하고 있습니다.</Text>}
      {status === "signed-out" && <Pressable accessibilityRole="button" onPress={() => void signInGoogle().catch(() => setError("Google 로그인에 실패했습니다."))}>
        <Text style={{ color: "#166534", fontWeight: "700" }}>Google로 로그인 / Sign in with Google</Text>
      </Pressable>}
      {status === "signed-in" && <Pressable accessibilityRole="button" onPress={() => void remove()}>
        <Text style={{ color: "#b91c1c", fontWeight: "700" }}>계정 및 데이터 영구 삭제 / Permanently delete account and data</Text>
      </Pressable>}
      {status === "deleting" && <Text>삭제 중입니다. / Deleting…</Text>}
      {status === "deleted" && <Text>계정 삭제가 완료되었습니다. / Your account has been deleted.</Text>}
      {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
    </View>
  </View>;
}
