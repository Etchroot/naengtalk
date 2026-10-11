# Google Play 한국어·영어 전 기능 현지화 감사

기준: `codex/google-play-launch`의 2026-09-29 작업 트리 코드 정적 감사. 대상은 한국·미국·캐나다·호주 18세 이상 Android 공개판과 연결된 공개 웹 경로다. `docs/GOOGLE_PLAY_RELEASE.md`의 다국어 게이트가 **대기**인 상태를 전제로 한다. 아래는 구현 완료 기록이 아니라 코드에서 확인한 결함과 작업 지시다. 사용자가 입력한 식품명·대화와 외부 원문은 번역 대상으로 간주하지 않는다.

## 코드로 확인한 현 상태

| 우선순위 | 근거와 영향 | 작업 파일 묶음 |
| --- | --- | --- |
| P0 | 로케일 상태·설정·저장 경로가 보이지 않는다. `NaengTalk.tsx`는 계정별 상태를 AsyncStorage에 저장하지만 언어를 갖지 않고, 설정에는 언어 선택이 없다. 로그인 전후에 같은 언어를 보장할 수 없다. | `mobile/src/features/NaengTalk.tsx`, `mobile/src/features/naengtalk/model.ts`, `mobile/src/features/naengtalk/screens/settings-screen.tsx`, `mobile/src/app/_layout.tsx`, `mobile/src/services/session-storage.ts` 및 신규 공통 i18n 모듈 |
| P0 | 로그인·홈·재고·채팅·레시피·조리도구·설정·하단 탭·헤더, 등록/검수/정렬/초과 사용/공유/레시피 상세 모달의 표시·상태·접근성 문구가 코드에 직접 박혀 있다. `NaengTalk.tsx`에도 토스트·확인창·진행 문구가 있다. | `mobile/src/features/NaengTalk.tsx`, `mobile/src/features/naengtalk/screens/*.tsx`, `mobile/src/features/naengtalk/modals/*.tsx`, `mobile/src/features/naengtalk/components/{app-header,bottom-navigation}.tsx` |
| P0 | 서비스·도메인 오류는 한국어 `Error.message`를 만들고 화면이 그대로 보여준다. `messageFromFunctionError`는 서버 JSON의 `error` 문자열을 그대로 반환한다. 서버 세 함수와 삭제 함수도 한국어 `error`를 반환한다. | `mobile/src/domain/{function-error,menu-chat,purchase-ocr,purchase-review,chat-inventory,cooking,remote-cooking,usage-review,oauth-callback}.ts`, `mobile/src/services/*.ts`, `supabase/functions/{menu-chat,inventory-parse,purchase-ocr,delete-account}/index.ts` |
| P0 | `inventory-parse`는 한국어 입력·한국어 반환을 지시하고, OCR은 한국 온라인 장보기·한국어 반환을 가정한다. 메뉴 라우터와 레시피 생성도 한국어 답변을 강제한다. 요청 타입과 서비스 호출에 로케일이 없다. | `mobile/src/services/{menu-chat,inventory-parse,purchase-ocr}.ts`, `mobile/src/domain/menu-chat.ts`, `supabase/functions/_shared/{inventory-parse-contract,purchase-ocr-contract,recipe-guidelines,menu-chat-contract}.ts`, `supabase/functions/{menu-chat,inventory-parse,purchase-ocr}/index.ts` |
| P0 | 영어 발화·영어 재고명은 안전한 매칭을 통과한다고 볼 수 없다. `recipe-routing.ts`는 한국어 조사 경계를 사용하고, 재고 변경 검증은 발화와 `display_name`의 문자 포함을 요구한다. 레시피 재고 검사는 표시 이름의 문자 포함과 `ingredient_key`를 사용하며, 물 예외와 냉장·냉동 감지는 한국어 문자열이다. 알레르기 별칭은 `새우`에만 일부 영어가 있다. | `supabase/functions/_shared/{recipe-routing,menu-chat-contract,recipe-inventory-guard,shelf-life-contract}.ts`, `mobile/src/domain/{purchase-ocr,menu-chat}.ts`; 재고·레시피 조회 RPC/데이터 계약도 함께 검토 |
| P0 | 수량 입력·AI JSON enum·레시피 검증에 `개`·`대`가 내부 단위로 쓰이고 영어 `pcs`, `piece`, `stalk` 등의 입력 경로가 없다. 난이도 enum은 `쉬움/보통/어려움`이고 영문 출력은 클라이언트 파서가 거절한다. | `mobile/src/domain/{menu-chat,purchase-ocr,purchase-review,chat-inventory}.ts`, `mobile/src/features/NaengTalk.tsx`, `supabase/functions/_shared/{menu-chat-contract,inventory-parse-contract,purchase-ocr-contract,recipe-inventory-guard,recipe-guidelines}.ts` |
| P1 | 홈의 `Today`는 영어 고정, 날짜 라벨은 `MM.DD`; 레시피 날짜는 문자열 치환, `분/인분/종`은 직접 연결한다. 이름 정렬은 `Intl.Collator("ko-KR")` 고정이다. 여러 등록 기준일은 UTC `toISOString().slice(0,10)`이며 홈 오늘은 기기 현지 날짜다. 날짜 경계에서 하루 차이가 날 수 있다. | `mobile/src/domain/{date-presentation,inventory-presentation,purchase-review}.ts`, `mobile/src/features/NaengTalk.tsx`, `mobile/src/features/naengtalk/screens/{home,inventory,recipes}-screen.tsx`, `mobile/src/features/naengtalk/modals/recipe-detail-modal.tsx` |
| P1 | 샘플 재고·도구·레시피, AI 생성 출처 문구, 서버의 `internalNote`와 원천명은 한국어다. 원본/저장된 품목명과 레시피를 로케일 변경만으로 번역했다고 표시하면 안 된다. | `mobile/src/domain/{seed,recipe-provenance,menu-chat}.ts`, `mobile/src/features/naengtalk/{model,sample-recipe}.ts`, `supabase/functions/_shared/{recipe-guidelines,shelf-life-contract}.ts`, `supabase/functions/inventory-parse/index.ts` |
| P1 | 공개 `/delete-account`는 한·영 문단을 동시에 보여주지만 상태·오류·확인창은 한국어다. 현재 `mobile/src/app`에서 개인정보처리방침·이용약관·지원용 정적 경로는 확인되지 않았다. 출시 문서는 이 공개 URL과 양 언어를 요구한다. | `mobile/src/app/delete-account.tsx`, 신규 공개 라우트와 설정 링크, 공개 웹의 메타데이터·언어 표기 |

## 구현 순서와 계약

### P0-1. 앱 로케일을 하나의 상태로 확정

1. 지원 UI 언어를 `ko`, `en`으로 제한한다. 첫 실행은 기기 선호 언어가 한국어면 `ko`, 그 외면 `en`으로 시작한다. 국가와 언어는 별개로 둔다. `en-US`, `en-CA`, `en-AU`는 공통 영어 번역을 쓰되 날짜·숫자 표시에는 기기 지역 정보를 사용할 수 있다.
2. 로그인 화면에서도 언어를 바꿀 수 있게 하고 설정에서도 같은 제어를 제공한다. 사용자가 선택한 값은 계정 데이터와 분리된 기기 범위 저장소에 영속화한다. 재실행·로그아웃·다른 계정 로그인에도 선택을 유지한다. 명시적 선택이 없을 때만 기기 언어를 따른다. 저장값이 깨졌거나 지원 밖이면 안전한 기본값으로 돌아간다.
3. 번역 키와 변수 보간·복수형을 공통 모듈로 제공한다. 화면·오류·접근성·알림·확인창 모두 이 상태를 사용한다. 영어에서 긴 텍스트가 잘리지 않도록 360×800 기준 화면과 작은 Android 폰트 확대에서 검수한다.
4. `ko`/`en`은 서버에 명시적으로 전달한다. 서버는 허용 목록을 검증하고 누락된 구버전 요청에는 기존 `ko` 동작을 유지한다. 요청별 로케일을 로그나 DB에 불필요하게 저장하지 않는다.

**통과:** 새 설치, 재실행, 로그아웃, 계정 전환, 기기 언어 변경, 설정 선택 각각에서 로그인 전후 UI 언어가 예측한 값과 일치한다. Android와 웹 `/delete-account`에서 두 언어를 직접 선택해 동일 결과를 확인한다.

### P0-2. 문구와 오류를 키·코드로 전환

1. 위 표의 모든 `mobile/src/features`·`mobile/src/app` 표시 문구와 동적 접근성 라벨을 번역 리소스로 옮긴다. 버튼뿐 아니라 빈 상태, 로딩, 실패, 구매 이미지 진행률, 공유 동의, 삭제 확인, 타이머 완료, 광고/동의 관련 사용자 문구까지 포함한다.
2. 도메인·서비스의 사용자 표시 오류를 안정적인 오류 코드와 매개변수로 전환하고 화면 경계에서 번역한다. Edge Function 응답은 기계 판독 `code`와 허용된 매개변수를 제공한다. 기존 `error` 문자열은 이전 클라이언트 호환이 필요하면 유지하되, 새 클라이언트는 이를 직접 렌더링하지 않는다. 알 수 없는 코드·비 JSON·네트워크 실패는 선택 언어의 일반 오류와 재시도를 표시한다. 원문 사용자 입력은 오류에 포함하지 않는다.
3. `internalNote`, `sourceTitle`, OCR `note`처럼 응답에서 표시될 수 있는 문자열의 용도를 구분한다. 내부 진단값은 UI에서 숨기고, 사용자 안내는 코드/매개변수로 만든다. 실제 기관명·출처 제목은 원문으로 표시하되 안전 안내와 날짜의 성격은 번역한다.

**통과:** 두 언어에서 모든 화면·모달·TalkBack 라벨·오류 상태를 캡처한다. 함수별 400/401/413/422/429/502/503/504와 삭제 실패·오프라인에서 한국어 고정 오류가 영어 UI에 나오지 않으며 원래 입력은 보존된다.

### P0-3. 영어 입력·AI 생성·재고 안전을 함께 처리

1. `menu-chat`, `inventory-parse`, `purchase-ocr` 요청에 검증된 로케일을 전달한다. 프롬프트는 입력 언어에 관계없이 사실·수량·재고·알레르기 검증을 유지하고, 사용자용 답변·레시피 제목·재료·단계·설명만 선택 언어로 생성한다. 영어 주문내역 이미지와 영문 자유 입력의 인식·검수 실패 경로를 추가한다. OCR 원문은 번역하지 않는다.
2. `ingredient_key`, 단위, 보관 상태, 난이도는 언어와 무관한 내부 코드로 정규화한다. 기존 한국어 저장값/응답은 변환 계층에서 받아 마이그레이션 전후 모두 읽는다. 표시만 번역한다. `g`·`ml`·계량 `T/t`의 결정적 환산, 확인 전 재고 변경 금지, 원본 수량·단위 보존은 유지한다. `piece(s)`, `pcs`, `stalk(s)` 같은 영어 입력을 허용할 때 의미가 불명확한 포장 단위를 임의 환산하지 않고 확인으로 보낸다.
3. 영어와 한국어 재료명·알레르기 별칭을 같은 정규 식별자에 연결한다. 발화 검증은 언어별 토큰화/별칭과 원문 증거를 사용하되, 한국어 조사·이름 부분문자열 일치만으로 처리하지 않는다. 레시피의 재고 매칭은 신뢰 가능한 `ingredient_key`·단위와 실제 lot을 기준으로 하며, 영어 `water` 예외, `frozen/refrigerated` 보관 단서, 교차 언어 알레르기(예: 새우/shrimp/prawn)를 다룬다. 불확실한 이름·단위는 자동 차감하지 않고 검수로 전환한다.
4. 한국어 공공 카탈로그·한국어 기존 pantry 이름에서 영어 답변을 만드는 경우에도 출처/재료 식별자와 영문 표시명을 분리한다. 영문 제목을 새 식재료 키로 사용하지 않는다. 저장된 과거 대화·사용자 입력·레시피 원문은 언어 변경 시 자동 번역하지 않으며 새 응답에는 새 로케일을 적용한다.

**통과:** 한국어와 영어 각각 구매내역 OCR→검수→등록, `tofu 300 g, eggs 2 pieces` 직접 입력, `I bought/used/have ... left` 채팅 변경→승인/취소, 메뉴 요청→수정→사용량 검수→완료를 실행한다. 한글 재고를 가진 영어 요청과 영문 재고를 가진 한국어 요청을 포함한다. 없는 재료·단위 충돌·재고 초과·새우/shrimp/prawn 알레르기·가열 안전 실패는 두 언어 모두 자동 등록/차감/추천되지 않는다. 실패 시 JSON 계약이 깨지지 않고 재시도 또는 확인 경로를 보여준다.

### P1-4. 날짜·숫자·정렬과 초기 콘텐츠

1. DB/함수의 날짜 키는 `YYYY-MM-DD`로 유지하고 UI 표시만 로케일에 맞춘다. `Today`, 권장 소진일, 제공일, 분/인분/종, 수량과 단위를 번역·숫자 포맷한다. 날짜 입력은 로케일별 안내를 제공하되 정규화 전에 모호한 `04/05/2026`을 자동 해석하지 않는다. 현지 오늘과 등록 기준일을 같은 기기 시간대 기준으로 계산하고, 서버 계산 기준일과 차이가 나는 경계도 검증한다.
2. 이름 정렬은 선택 UI 로케일의 collator를 쓰되 날짜순 동률은 결정적으로 처리한다. 이는 PRD의 한국어 사전식 이름순 확정 규칙을 영어 화면에 확장하는 변경이므로 제품 기준도 구현 시 함께 갱신한다.
3. 데모 시드·샘플 레시피·기본 도구·알레르기 예시는 영어 모드에서 이해 가능한 표시명과 안정적인 내부 키를 제공한다. 기존 사용자 재고의 원본 표시명과 공식 출처명을 임의 번역·덮어쓰지 않는다.

**통과:** `ko-KR`, `en-US`, `en-CA`, `en-AU` 기기 설정에서 같은 날짜 키·수량이 알맞게 표시되고 저장값은 같다. 현지 자정 전후·UTC 날짜 전환·윤일·지난 날짜/오늘 날짜·소수 수량·이름 정렬을 테스트한다. 데모와 원격 계정 양쪽에서 영어 UI에 한국어 샘플 설명이 섞이지 않는다.

### P1-5. 공개 경로와 출시 문안

1. `/delete-account`를 선택 언어별 단일 문구·상태·오류·확인창·접근성 라벨로 완성한다. 로그인 전 브라우저에서도 언어 선택이 가능해야 한다.
2. 출시 문서가 요구한 개인정보처리방침·이용약관·지원 공개 경로와 앱 내 링크를 두 언어로 준비한다. 공개 신원·연락처가 아직 미정이므로 실제 게시 완료로 표시하지 않는다. Play 등록정보·스크린샷도 `ko`/`en` 별도로 검수한다.

**통과:** 로그아웃 상태의 공개 URL에서 두 언어를 선택하고, 실제 로그인→삭제 전 확인→취소/실패/성공을 시험한다. 앱 내 링크와 공개 페이지의 경로·언어·내용이 일치하고, 지원 정보가 확정된 뒤에만 게시 게이트를 통과시킨다.

## 완료 판정에 필요한 증거

- 번역 키 누락·미사용 키 검사와 한국어 하드코딩 정적 검색의 검토 결과. 사용자/외부 원문·내부 상수·테스트 fixture는 예외 이유를 기록한다.
- 두 언어 Android 실기기 핵심 흐름 영상 또는 화면 캡처, TalkBack 및 큰 글씨 확인, 웹 공개 경로 캡처.
- 영어/한국어 혼합 입력의 OCR·재고·레시피·알레르기·오류 계약 자동 테스트와 실제 함수 통합 테스트. AI 평가 샘플에는 안전 차단과 날짜/단위 불확실성 사례를 포함한다.
- 영어 기능 QA와 Play 언어별 등록정보 검수 후 `docs/GOOGLE_PLAY_RELEASE.md` 다국어 게이트 상태를 갱신한다. 이 문서 작성만으로 게이트를 통과로 바꾸지 않는다.
