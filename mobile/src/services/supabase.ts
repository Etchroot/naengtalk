import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { backendConfig } from "./backend-config.ts";
import { createChunkedStorage } from "./session-storage.ts";

const nativeStorage = createChunkedStorage({
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
});

export const supabase =
  backendConfig.mode === "supabase"
    ? createClient(backendConfig.url, backendConfig.publicKey, {
        auth: {
          storage: Platform.OS === "web" ? AsyncStorage : nativeStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === "web",
          lock: processLock,
        },
      })
    : null;
