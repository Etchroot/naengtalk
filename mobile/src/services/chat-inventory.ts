import { supabase } from './supabase.ts';

export type ChatInventoryApplyResult =
  | { status: 'applied' | 'already_applied'; count?: number; ignored?: number }
  | { status: 'needs_confirmation'; ingredient_key: string; display_name: string; available: number; unit: string };

export async function applyRemoteChatInventory(requestKey: string, changes: unknown[]): Promise<ChatInventoryApplyResult> {
  if (!supabase) throw new Error('재고 서버 연결 설정이 필요합니다.');
  const { data, error } = await supabase.rpc('apply_chat_inventory_change', {
    request_key: requestKey,
    changes,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object' || !['applied', 'already_applied', 'needs_confirmation'].includes(data.status)) {
    throw new Error('재고 반영 결과를 확인하지 못했습니다.');
  }
  return data as ChatInventoryApplyResult;
}
