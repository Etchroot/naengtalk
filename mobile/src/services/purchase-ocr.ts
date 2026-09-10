import { Image, type ImageSourcePropType } from 'react-native';
import { parsePurchaseOcrResponse, type PurchaseOcrResponse } from '../domain/purchase-ocr.ts';
import { supabase } from './supabase.ts';

async function assetToDataUrl(source: ImageSourcePropType): Promise<string> {
  const resolved = Image.resolveAssetSource(source);
  if (!resolved?.uri) throw new Error('샘플 이미지를 불러오지 못했습니다.');
  const response = await fetch(resolved.uri);
  if (!response.ok) throw new Error('샘플 이미지를 불러오지 못했습니다.');
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지를 분석 형식으로 바꾸지 못했습니다.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('이미지를 분석 형식으로 바꾸지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

export async function analyzePurchaseDemo(
  sampleId: string,
  source: ImageSourcePropType,
): Promise<PurchaseOcrResponse> {
  if (!supabase) throw new Error('AI 서버 연결 설정이 필요합니다.');
  const imageDataUrl = await assetToDataUrl(source);
  const { data, error } = await supabase.functions.invoke('purchase-ocr', {
    body: { sampleId, imageDataUrl },
  });
  if (error) throw new Error('구매내역을 분석하지 못했습니다. 잠시 후 다시 시도해주세요.');
  return parsePurchaseOcrResponse(data);
}
