import React from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import type { ChatInventoryRow } from "../../../domain/chat-inventory.ts";
import { AppButton } from "../components/app-button.tsx";
import { color, s } from "../../theme.ts";

export type ChatInventoryReviewModalProps = {
  rows: ChatInventoryRow[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
  onChangeRow: (id: string, patch: Partial<ChatInventoryRow>) => void;
};

export function ChatInventoryReviewModal({ rows, busy, error, onClose, onConfirm, onChangeRow }: ChatInventoryReviewModalProps) {
  return (
    <Modal visible={rows.length > 0} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#0007" }}>
        <View style={[s.card, { alignSelf: "center", width: "100%", maxWidth: 440, maxHeight: "85%" }]}>
          <Text style={s.title}>채팅 재고 변경 확인</Text>
          <Text style={s.muted}>재료명과 수량을 확인하고 승인하면 재고에 반영합니다.</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {rows.map((row) => (
              <View key={row.id} style={[s.card, { padding: 12, marginVertical: 6 }]}>
                <Text style={[s.text, { fontWeight: "700" }]}>
                  {row.action === "add" ? "추가" : row.action === "consume" ? "소비" : "남은 수량 설정"}
                </Text>
                <TextInput accessibilityLabel={`${row.name} 재료명`} style={s.input} value={row.name} onChangeText={(name) => onChangeRow(row.id, { name })} />
                <TextInput accessibilityLabel={`${row.name} 수량`} placeholder="예: 300g, 2개" style={s.input} value={row.quantityText} onChangeText={(quantityText) => onChangeRow(row.id, { quantityText })} />
                {row.action === "add" ? (
                  <>
                    <Text style={s.muted}>보관 상태</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginVertical: 8 }}>
                      {([['room_temperature', '실온'], ['refrigerated', '냉장'], ['frozen', '냉동']] as const).map(([method, label]) => (
                        <Pressable
                          key={method}
                          accessibilityRole="button"
                          accessibilityLabel={`${row.name} ${label} 보관`}
                          accessibilityState={{ selected: row.storageMethod === method }}
                          onPress={() => onChangeRow(row.id, { storageMethod: method, useByDate: "" })}
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
                    <Text style={s.muted}>권장 소진일</Text>
                    <TextInput accessibilityLabel={`${row.name} 권장 소진일`} placeholder="YYYY-MM-DD" style={s.input} value={row.useByDate} onChangeText={(useByDate) => onChangeRow(row.id, { useByDate })} />
                  </>
                ) : <Text style={s.muted}>현재 재고 {row.available}{row.unit}</Text>}
              </View>
            ))}
          </ScrollView>
          {error ? <Text accessibilityRole="alert" style={{ color: "#a94232" }}>{error}</Text> : null}
          <View style={s.row}>
            <View style={{ flex: 1 }}><AppButton secondary onPress={onClose}>취소</AppButton></View>
            <View style={{ flex: 1 }}><AppButton loading={busy} onPress={onConfirm}>승인</AppButton></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
