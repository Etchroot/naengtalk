export type InventoryItem = { id: string; name: string; quantity: number; unit: string; useBy: string; estimated: boolean };
export type Usage = { ingredientId: string; quantity: number; unit: string };
export type CookingState = { inventory: InventoryItem[]; completedSessionIds: string[] };
export function completeCooking(state: CookingState, sessionId: string, usage: Usage[]): CookingState {
  if (!sessionId.trim()) throw new Error('조리 세션이 필요합니다.');
  if (state.completedSessionIds.includes(sessionId)) return state;
  if (!usage.length) throw new Error('사용 재료를 확인해주세요.');
  const inventory = state.inventory.map(item => ({ ...item }));
  for (const line of usage) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('수량은 양수여야 합니다.');
    const item = inventory.find(item => item.id === line.ingredientId);
    if (!item) throw new Error('재료가 부족합니다. 구매하거나 사용량을 수정해주세요.');
    if (item.unit !== line.unit) throw new Error('단위 확인이 필요합니다.');
    if (item.quantity < line.quantity) throw new Error(`${item.name} 재고가 부족합니다.`);
    item.quantity = Math.round((item.quantity - line.quantity) * 1000) / 1000;
  }
  return { inventory, completedSessionIds: [...state.completedSessionIds, sessionId] };
}
export function remainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
