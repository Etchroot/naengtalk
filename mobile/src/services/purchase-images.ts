import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import type { PurchaseSelection } from '../domain/purchase-review.ts';
import type { PurchaseDemoAsset } from '../features/purchase-demo-assets.ts';

export function selectionFromSample(sample: PurchaseDemoAsset): PurchaseSelection {
  const uri = Asset.fromModule(sample.source).uri;
  if (!uri) throw new Error('샘플 이미지를 불러오지 못했습니다.');
  return {
    id: sample.id,
    label: `${sample.id} · ${sample.label}`,
    uri,
    source: sample.source,
    kind: 'sample',
  };
}

export async function pickPurchaseImages(): Promise<PurchaseSelection[]> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('사진 보관함 접근 권한이 필요합니다.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
  });
  if (result.canceled) return [];
  const batchId = Date.now();
  return result.assets.slice(0, 10).map((asset, index) => ({
    id: `upload-${batchId}-${index}-${asset.assetId ?? asset.fileName ?? 'image'}`,
    label: asset.fileName ?? `구매내역 이미지 ${index + 1}`,
    uri: asset.uri,
    kind: 'library' as const,
  }));
}
