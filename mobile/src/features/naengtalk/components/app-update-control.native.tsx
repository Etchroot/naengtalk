import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Modal, View } from "react-native";
import * as Updates from "expo-updates";
import { Text } from "../../../components/app-text.tsx";
import { createAppUpdateController } from "../../../services/app-update-controller.ts";
import { AppButton } from "./app-button.tsx";
import { color, s } from "../../theme.ts";

export type AppUpdateHandle = { check: () => void };
export type AppUpdateControlProps = { canPrompt?: boolean };
type UpdateState = Parameters<Parameters<typeof createAppUpdateController>[1]>[0];

export const AppUpdateControl = forwardRef<AppUpdateHandle, AppUpdateControlProps>(function AppUpdateControl({ canPrompt = true }, ref) {
  const [state, setState] = useState<UpdateState>({ phase: "idle", message: "" });
  const [visible, setVisible] = useState(false);
  const mounted = useRef(true);
  const checkedOnMount = useRef(false);
  const { downloadProgress } = Updates.useUpdates();
  const controller = useMemo(() => createAppUpdateController({
    enabled: Updates.isEnabled && !__DEV__,
    check: async () => {
      const result = await Updates.checkForUpdateAsync();
      return result.isAvailable || result.isRollBackToEmbedded;
    },
    download: async () => {
      const result = await Updates.fetchUpdateAsync();
      return result.isNew || result.isRollBackToEmbedded;
    },
    reload: () => Updates.reloadAsync(),
  }, (nextState) => {
    if (!mounted.current) return;
    setState(nextState);
  }), []);

  useImperativeHandle(ref, () => ({
    check: () => {
      setVisible(true);
      void controller.check();
    },
  }), [controller]);

  useEffect(() => {
    mounted.current = true;
    if (!checkedOnMount.current) {
      checkedOnMount.current = true;
      void controller.check();
    }
    return () => { mounted.current = false; };
  }, [controller]);

  useEffect(() => {
    if (canPrompt && state.phase === "available") setVisible(true);
  }, [canPrompt, state.phase]);

  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  const busy = state.phase === "downloading" || state.phase === "restarting";
  const dismiss = () => {
    if (busy) return;
    setVisible(false);
    controller.defer();
  };
  const progress = typeof downloadProgress === "number" && Number.isFinite(downloadProgress)
    ? Math.max(0, Math.min(1, downloadProgress)) : undefined;
  const title = state.phase === "available" ? "앱 업데이트"
    : state.phase === "downloading" ? "업데이트 다운로드 중"
    : state.phase === "ready" ? "업데이트 준비 완료"
    : state.phase === "restarting" ? "앱 다시 시작 중"
    : "앱 업데이트 확인";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0008" }}>
        <View style={[s.card, { alignSelf: "center", width: "100%", maxWidth: 440, gap: 16 }]} accessibilityViewIsModal>
          <Text style={s.title}>{title}</Text>
          <Text style={s.text} accessibilityLiveRegion="polite">{state.message}</Text>
          {state.phase === "available" && <Text style={s.muted}>다운로드가 끝나면 앱을 다시 시작해 적용할 수 있습니다.</Text>}
          {state.phase === "ready" && <Text style={s.muted}>나중에를 선택해도 다음에 앱을 완전히 종료하고 다시 실행하면 적용됩니다.</Text>}
          {(state.phase === "checking" || busy) && <ActivityIndicator color={color.green} />}
          {state.phase === "downloading" && progress !== undefined && (
            <View style={{ gap: 8 }} accessibilityRole="progressbar" accessibilityLabel="업데이트 다운로드" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
              <View style={{ height: 8, backgroundColor: color.soft, borderRadius: 4, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: color.green }} />
              </View>
              <Text style={s.muted}>{Math.round(progress * 100)}%</Text>
            </View>
          )}
          {(state.phase === "available" || state.phase === "ready") ? (
            <View style={s.row}>
              <View style={{ flex: 1 }}><AppButton secondary onPress={dismiss}>나중에</AppButton></View>
              <View style={{ flex: 1 }}><AppButton onPress={() => void (state.phase === "ready" ? controller.apply() : controller.download())}>{state.phase === "ready" ? "지금 다시 시작" : "업데이트"}</AppButton></View>
            </View>
          ) : !busy && (
            <View style={s.row}>
              <View style={{ flex: 1 }}><AppButton secondary onPress={dismiss}>닫기</AppButton></View>
              {state.phase === "error" && <View style={{ flex: 1 }}><AppButton onPress={() => void controller.check()}>다시 확인</AppButton></View>}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
});
