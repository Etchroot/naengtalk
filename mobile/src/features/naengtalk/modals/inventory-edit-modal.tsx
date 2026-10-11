import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/app-text.tsx';
import type { InventoryItem } from '../../../domain/cooking.ts';
import { createInventoryEditDraft, validateInventoryEditDraft, type InventoryEditDraft } from '../../../domain/inventory-edit.ts';
import { AppButton } from '../components/app-button.tsx';
import { UseByDateField } from '../components/use-by-date-field';
import { color, s } from '../../theme.ts';

export type InventoryEditModalProps = {
  item: InventoryItem | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (draft: InventoryEditDraft) => void;
  onDelete: () => void;
};

export function InventoryEditModal({ item, busy, error, onClose, onSave, onDelete }: InventoryEditModalProps) {
  const [draft, setDraft] = useState<InventoryEditDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [validationError, setValidationError] = useState('');
  const scroll = useRef<ScrollView>(null);
  const focusedInput = useRef<number | null>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    setDraft(item ? createInventoryEditDraft(item) : null);
    setConfirmDelete(false);
    setValidationError('');
    focusedInput.current = null;
  }, [item]);
  const revealFocusedInput = useCallback(() => {
    if (Platform.OS !== 'web' && focusedInput.current !== null) {
      scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focusedInput.current, 24, true);
    }
  }, []);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', revealFocusedInput);
    return () => subscription.remove();
  }, [revealFocusedInput]);
  const change = (patch: Partial<InventoryEditDraft>) => {
    if (busy) return;
    setDraft((current) => current ? { ...current, ...patch } : current);
    setValidationError('');
  };
  const close = () => { if (!busy) onClose(); };
  const save = () => {
    if (busy || !draft) return;
    try {
      validateInventoryEditDraft(draft);
      Keyboard.dismiss();
      onSave(draft);
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : '입력한 재고 정보를 확인해주세요.');
    }
  };

  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView enabled={Platform.OS !== 'web'} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0007', paddingHorizontal: 24, paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(24, insets.bottom) }}>
        <ScrollView ref={scroll} onLayout={revealFocusedInput} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} style={{ alignSelf: 'center', width: '100%', maxWidth: 440, maxHeight: '90%', flexGrow: 0 }} contentContainerStyle={s.card}>
          <Text style={s.title}>{confirmDelete ? '재고 삭제 확인' : '재고 수정'}</Text>
          {item && draft ? confirmDelete ? (
            <>
              <Text style={s.text}>{item.name} · {item.quantity}{item.unit}</Text>
              <Text style={s.text}>이 재고를 삭제할까요?</Text>
              <Text style={s.muted}>삭제하면 재고 목록에서 사라집니다.</Text>
              {error ? <Text accessibilityLiveRegion="polite" style={{ color: '#a94232' }}>{error}</Text> : null}
              <AppButton loading={busy} onPress={() => { if (!busy) onDelete(); }}>삭제 확정</AppButton>
              <AppButton secondary disabled={busy} onPress={() => { setConfirmDelete(false); }}>돌아가기</AppButton>
              <AppButton secondary disabled={busy} onPress={close}>취소</AppButton>
            </>
          ) : (
            <>
              <Text style={s.muted}>식품 이름</Text>
              <TextInput accessibilityLabel="식품 이름" value={draft.name} editable={!busy} onChangeText={(name) => change({ name })} style={s.input} onFocus={(event) => { focusedInput.current = event.nativeEvent.target; revealFocusedInput(); }} onBlur={() => { focusedInput.current = null; }} />
              <Text style={s.muted}>남은 수량</Text>
              <TextInput accessibilityLabel="남은 수량" value={draft.quantityText} editable={!busy} inputMode="decimal" keyboardType="decimal-pad" onChangeText={(quantityText) => change({ quantityText })} style={s.input} onFocus={(event) => { focusedInput.current = event.nativeEvent.target; revealFocusedInput(); }} onBlur={() => { focusedInput.current = null; }} />
              <Text style={s.muted}>단위</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['g', 'ml', '개', '대'].map((unit) => (
                  <Pressable key={unit} accessibilityRole="button" accessibilityLabel={`수량 단위 ${unit}`} accessibilityState={{ selected: draft.unit === unit, disabled: busy }} disabled={busy} onPress={() => change({ unit })} style={{ minHeight: 44, minWidth: 48, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: draft.unit === unit ? color.green : color.line, backgroundColor: draft.unit === unit ? color.soft : 'white', opacity: busy ? 0.5 : 1 }}>
                    <Text style={{ color: draft.unit === unit ? color.green : color.muted }}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.muted}>보관 위치</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([['room_temperature', '실온'], ['refrigerated', '냉장'], ['frozen', '냉동']] as const).map(([storageMethod, label]) => (
                  <Pressable key={storageMethod} accessibilityRole="button" accessibilityLabel={`${label} 보관`} accessibilityState={{ selected: draft.storageMethod === storageMethod, disabled: busy }} disabled={busy} onPress={() => change({ storageMethod })} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: draft.storageMethod === storageMethod ? color.green : color.line, backgroundColor: draft.storageMethod === storageMethod ? color.soft : 'white', opacity: busy ? 0.5 : 1 }}>
                    <Text style={{ color: draft.storageMethod === storageMethod ? color.green : color.muted }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.muted}>권장 소진일</Text>
              <UseByDateField label="권장 소진일" value={draft.useByDate} allowPast disabled={busy} onChange={(useByDate) => change({ useByDate })} />
              {validationError || error ? <Text accessibilityLiveRegion="polite" style={{ color: '#a94232' }}>{validationError || error}</Text> : null}
              <AppButton loading={busy} onPress={save}>저장</AppButton>
              <AppButton secondary disabled={busy} onPress={() => { Keyboard.dismiss(); setValidationError(''); setConfirmDelete(true); }}>삭제</AppButton>
              <AppButton secondary disabled={busy} onPress={close}>취소</AppButton>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
