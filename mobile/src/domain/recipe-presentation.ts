export function formatCookingStepTitle(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("올바른 조리 단계가 필요합니다.");
  }
  return `조리 단계 ${index + 1}`;
}
