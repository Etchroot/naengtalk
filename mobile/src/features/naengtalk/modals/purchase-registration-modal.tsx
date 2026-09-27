import React from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { PurchaseReviewRow, PurchaseSelection } from "../../../domain/purchase-review.ts";
import { breakSentences } from "../../../domain/readable-text.ts";
import type { PurchaseDemoAsset } from "../../purchase-demo-assets.ts";
import { AppButton } from "../components/app-button.tsx";
import { color, s } from "../../theme.ts";

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
  const title = direct
    ? "식품 직접 입력"
    : rows.length || failures.length
      ? "구매내역 확인"
      : picker
        ? "구매내역 이미지 선택"
        : "재고 등록";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0007" }}>
        <View style={[s.card, { alignSelf: "center", width: "100%", maxWidth: 440, maxHeight: "90%" }]}>
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
              <ScrollView showsVerticalScrollIndicator={false}>
                {rows.some((row) => row.needsReview) || failures.length ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: "#a94232", fontWeight: "700", marginBottom: 12 }}>
                    직접 입력해야 하는 항목들이 있습니다.
                  </Text>
                ) : null}
                <Text style={[s.muted, { marginBottom: 12 }]}>
                  {breakSentences("재고명, 수량, 권장 소진일을 확인해주세요. 권장 소진일은 AI가 예측해서 기록됩니다. 원본 이미지는 저장하지 않습니다.")}
                </Text>
                {rows.map((row) => (
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
                    <TextInput accessibilityLabel={`${row.name || "미확인 식품"} 재고명`} value={row.name} onChangeText={(name) => onChangeRow(row.id, { name })} style={s.input} />
                    <Text style={[s.muted, { fontWeight: "700" }]}>수량</Text>
                    <TextInput accessibilityLabel={`${row.name || "미확인 식품"} 수량`} placeholder="예: 300g, 2개" value={row.quantityText} onChangeText={(quantityText) => onChangeRow(row.id, { quantityText })} style={s.input} />
                    <Text style={[s.muted, { fontWeight: "700", marginTop: 8 }]}>보관 상태</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginVertical: 8 }}>
                      {([['room_temperature', '실온'], ['refrigerated', '냉장'], ['frozen', '냉동']] as const).map(([method, label]) => (
                        <Pressable
                          key={method}
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
                    <TextInput accessibilityLabel={`${row.name || "미확인 식품"} 권장 소진일`} inputMode="numeric" placeholder="YYYY-MM-DD" value={row.useByDate} onChangeText={(useByDate) => onChangeRow(row.id, { useByDate })} style={s.input} />
                  </View>
                ))}
                {failures.map((failure) => (
                  <View key={failure.id} style={[s.card, { padding: 12, marginBottom: 12, borderColor: "#c64b3c" }]}>
                    <Text style={[s.text, { fontWeight: "700" }]}>{failure.label}</Text>
                    <Text style={{ color: "#a94232" }}>{failure.error}</Text>
                  </View>
                ))}
                {error ? <Text style={{ color: "#a94232", marginTop: 10 }}>{error}</Text> : null}
              </ScrollView>
              {rows.length ? (
                <AppButton loading={busy} disabled={rows.some((row) => row.needsReview) || failures.length > 0} onPress={onRegister}>등록</AppButton>
              ) : null}
              <AppButton secondary onPress={onChooseOther}>다른 이미지 선택</AppButton>
            </>
          ) : picker ? (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
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
                {selections.filter((item) => item.kind === "library").map((item) => (
                  <View key={item.id} style={[s.row, { paddingVertical: 7 }]}>
                    <Text numberOfLines={1} style={[s.text, { flex: 1 }]}>{item.label}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${item.label} 선택 해제`} onPress={() => onRemoveSelection(item.id)}>
                      <Text style={{ color: "#a94232", fontWeight: "700" }}>삭제</Text>
                    </Pressable>
                  </View>
                ))}
                {busy ? (
                  <View style={[s.loadingRow, { marginTop: 12 }]}>
                    <Text accessibilityLiveRegion="polite" style={[s.text, { flex: 1 }]}>{progress} 분석 중…</Text>
                    <ActivityIndicator size="small" color={color.green} />
                  </View>
                ) : null}
                {error ? <Text style={{ color: "#a94232", marginTop: 10 }}>{error}</Text> : null}
              </ScrollView>
              {selections.length ? <AppButton loading={busy} onPress={onAnalyze}>{`선택한 이미지 분석 (${selections.length})`}</AppButton> : null}
              <AppButton secondary onPress={onPickImages}>이미지 등록</AppButton>
            </>
          ) : (
            <>
              <Text style={s.muted}>{breakSentences("구매내역 캡처를 AI로 분석하거나 식품을 직접 입력할 수 있습니다.")}</Text>
              <AppButton onPress={onOpenPicker}>구매내역 캡처 등록</AppButton>
              <AppButton secondary onPress={onOpenDirect}>직접 입력</AppButton>
            </>
          )}
          <AppButton secondary onPress={onClose}>닫기</AppButton>
        </View>
      </View>
    </Modal>
  );
}
