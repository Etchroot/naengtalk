import type { InventoryItem } from '../domain/cooking.ts';
import { mapInventoryLotRows, type InventoryLotRow } from '../domain/remote-inventory.ts';
import { supabase } from './supabase.ts';

export async function loadRemoteInventory(): Promise<InventoryItem[]> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  const { data, error } = await supabase
    .from('inventory_lots')
    .select('id, ingredient_key, display_name, quantity, unit, use_by_at, date_source')
    .gt('quantity', 0)
    .order('use_by_at', { ascending: true });
  if (error) throw error;
  return mapInventoryLotRows((data ?? []) as InventoryLotRow[]);
}
