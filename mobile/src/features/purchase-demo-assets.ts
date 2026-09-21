export type PurchaseDemoAsset = {
  id: 'R1' | 'R3' | 'R4' | 'R5';
  label: string;
  source: number;
};

export const purchaseDemoAssets: PurchaseDemoAsset[] = [
  { id: 'R1', label: '예시 1', source: require('../../assets/demo/purchases/r1.jpg') },
  { id: 'R3', label: '예시 2', source: require('../../assets/demo/purchases/r3.jpg') },
  { id: 'R4', label: '예시 3', source: require('../../assets/demo/purchases/r4.jpg') },
  { id: 'R5', label: '예시 4', source: require('../../assets/demo/purchases/r5.jpg') },
];
