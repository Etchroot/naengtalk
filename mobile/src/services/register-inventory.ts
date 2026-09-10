import type { InventoryImportItem } from '../domain/purchase-review.ts';
import { supabase } from './supabase.ts';

export async function registerRemoteInventory(
  candidates: InventoryImportItem[],
  requestKey: string,
): Promise<number> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  if (!candidates.length) throw new Error('자동 등록할 수 있는 식품이 없습니다.');
  const { data, error } = await supabase.rpc('register_inventory_import', {
    request_key: requestKey,
    items: candidates,
  });
  if (error) throw new Error('재고를 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
  if (data?.status === 'already_registered') return 0;
  return typeof data?.count === 'number' ? data.count : candidates.length;
}
