export type PurchaseDemoAsset = {
  id: 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  label: string;
  source: number;
};

export const purchaseDemoAssets: PurchaseDemoAsset[] = [
  { id: 'R1', label: '두부·잎채소', source: require('../../assets/demo/purchases/r1.jpg') },
  { id: 'R2', label: '상추·대파', source: require('../../assets/demo/purchases/r2.jpg') },
  { id: 'R3', label: '컬리 장보기', source: require('../../assets/demo/purchases/r3.jpg') },
  { id: 'R4', label: '쌀밥·채소·카레', source: require('../../assets/demo/purchases/r4.jpg') },
  { id: 'R5', label: '마늘·두부·쌈장', source: require('../../assets/demo/purchases/r5.jpg') },
];
