import type { PurchaseSelection } from '../domain/purchase-review.ts';

export async function imageToDataUrl(selection: PurchaseSelection): Promise<string> {
  const response = await fetch(selection.uri);
  if (!response.ok) throw new Error('이미지를 불러오지 못했습니다.');
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지를 분석 형식으로 바꾸지 못했습니다.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('이미지를 분석 형식으로 바꾸지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}
