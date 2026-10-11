import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { PurchaseReviewRow, PurchaseSelection } from "../../../domain/purchase-review.ts";
import { breakSentences } from "../../../domain/readable-text.ts";
import type { PurchaseDemoAsset } from "../../purchase-demo-assets.ts";
import { AppButton } from "../components/app-button.tsx";
import { UseByDateField } from "../components/use-by-date-field";
import { color, s } from "../../theme.ts";
import { groupPurchaseReviewSources } from './purchase-review-groups.ts';
import { PurchasePhotoEnlargement, PurchasePhotoPreview } from './purchase-photo-preview.tsx';

export type PurchaseFailure = { id: string; label: string; error: string };

export type PurchaseRegistrationModalProps = {
  visible: boolean;
  direct: boolean;
  picker: boolean;
  busy: boolean;
  directInput: string;
  rows: PurchaseReviewRow[];
  failures: PurchaseFailure[];
  selections: PurchaseSelection[];
  progress: string;
  error: string;
  samples: PurchaseDemoAsset[];
  onClose: () => void;
  onChangeDirectInput: (value: string) => void;
  onAnalyzeDirect: () => void;
  onChangeRow: (id: string, patch: Partial<PurchaseReviewRow>) => void;
  onRegister: () => void;
  onChooseOther: () => void;
  onToggleSample: (sample: PurchaseDemoAsset) => void;
  onRemoveSelection: (id: string) => void;
  onAnalyze: () => void;
  onPickImages: () => void;
  onOpenPicker: () => void;
  onOpenDirect: () => void;
};

export function PurchaseRegistrationModal({
  visible,
  direct,
  picker,
  busy,
  directInput,
  rows,
  failures,
  selections,
  progress,
  error,
  samples,
  onClose,
  onChangeDirectInput,
  onAnalyzeDirect,
  onChangeRow,
  onRegister,
  onChooseOther,
  onToggleSample,
  onRemoveSelection,
  onAnalyze,
  onPickImages,
  onOpenPicker,
  onOpenDirect,
}: PurchaseRegistrationModalProps) {
  const scroll = useRef<ScrollView>(null);
  const focusedInput = useRef<number | null>(null);
  const [enlarged, setEnlarged] = useState<PurchaseSelection | null>(null);
  useEffect(() => { if (!visible) setEnlarged(null); }, [visible]);
  const enlarge = (selection: PurchaseSelection) => { Keyboard.dismiss(); setEnlarged(selection); };
  const groups = groupPurchaseReviewSources(selections, rows, failures);
  const revealFocusedInput = () => {
    if (Platform.OS !== "web" && focusedInput.current !== null) {
      scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focusedInput.current, 24, true);
    }
  };
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", revealFocusedInput);
    return () => subscription.remove();
  }, []);
  const title = direct
    ? "식품 직접 입력"
    : rows.length || failures.length
      ? "구매내역 확인"
      : picker
        ? "구매내역 이미지 선택"
        : "재고 등록";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => enlarged ? setEnlarged(null) : onClose()}>
      <KeyboardAvoidingView enabled={Platform.OS !== "web"} behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0007" }}>
        <ScrollView ref={scroll} accessibilityElementsHidden={Boolean(enlarged)} importantForAccessibility={enlarged ? 'no-hide-descendants' : 'auto'} onLayout={revealFocusedInput} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} style={{ alignSelf: "center", width: "100%", maxWidth: 440, maxHeight: "90%", flexGrow: 0 }} contentContainerStyle={s.card}>
          <Text style={s.title}>{title}</Text>
          {direct ? (
            <>
              <TextInput
                multiline
                style={[s.input, { minHeight: 110 }]}
                placeholder="식품의 이름과 용량, 유통기한을 적어주세요."
                value={directInput}
                onChangeText={onChangeDirectInput}
                editable={!busy}
                onFocus={(event) => { focusedInput.current = event.nativeEvent.target; revealFocusedInput(); }}
                onBlur={() => { focusedInput.current = null; }}
              />
              <Text style={s.muted}>{breakSentences("AI가 입력 내용을 분석한 뒤 재고명, 수량, 권장 소진일을 보여드립니다. 확인 후 최종 등록할 수 있습니다.")}</Text>
              {busy ? (
                <View style={s.loadingRow}>
                  <Text accessibilityLiveRegion="polite" style={[s.muted, { flex: 1 }]}>{progress || "입력 내용을 분석하고 있어요"}…</Text>
                  <ActivityIndicator size="small" color={color.green} />
                </View>
              ) : null}
              <AppButton loading={busy} disabled={!directInput.trim()} onPress={onAnalyzeDirect}>식품 등록</AppButton>
              <Text style={s.muted}>{error}</Text>
            </>
          ) : rows.length || failures.length ? (
            <>
              <View>
                {rows.some((row) => row.needsReview) || failures.length ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: "#a94232", fontWeight: "700", marginBottom: 12 }}>
                    직접 입력해야 하는 항목들이 있습니다.
                  </Text>
                ) : null}
                <Text style={[s.muted, { marginBottom: 12 }]}>
                  {breakSentences("재고명, 수량, 권장 소진일을 확인해주세요. 권장 소진일은 AI가 예측해서 기록됩니다. 원본 이미지는 저장하지 않습니다.")}
                </Text>
                {groups.map((group, groupIndex) => (
                  <View key={group.id} style={{ marginBottom: 16 }}>
                    {group.selection ? <>
                      <Text style={[s.text, { fontWeight: '700', marginBottom: 4 }]}>{`사진 ${groupIndex + 1} · 확인할 재고 ${group.rows.length}개`}</Text>
                      <PurchasePhotoPreview selection={group.selection} collapsible onEnlarge={() => enlarge(group.selection!)} />
                    </> : null}
                    {group.rows.map((row) => (
                  <View
                    key={row.id}
                    style={[s.card, {
                      padding: 12,
                      marginBottom: 12,
                      borderRadius: 16,
                      borderColor: row.needsReview ? "#c64b3c" : color.line,
                      borderWidth: row.needsReview ? 2 : 1,
                    }]}
                  >
                    <Text style={[s.muted, { fontWeight: "700" }]}>재고명</Text>
                    <TextInput editable={!busy} onFocus={(event) => { focusedInput.current = event.nativeEvent.target; revealFocusedInput(); }} onBlur={() => { focusedInput.current = null; }} accessibilityLabel={`${row.name || "미확인 식품"} 재고명`} value={row.name} onChangeText={(name) => onChangeRow(row.id, { name })} style={s.input} />
                    <Text style={[s.muted, { fontWeight: "700" }]}>수량</Text>
                    <TextInput editable={!busy} onFocus={(event) => { focusedInput.current = event.nativeEvent.target; revealFocusedInput(); }} onBlur={() => { focusedInput.current = null; }} accessibilityLabel={`${row.name || "미확인 식품"} 수량`} placeholder="예: 300g, 2개" value={row.quantityText} onChangeText={(quantityText) => onChangeRow(row.id, { quantityText })} style={s.input} />
                    <Text style={[s.muted, { fontWeight: "700", marginTop: 8 }]}>보관 상태</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginVertical: 8 }}>
                      {([['room_temperature', '실온'], ['refrigerated', '냉장'], ['frozen', '냉동']] as const).map(([method, label]) => (
                        <Pressable
                          key={method}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel={`${row.name || "식품"} ${label} 보관`}
                          accessibilityState={{ selected: row.storageMethod === method }}
                          onPress={() => onChangeRow(row.id, { storageMethod: method })}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: row.storageMethod === method ? color.green : color.line,
                            backgroundColor: row.storageMethod === method ? "#edf6eb" : "#fff",
                          }}
                        >
                          <Text style={{ color: row.storageMethod === method ? color.green : color.muted }}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={[s.muted, { fontWeight: "700" }]}>권장 소진일</Text>
                    <UseByDateField label={`${row.name || "미확인 식품"} 권장 소진일`} value={row.useByDate} disabled={busy} onChange={(useByDate) => onChangeRow(row.id, { useByDate })} />
                  </View>
                ))}
                {group.failures.map((failure) => (
                  <View key={failure.id} style={[s.card, { padding: 12, marginBottom: 12, borderColor: "#c64b3c" }]}>
                    <Text style={[s.text, { fontWeight: "700" }]}>{failure.label}</Text>
                    <Text style={{ color: "#a94232" }}>{failure.error}</Text>
                  </View>
                ))}
                    {group.selection && !group.rows.length && !group.failures.length ? <Text style={s.muted}>{busy ? "사진을 분석하고 있어요…" : "이 사진에서 등록할 식품을 찾지 못했어요."}</Text> : null}
                  </View>
                ))}
                {error ? <Text style={{ color: "#a94232", marginTop: 10 }}>{error}</Text> : null}
              </View>
              {rows.length ? (
                <AppButton loading={busy} disabled={rows.some((row) => row.needsReview) || failures.length > 0} onPress={onRegister}>확인한 재고 모두 등록</AppButton>
              ) : null}
              <AppButton secondary disabled={busy} onPress={onChooseOther}>다른 이미지 선택</AppButton>
              {!rows.length && failures.length ? <AppButton secondary disabled={busy} onPress={onOpenDirect}>직접 입력</AppButton> : null}
            </>
          ) : picker ? (
            <>
              <View>
                <Text style={[s.muted, { marginBottom: 12 }]}>{breakSentences("심사용 샘플을 고르거나 직접 이미지를 등록하세요. 한 번에 최대 10장까지 분석합니다.")}</Text>
                <View style={s.grid}>
                  {samples.map((sample) => {
                    const selected = selections.some((item) => item.id === sample.id);
                    return (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected, disabled: busy }}
                        accessibilityLabel={`${sample.id} 구매내역 선택`}
                        disabled={busy}
                        key={sample.id}
                        onPress={() => onToggleSample(sample)}
                        style={[s.card, {
                          width: "47%",
                          padding: 8,
                          borderRadius: 16,
                          borderColor: selected ? color.green : color.line,
                          borderWidth: selected ? 2 : 1,
                        }]}
                      >
                        <Image source={sample.source} resizeMode="cover" style={{ width: "100%", height: 116, borderRadius: 10 }} />
                        <View style={s.row}>
                          <Text style={[s.text, { flex: 1, fontWeight: "700" }]}>{sample.id}</Text>
                          {selected ? <Check size={18} color={color.green} /> : null}
                        </View>
                        <Text style={s.muted}>{sample.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {selections.length ? <Text style={[s.text, { fontWeight: '700', marginVertical: 12 }]}>선택한 사진 · X를 누르면 선택이 해제돼요</Text> : null}
                <View style={s.grid}>
                  {selections.map((item) => <View key={item.id} style={{ width: '47%' }}><PurchasePhotoPreview selection={item} busy={busy} onEnlarge={() => enlarge(item)} onRemove={() => onRemoveSelection(item.id)} /></View>)}
                </View>
                {busy ? (
                  <View style={[s.loadingRow, { marginTop: 12 }]}>
                    <Text accessibilityLiveRegion="polite" style={[s.text, { flex: 1 }]}>{progress} 분석 중…</Text>
                    <ActivityIndicator size="small" color={color.green} />
                  </View>
                ) : null}
                {error ? <Text style={{ color: "#a94232", marginTop: 10 }}>{error}</Text> : null}
              </View>
              {selections.length ? <AppButton loading={busy} onPress={onAnalyze}>{`선택한 이미지 분석 (${selections.length})`}</AppButton> : null}
              <AppButton secondary disabled={busy} onPress={onPickImages}>이미지 등록</AppButton>
            </>
          ) : (
            <>
              <Text style={s.muted}>{breakSentences("구매내역 캡처를 AI로 분석하거나 식품을 직접 입력할 수 있습니다.")}</Text>
              <AppButton onPress={onOpenPicker}>구매내역 캡처 등록</AppButton>
              <AppButton secondary onPress={onOpenDirect}>직접 입력</AppButton>
            </>
          )}
          <AppButton secondary disabled={busy} onPress={onClose}>닫기</AppButton>
        </ScrollView>
      </KeyboardAvoidingView>
      {enlarged ? <PurchasePhotoEnlargement key={enlarged.id} selection={enlarged} onClose={() => setEnlarged(null)} /> : null}
    </Modal>
  );
}
