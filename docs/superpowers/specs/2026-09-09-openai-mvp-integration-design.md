# OpenAI MVP 연동 설계

## 목표

냉톡의 게스트와 일반 사용자가 실제 GPT 대화를 통해 현재 원격 재고에 맞는 레시피 한 가지를 받고, 생성된 레시피를 기존 상세·타이머·요리 완료·Supabase 재고 차감 흐름에서 사용할 수 있게 한다.

## MVP 범위

- 채팅 입력에 대한 실제 AI 답변
- 현재 사용자 소유의 Supabase 재고를 서버에서 조회해 프롬프트에 포함
- 보유 조리도구와 등록 알레르기를 추천 조건에 포함
- 일반 대화는 `gpt-5.6-luna`, 레시피 생성·수정은 `gpt-5.6-terra` 사용
- 레시피 요청 시 만개의레시피를 우선 검색하고 근거가 없을 때만 검색 범위를 확장
- 구조화된 레시피를 현재 전체 화면 상세과 요리 완료 차감에 연결
- 요청 실패 시 기존 재고를 변경하지 않고 사용자에게 재시도 안내

이번 연동에서는 구매내역 OCR, Google OAuth, 푸시 알림, 채팅 30일 자동 삭제 작업을 함께 구현하지 않는다.

## 구조

클라이언트는 OpenAI를 직접 호출하지 않고 인증된 Supabase Edge Function `menu-chat`만 호출한다. Edge Function은 전달받은 JWT로 사용자를 확인하고 같은 사용자의 `inventory_lots`를 직접 조회한다. OpenAI API 키는 Supabase Secret `OPENAI_API_KEY`로만 읽으며 앱 번들·GitHub·로그에는 포함하지 않는다.

```text
Expo 채팅 화면
  → Supabase functions.invoke("menu-chat")
  → JWT 검증 및 사용자별 호출 제한
  → RLS가 적용된 현재 재고 조회
  → Luna 의도 분류·일반 응답
  → 레시피가 필요할 때 Terra + 웹 검색
  → 구조화 JSON 검증
  → 채팅 답변·레시피 상세 표시
  → 사용자 요리 완료 확인
  → 기존 원격 조리 완료 트랜잭션
```

## 요청과 응답 계약

클라이언트 요청은 다음 필드만 허용한다.

```ts
type MenuChatRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  cookingTools: string[];
  allergens: string[];
};
```

- `message`는 공백 제거 후 1~500자다.
- `history`는 최근 6개 메시지만 사용하고 각 메시지는 최대 500자로 자른다.
- 조리도구는 최대 20개, 알레르기는 최대 20개만 전달한다.
- 게스트의 기본 알레르기는 `새우`다.

Edge Function 응답은 다음 구조를 사용한다.

```ts
type MenuChatResponse = {
  reply: string;
  recipe: null | {
    title: string;
    reason: string;
    servings: number;
    minutes: number;
    difficulty: "쉬움" | "보통" | "어려움";
    ingredients: Array<{
      ingredientKey: string | null;
      name: string;
      quantity: number | null;
      unit: "g" | "ml" | "개" | "대" | null;
      inInventory: boolean;
      requiredPurchase: boolean;
    }>;
    steps: Array<{ text: string; minutes: number }>;
    sources: Array<{ title: string; url: string }>;
  };
};
```

현재 재고에서 차감 가능한 수치·단위가 있는 재료만 요리 완료 미리보기에 포함한다. 구매가 필요한 재료는 레시피 화면에 구분해 표시하고 재고에서 차감하지 않는다. 모델 출력은 JSON Schema로 제한하고 Edge Function에서 다시 검증한다.

## 모델 라우팅과 검색

1. Luna가 사용자 입력과 최근 대화를 보고 `reply_only`, `recipe`, `recipe_revision` 중 하나로 분류한다.
2. `reply_only`는 Luna 응답을 그대로 구조화해 반환한다.
3. `recipe` 또는 `recipe_revision`은 Terra를 호출한다.
4. 첫 Terra 호출은 OpenAI 웹 검색의 허용 도메인을 `10000recipe.com`으로 제한한다.
5. 신뢰할 수 있는 출처나 실행 가능한 레시피를 얻지 못했을 때만 두 번째 Terra 호출에서 `youtube.com`과 일반 웹으로 확장한다.
6. 한 사용자 요청에서 Luna 1회, Terra 최대 2회, 웹 검색 최대 2회를 넘지 않는다.

레시피 생성 지침은 재고, 임박일, 조리도구, 알레르기, 1인분 기본값을 포함한다. 알레르기와 고위험 식재료 안전 조건은 생성 결과에서도 다시 검사하며 문제가 있으면 레시피를 사용자에게 노출하지 않는다.

## 비용과 남용 방지

- OpenAI Responses API 요청은 `store: false`로 실행한다.
- 일반 응답은 출력 토큰을 500 이하, 레시피 응답은 1,800 이하로 제한한다.
- 게스트 기준 사용자별 분당 5회, 하루 30회로 제한한다.
- 요청 본문 크기와 대화 길이를 서버에서 제한한다.
- OpenAI 프로젝트 전체 사용 한도는 사용자가 설정한 월 $20를 따른다.
- 10명 × 하루 3회 × 7일의 210회 사용은 일반적인 레시피 대화 기준 약 $7~15로 예상하며, 검색 횟수와 실제 입출력 토큰에 따라 달라진다.

## 오류 처리

- 인증 실패: 401
- 사용자별 호출 한도 초과: 429와 한국어 재시도 안내
- 입력 계약 오류: 400
- OpenAI 시간 초과·서버 오류: 502 또는 504, 재고와 레시피 기록은 변경하지 않음
- 모델 JSON 검증 실패: Terra 재시도는 요청당 한 번만 허용하며 다시 실패하면 일반 안내만 반환
- 검색 근거 부족: 출처 없는 레시피를 확정하지 않고 조건을 바꾸거나 다른 메뉴를 요청하도록 안내

## 최소 테스트와 완료 기준

빠른 MVP 구현 단계에서는 다음만 자동화한다.

- 요청 길이·최근 6개 대화 제한과 구조 검증
- 모델 레시피 응답을 앱 레시피·재고 차감 형식으로 변환하는 테스트
- 잘못된 수량·단위·알레르기 포함 결과 거부 테스트
- TypeScript 타입 검사와 웹 export

사용자가 Supabase Secret에 API 키를 등록한 뒤 실제 익명 로그인으로 채팅 한 번, 레시피 생성 한 번, 요리 완료 후 원격 재고 차감 한 번을 smoke test한다. 전체 화면·Android 실기기·게스트 격리·배포 링크 검증은 웹 배포와 APK 빌드 직전 최종 테스트 단계에서 수행한다.
