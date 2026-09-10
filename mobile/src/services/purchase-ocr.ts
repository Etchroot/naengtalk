import { parsePurchaseOcrResponse, type PurchaseOcrResponse } from '../domain/purchase-ocr.ts';
import type { PurchaseSelection } from '../domain/purchase-review.ts';
import { supabase } from './supabase.ts';

async function imageToDataUrl(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('이미지를 불러오지 못했습니다.');
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

export async function analyzePurchaseImage(selection: PurchaseSelection): Promise<PurchaseOcrResponse> {
  if (!supabase) throw new Error('AI 서버 연결 설정이 필요합니다.');
  const imageDataUrl = await imageToDataUrl(selection.uri);
  const { data, error } = await supabase.functions.invoke('purchase-ocr', {
    body: { sampleId: selection.kind === 'sample' ? selection.id : 'UPLOAD', imageDataUrl },
  });
  if (error) throw new Error('구매내역을 분석하지 못했습니다. 잠시 후 다시 시도해주세요.');
  return parsePurchaseOcrResponse(data);
}
