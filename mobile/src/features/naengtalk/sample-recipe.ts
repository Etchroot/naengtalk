import type { MenuRecipe } from "../../domain/menu-chat.ts";

export const sampleSteps = [
  {
    text: "김치 150g과 두부 100g을 먹기 좋은 크기로 잘라주세요. 사용 전 포장 표시와 보관 상태를 확인해주세요.",
    minutes: 0,
  },
  {
    text: "냄비에 김치와 물 350ml를 넣고 끓입니다. 끓기 시작하면 중약불에서 김치가 부드러워질 때까지 10분간 끓여주세요.",
    minutes: 10,
  },
  {
    text: "두부를 넣고 5분 더 끓여주세요. 간장 5ml를 넣고 맛을 확인합니다. 김치의 짠 정도에 따라 물을 조금 더 넣어주세요.",
    minutes: 5,
  },
  {
    text: "불을 끄고 그릇에 담아주세요. 실제로 사용한 양을 확인한 뒤 아래 요리 완료 버튼을 눌러 재고에 반영합니다.",
    minutes: 0,
  },
];

export const sampleRecipe: MenuRecipe = {
  origin: "DEMO",
  title: "김치 두부찌개",
  reason: "두부를 먼저 사용하면서 추가 구매 없이 만들 수 있어요.",
  servings: 1,
  minutes: 20,
  difficulty: "쉬움",
  ingredients: [
    { ingredientKey: "kimchi", name: "김치", quantity: 150, unit: "g", inInventory: true, requiredPurchase: false },
    { ingredientKey: "tofu", name: "두부", quantity: 100, unit: "g", inInventory: true, requiredPurchase: false },
    { ingredientKey: "soy", name: "간장", quantity: 5, unit: "ml", inInventory: true, requiredPurchase: false },
    { ingredientKey: null, name: "물", quantity: 350, unit: "ml", inInventory: false, requiredPurchase: false },
  ],
  steps: sampleSteps,
  sources: [],
};
