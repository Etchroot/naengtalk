import { parsePurchaseOcrResponse, type PurchaseOcrResponse } from '../domain/purchase-ocr.ts';
import { supabase } from './supabase.ts';

export async function analyzeInventoryText(text: string): Promise<PurchaseOcrResponse> {
  if (!supabase) throw new Error('AI 서버 연결 설정이 필요합니다.');
  const normalized = text.trim();
  if (!normalized) throw new Error('식품 이름과 수량을 입력해주세요.');
  if (normalized.length > 2000) throw new Error('직접 입력은 2,000자 이하로 작성해주세요.');
  const { data, error } = await supabase.functions.invoke('inventory-parse', {
    body: { text: normalized },
  });
  if (error) throw new Error('입력한 식품을 분석하지 못했습니다. 잠시 후 다시 시도해주세요.');
  return parsePurchaseOcrResponse(data);
}
