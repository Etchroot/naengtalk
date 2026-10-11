import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { PurchaseSelection } from '../domain/purchase-review.ts';
import { loadNativePurchaseImage } from './native-purchase-image.ts';

export async function imageToDataUrl(selection: PurchaseSelection): Promise<string> {
  return loadNativePurchaseImage(selection, {
    resolveSample: async (source) => {
      const asset = await Asset.fromModule(source).downloadAsync();
      if (!asset.localUri) throw new Error('Missing local asset');
      return asset.localUri;
    },
    readFile: async (uri) => {
      const file = new File(uri);
      const size = file.size;
      const mimeType = file.type;
      if (size > 5 * 1024 * 1024) return { size, mimeType, base64: '' };
      return { size, mimeType, base64: await file.base64() };
    },
  });
}
