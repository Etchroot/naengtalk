# OpenAI Vision 구매내역 OCR 데모 구현 계획

> 실행 방식: 사용자가 승인한 `main` 브랜치에서 순차 실행한다. 각 로직 변경은 실패 테스트를 먼저 확인하고 최소 구현 후 전체 검증한다.

**목표:** 게스트가 번들된 R1~R5 구매내역 캡처를 선택해 OpenAI 비전으로 글자를 추출·구조화하고, 검수 가능한 결과 중 유효 품목을 자신의 Supabase 재고에 등록할 수 있게 한다.

**구조:** Expo 클라이언트는 선택한 번들 이미지를 data URL로 바꾸어 인증된 `purchase-ocr` Edge Function에 보낸다. 함수는 이미지 형식·크기와 일일 호출 한도를 검사한 뒤 `gpt-5.6-luna`의 이미지 입력과 strict JSON schema를 사용한다. 모델이 반환한 품목은 클라이언트의 결정적 날짜·단위 규칙을 통과한 뒤에만 `inventory_lots`로 저장한다. 원본 이미지와 OCR 원문은 영구 저장하지 않는다.

**기술:** Expo/React Native, TypeScript, Supabase Auth/Postgres/Edge Functions, OpenAI Responses API

---

## Task 1: OCR 계약과 결정적 재고 변환

**파일**

- 생성: `tests/purchase-ocr.test.ts`
- 생성: `mobile/src/domain/purchase-ocr.ts`
- 생성: `supabase/functions/_shared/purchase-ocr-contract.ts`

**절차**

1. 유효/오류 응답 파싱, 지원 단위, 검수 제외, 식품군별 D+ 오프셋, 안정적인 `ingredient_key`를 검증하는 테스트를 먼저 작성한다.
2. 새 테스트가 모듈 부재로 실패하는 것을 확인한다.
3. 모델 출력 검증과 `inventory_lots` 입력 행 변환을 순수 함수로 구현한다.
4. 서버 요청 data URL의 MIME·크기 검증 및 strict JSON schema를 구현한다.
5. 해당 테스트가 통과하는지 확인한다.

## Task 2: Supabase OCR 함수와 별도 호출 제한

**파일**

- 생성: `supabase/functions/purchase-ocr/index.ts`
- 생성: `supabase/functions/purchase-ocr/config.toml`
- 생성: `supabase/migrations/202609090003_purchase_ocr_rate_limits.sql`
- 수정: `tests/supabase-migration.test.ts`

**절차**

1. 기능별 일일 한도 RPC에 최소 권한과 소유자 격리가 적용되는지 검사하는 migration 테스트를 먼저 추가한다.
2. 새 migration이 없어 실패하는 것을 확인한다.
3. `purchase_ocr` 기능 전용 10회/일 원자적 카운터와 RPC를 추가한다.
4. JWT 사용자 확인, 입력 검증, 제한 소비, `gpt-5.6-luna` 이미지 분석, 오류 매핑을 구현한다.
5. `store:false`, `detail:original`, `reasoning:none`, `max_output_tokens:2000`, 35초 timeout을 적용하고 이미지·OCR 원문을 저장/로그하지 않는다.
6. migration 및 OCR 계약 테스트를 통과시킨다.

## Task 3: 게스트 샘플 UI·아이콘·재고 저장 연결

**파일**

- 생성: `mobile/src/features/purchase-demo-assets.ts`
- 생성: `mobile/src/services/purchase-ocr.ts`
- 생성: `mobile/src/services/register-inventory.ts`
- 수정: `mobile/src/features/NaengTalk.tsx`
- 수정: `mobile/app.json`
- 이동: `icon.png` → `mobile/assets/images/icon.png`
- 이동: `r1.jpg`~`r5.jpg` → `mobile/assets/demo/purchases/`

**절차**

1. 루트 자산의 경로와 목적지를 검증하고 앱 자산 폴더로 이동한다.
2. 앱 아이콘을 홈 타이틀 왼쪽과 Expo/Android/Web 아이콘 설정에 연결한다.
3. 공용 재고 등록 팝업에 `구매내역 캡처 등록`을 추가하고 R1~R5 선택 화면을 만든다.
4. 선택한 이미지를 data URL로 변환해 Edge Function을 호출하고, 이미지·OCR 원문·등록 후보·검수 필요 상태를 스크롤 가능한 결과 팝업으로 표시한다.
5. 유효 후보만 현재 사용자 소유의 `inventory_lots`에 넣고 재고를 다시 불러온다. 로컬 검증 모드에서는 동일 변환 결과를 화면 상태에 반영한다.
6. 타입 검사와 웹 export로 번들 자산 및 반응형 UI를 검증한다.

## Task 4: 샘플 판독 보고서와 프로젝트 문서 동기화

**파일**

- 생성: `docs/OCR_SAMPLE_RESULTS.md`
- 수정: `docs/PRD.md`
- 수정: `docs/TRD.md`
- 수정: `docs/PRODUCT_DECISIONS.md`
- 수정: `docs/OPENAI_SETUP.md`
- 수정: `TODO.md`
- 수정: `HUMAN-IN-THE-ROOF.md`
- 수정: `README.md`

**절차**

1. R1~R5에서 화면으로 판독한 원문과 서비스 등록 예상 결과를 이미지별로 기록하고, 실제 API 실행 전 기준 자료임을 명시한다.
2. MVP의 Android/웹 공통 OpenAI 비전 경로, 이미지 비영구 저장, 10회/일 제한, 검수 규칙으로 기존 하이브리드 OCR 문서를 갱신한다.
3. 사용자의 모델·비용·샘플·아이콘 결정과 남은 secret/배포 작업을 진행도·개입 기록에 반영한다.
4. 전체 테스트, TypeScript, Expo web export, `git diff --check`, 비밀값 패턴 검사를 실행한다.
5. 검증된 변경을 커밋하고 승인된 `main`에 push한다.
