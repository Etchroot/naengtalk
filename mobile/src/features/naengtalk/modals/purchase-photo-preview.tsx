import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from '../../../components/app-text.tsx';
import type { PurchaseSelection } from '../../../domain/purchase-review.ts';
import { color, s } from '../../theme.ts';
import { AppButton } from '../components/app-button.tsx';

function sourceFor(selection: PurchaseSelection): ImageSourcePropType {
  return (selection.source as ImageSourcePropType | undefined) ?? { uri: selection.uri };
}

export function PurchasePhotoPreview({ selection, onEnlarge, onRemove, busy = false, collapsible = false }: {
  selection: PurchaseSelection; onEnlarge: () => void; onRemove?: () => void; busy?: boolean; collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      {collapsible ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${selection.label} 원본 ${expanded ? '접기' : '펼치기'}`} onPress={() => setExpanded(!expanded)} style={{ paddingVertical: 12 }}>
        <Text style={[s.text, { fontWeight: '700' }]}>{selection.label} · 원본 {expanded ? '접기 ▴' : '펼치기 ▾'}</Text>
      </Pressable> : null}
      {expanded ? <View style={{ position: 'relative' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${selection.label} 사진 확대 보기`} onPress={onEnlarge} style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: color.line, backgroundColor: '#f4f3ef' }}>
          {failed ? <Text style={[s.muted, { padding: 24 }]}>사진을 불러오지 못했어요. 다시 보려면 눌러주세요.</Text> : <Image source={sourceFor(selection)} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', height: collapsible ? 200 : 144 }} />}
          <Text style={[s.muted, { padding: 8 }]}>눌러서 확대 보기</Text>
        </Pressable>
        {onRemove ? <Pressable accessibilityRole="button" accessibilityLabel={`${selection.label} 선택 해제`} accessibilityHint="등록할 사진 선택만 해제합니다" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onRemove} style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', opacity: busy ? 0.4 : 1, borderWidth: 1, borderColor: color.line }}><X size={22} color={color.ink} /></Pressable> : null}
      </View> : null}
      {!collapsible ? <Text numberOfLines={2} style={[s.muted, { marginTop: 4 }]}>{selection.label}</Text> : null}
    </View>
  );
}

// Stays within the registration Modal so Android never opens a second native Modal.
export function PurchasePhotoEnlargement({ selection, onClose }: { selection: PurchaseSelection; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: 300, height: 440 });
  const [ratio, setRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const resolved = typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(sourceFor(selection)) : undefined;
    if (resolved?.width && resolved.height) setRatio(resolved.height / resolved.width);
    else Image.getSize(selection.uri, (width, height) => { if (active && width > 0) setRatio(height / width); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [selection]);
  const width = viewport.width * zoom;
  const height = width * ratio;
  return <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#fff', padding: 20, paddingTop: 40, zIndex: 10 }}>
    <Text numberOfLines={2} style={s.title}>{selection.label}</Text>
    <Text style={s.muted}>확대한 사진은 좌우·위아래로 움직여 볼 수 있어요.</Text>
    <View style={{ flex: 1, marginVertical: 12 }} onLayout={event => setViewport({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })}>
      {failed ? <View style={{ padding: 24 }}><Text style={s.text}>사진을 불러오지 못했어요.</Text><AppButton secondary onPress={() => setFailed(false)}>다시 불러오기</AppButton></View> : <ScrollView nestedScrollEnabled style={{ flex: 1 }} contentContainerStyle={{ minHeight: viewport.height }}><ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ minWidth: viewport.width }}><Image source={sourceFor(selection)} resizeMode="contain" onError={() => setFailed(true)} onLoad={event => { const image = event.nativeEvent.source; if (image?.width > 0 && image.height > 0) setRatio(image.height / image.width); }} style={{ width, height }} /></ScrollView></ScrollView>}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="사진 축소" accessibilityState={{ disabled: zoom <= 1 }} disabled={zoom <= 1} onPress={() => setZoom(Math.max(1, zoom - 0.5))} style={{ padding: 14 }}><Text style={s.text}>− 축소</Text></Pressable>
      <Text style={s.text}>{Math.round(zoom * 100)}%</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="사진 확대" accessibilityState={{ disabled: zoom >= 4 }} disabled={zoom >= 4} onPress={() => setZoom(Math.min(4, zoom + 0.5))} style={{ padding: 14 }}><Text style={s.text}>+ 확대</Text></Pressable>
    </View>
    <AppButton secondary onPress={onClose}>확대 보기 닫기</AppButton>
  </View>;
}
