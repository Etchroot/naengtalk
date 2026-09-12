import type { InventoryItem } from './cooking.ts';
import { createGuestInventory } from './seed.ts';

export async function resetGuestDemoInventory(input: {
  mode: 'local' | 'supabase';
  date: string;
  resetRemote: () => Promise<void>;
  loadRemote: () => Promise<InventoryItem[]>;
}): Promise<InventoryItem[]> {
  if (input.mode === 'local') return createGuestInventory(input.date);

  await input.resetRemote();
  return input.loadRemote();
}
