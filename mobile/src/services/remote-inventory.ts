import type { InventoryItem } from '../domain/cooking.ts';
import { mapInventoryLotRows, type InventoryLotRow } from '../domain/remote-inventory.ts';
import { supabase } from './supabase.ts';
import { persistInventoryWrite } from './inventory-write.ts';
import type { InventoryEditDraft } from '../domain/inventory-edit.ts';

export async function loadRemoteInventory(): Promise<InventoryItem[]> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  const { data, error } = await supabase
    .from('inventory_lots')
    .select('id, ingredient_key, display_name, quantity, unit, use_by_at, date_source, storage_method')
    .gt('quantity', 0)
    .order('use_by_at', { ascending: true });
  if (error) throw error;
  return mapInventoryLotRows((data ?? []) as InventoryLotRow[]);
}

export async function writeRemoteInventory(item: InventoryItem, draft: InventoryEditDraft | null): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Supabase 연결 설정이 필요합니다.');
  await persistInventoryWrite({
    ownerId: async () => {
      const {data, error} = await client.auth.getUser();
      if (error) throw new Error('로그인을 확인하지 못했습니다. 다시 시도해주세요.');
      return data.user?.id ?? null;
    },
    write: async ({ownerId, lotId, expected, patch}) => {
      // RLS and explicit owner/lot filters protect identity. Original values prevent lost updates.
      let query = (patch ? client.from('inventory_lots').update(patch) : client.from('inventory_lots').delete())
        .eq('owner_id', ownerId).eq('id', lotId)
        .eq('ingredient_key',expected.ingredientKey).eq('display_name',expected.name)
        .eq('quantity',expected.quantity).eq('unit',expected.unit).eq('use_by_at',expected.useBy);
      query = expected.storageMethod == null ? query.is('storage_method',null) : query.eq('storage_method',expected.storageMethod);
      const {data,error} = await query.select('id').maybeSingle();
      if (error) throw new Error('재고 변경을 저장하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.');
      return Boolean(data?.id);
    },
  },item,draft);
}
