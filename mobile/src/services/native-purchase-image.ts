import type { PurchaseSelection } from '../domain/purchase-review.ts';

type NativeImageIO = {
  resolveSample: (source: number) => Promise<string>;
  readFile: (uri: string) => Promise<{ base64: string; mimeType: string; size: number }>;
};

export async function loadNativePurchaseImage(selection: PurchaseSelection, io: NativeImageIO): Promise<string> {
  let image: Awaited<ReturnType<NativeImageIO['readFile']>>;
  try {
    if (selection.kind === 'sample' && typeof selection.source !== 'number') throw new Error('Missing sample module');
    const uri = selection.kind === 'sample'
      ? await io.resolveSample(selection.source as number)
      : selection.uri;
    if (!uri) throw new Error('Missing local image');
    image = await io.readFile(uri);
  } catch {
    throw new Error('이미지 파일을 읽지 못했습니다. 다른 이미지를 선택한 뒤 다시 시도해주세요.');
  }
  if (image.size > 5 * 1024 * 1024) throw new Error('이미지는 한 장당 5MB 이하로 선택해주세요.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) {
    throw new Error('JPEG·PNG·WebP 형식의 이미지를 선택해주세요.');
  }
  if (!image.base64) throw new Error('이미지 파일이 비어 있습니다. 다른 이미지를 선택해주세요.');
  return `data:${image.mimeType};base64,${image.base64}`;
}
