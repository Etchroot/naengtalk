import type { InventoryCandidate } from '../domain/purchase-ocr.ts';
import { supabase } from './supabase.ts';

export async function registerRemoteInventory(candidates: InventoryCandidate[]): Promise<number> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  if (!candidates.length) throw new Error('자동 등록할 수 있는 식품이 없습니다.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('로그인이 만료되었습니다.');

  const rows = candidates.map((candidate) => ({ ...candidate, owner_id: auth.user.id }));
  const { error } = await supabase.from('inventory_lots').insert(rows);
  if (error) throw new Error('재고를 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
  return rows.length;
}
