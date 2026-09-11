export function breakSentences(value: string): string {
  return value.replace(/([.!?])\s+(?=[0-9A-Za-z가-힣])/g, '$1\n');
}
