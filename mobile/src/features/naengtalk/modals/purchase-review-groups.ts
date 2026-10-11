import type { PurchaseSelection } from '../../../domain/purchase-review.ts';

export function groupPurchaseReviewSources<R extends { sourceId: string }, F extends { id: string }>(
  selections: PurchaseSelection[], rows: R[], failures: F[],
): { id: string; selection?: PurchaseSelection; rows: R[]; failures: F[] }[] {
  const ids = [...new Set([...selections.map(s => s.id), ...rows.map(r => r.sourceId), ...failures.map(f => f.id)])];
  return ids.map(id => ({
    id,
    selection: selections.find(s => s.id === id),
    rows: rows.filter(r => r.sourceId === id),
    failures: failures.filter(f => f.id === id),
  }));
}
