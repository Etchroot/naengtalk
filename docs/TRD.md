# 냉톡 TRD

- 문서 상태: 기술 설계 초안
- 기준일: 2026-09-02
- 대상: Android 앱 + 심사용 웹 MVP
- 개발 전환: 2026-09-08 사용자 승인. 앱 구현을 시작하며 실제 클라우드 연결은 별도 설정한다.

## 1. 기술 목표

- 한 코드베이스에서 Android와 웹의 핵심 흐름을 제공한다.
- AI 판단과 재고 변경 권한을 분리한다.
- 이미지·대화 같은 비정형 입력을 구조화하되, 낮은 신뢰도는 사용자 검수로 처리한다.
- 심사위원용 게스트 데이터가 다른 사용자 데이터와 분리되도록 보장한다.
- OpenAI Responses API 호출을 앱과 분리된 서버 adapter에 캡슐화한다.

## 2. 제안 아키텍처

| 계층 | 제안 기술 | 역할 | 상태 |
| --- | --- | --- | --- |
| 클라이언트 | Expo + React Native + TypeScript + Expo Router | Android·웹 UI와 탐색 | 확정 |
| 구매내역 OCR | OpenAI `gpt-5.6-luna` 비전 + strict JSON schema | Android·웹 공통 텍스트 추출·상품 구조화 | 확정·구현 |
| 백엔드 | Supabase Auth, Postgres, Storage, Edge Functions | 인증, 데이터, 이미지, 서버 로직 | 확정 |
| AI 게이트웨이 | Supabase Edge Function + OpenAI Responses API adapter | 구조화, 대화, 검색 판단, 레시피 변형 | 제공자·구조·모델 조합 확정 |
| 레시피 검색 | 비공개 Supabase `recipe_catalog` + 공유 AI 레시피 + Terra 생성 fallback | MFDS·MAFRA 구조화 레시피 우선, 공유 AI 레시피 차순위, 낮은 정확도에서 웹 검색 없이 Terra 생성 | SQL·Edge Function 구현, 원격 검증 중 |
| Android 알림 | Expo 호환 알림 모듈 | 임박 재료 알림 | 구현 방식 미정 |
| 배포 | EAS Hosting 무료 + 심사 기간 Supabase Pro | Expo 웹 production URL, Auth·Postgres·Storage·Edge Functions 상시 운영 | 확정 |

Expo Router는 Android와 웹에서 통합된 탐색 구조를 제공하므로 단일 코드베이스 목표에 적합하다. OpenAI 비전은 두 플랫폼에서 같은 모델·프롬프트·구조화 계약을 사용할 수 있다. Supabase Auth는 Postgres RLS와 연동하고 Edge Functions는 OpenAI API 키를 클라이언트 밖에서 관리하는 서버 경계로 사용한다.

AI 실행 구조는 하이브리드로 고정한다. Android와 웹은 구매내역 이미지를 `purchase-ocr` Edge Function으로 보내 동일한 OpenAI 비전 경로를 사용한다. 모델은 화면 텍스트 전사와 상품 후보 구조화까지만 담당하고, 단위 허용 목록·날짜·알레르기·고위험 조리·재고 차감은 결정적 코드가 담당한다.

## 3. 논리 구성요소

### 클라이언트

- `auth`: 로그인 화면, Google OAuth, 게스트 익명 인증, 시작 시 세션 복원·갱신, 인증 가드와 로그아웃
- `capture`: 심사용 번들 샘플 선택, data URL 변환, OCR 결과 검수·등록
- `inventory`: 합산 목록, lot 상세, 직접 입력, 수정·취소
- `cooking-tools`: 자연어 입력, 구조화 검수, 3열 카드 목록과 긴 원문 줄바꿈, 수정·삭제
- `chat`: 대화 UI, 스트리밍 응답, 도구 실행 확인
- `recipes`: 추천 상세, 완료 레시피, 차감 미리보기
- `settings`: 알림, 알레르기 항목, 계정·개인정보 관리
- `notifications`: 권한, 임박 알림 진입 경로
- `home-layout`: 앱 프레임 크기에 따른 임박 재료 4·5·6개 노출, 행동 카드 제목 크기와 카드 최소 높이 계산
- `platform`: Android Intent 타이머와 웹 대체 동작

### 서버

- `purchase-ocr`: JWT·이미지·일일 한도를 검증하고 OpenAI 비전으로 텍스트·상품 후보를 구조화
- `chat-orchestrator`: 대화 상태, 도구 선택, 응답 생성
- `recipe-retrieve`: 사용자 요청의 구체성을 판정해 메뉴명 또는 임박 재료로 비공개 `recipe_catalog`의 이름·구조화 재료를 검색하고 후보별 매칭 점수를 반환
- `recipe-adapt`: 채택된 공공 레시피를 재고·알레르기·도구·시간 기준으로 변형하고, 적합한 후보가 없으면 웹 검색 없이 `gpt-5.6-terra` 생성 경로로 전환
- `inventory-command`: 검증된 조회·변경·차감 명령 실행
- `guest-bootstrap`: 최소 10종 재료·조미료·조리도구·새우 알레르기가 포함된 독립 게스트 데이터 생성과 초기화
- `expiry-notification`: 임박 대상 계산과 알림 작업 생성

## 4. 데이터 모델 초안

재조리 구현 기준(2026-09-08): 저장 레시피별 최초 제공일과 개별 조리 완료 이력을 분리한다. 재조리마다 새 cooking_session ID를 만들고 같은 세션의 완료 재시도만 멱등 처리한다. 서버에서 현재 소유 재고·수량·알레르기·도구를 재검증하고 원자적으로 차감한다. 로컬 순수 도메인 검증은 서버 트랜잭션·RLS를 대체하지 않는다.

| 테이블 | 핵심 필드 | 설명 |
| --- | --- | --- |
| `profiles` | `user_id`, `display_name`, `is_guest`, `preferences`, `demo_seed_version`, `last_active_at`, `expires_at` | 사용자와 게스트 속성, 데모 버전과 7일 비활성 정리 기준 |
| `pantries` | `id`, `owner_id`, `name` | 사용자별 냉장고 경계 |
| `ingredients` | `id`, `canonical_name`, `category`, `default_unit` | 정규화 재료 사전 |
| `inventory_lots` | `id`, `owner_id`, `ingredient_key`, `display_name`, `quantity`, `unit`, `use_by_at`, `date_source`, `import_resolution`, `internal_note`, `status` | 최종 승인한 재고와 자동·사용자 확인·사용자 수정 판정, 내부 감사 비고 |
| `capture_jobs` | `id`, `owner_id`, `source_type`, `source_provider`, `image_path`, `ocr_text`, `status`, `expires_at` | 구매내역 처리 작업 |
| `capture_items` | `id`, `job_id`, `raw_name`, `parsed_fields`, `field_confidences`, `review_status`, `included` | 필드별 신뢰도, 확인 상태와 등록 제외 여부를 가진 인식·검수 항목 |
| `conversations` | `id`, `owner_id`, `summary`, `summary_window_started_at`, `created_at`, `last_activity_at` | 최근 30일 범위만 요약하고 빈 세션을 정리하는 대화 세션 |
| `messages` | `id`, `conversation_id`, `role`, `content_redacted`, `tool_result`, `created_at`, `expires_at` | 일반 사용자는 생성 후 30일에 만료되는 최소화된 대화 기록 |
| `recipes` | `id`, `title`, `content`, `safety_notes`, `risk_classification`, `locked_principles`, `transformation_summary` | 위험도를 분류하고 공통 원리·안전 조건을 유지하며 재설계한 레시피 |
| `recipe_sources` | `id`, `recipe_id`, `source_type`, `source_title`, `source_author`, `source_url`, `retrieved_at`, `usage_scope` | 참고 출처와 이용 범위 기록 |
| `recipe_proposals` | `id`, `conversation_id`, `recipe_id`, `provided_at`, `inventory_snapshot`, `deduction_preview`, `status` | 사용자에게 제공된 제안 |
| `recipe_ingredients` | `id`, `recipe_id`, `ingredient_id`, `display_quantity`, `display_unit`, `normalized_quantity`, `normalized_unit`, `conversion_source`, `deduction_status` | 레시피 표시 단위와 차감 가능 여부 |
| `cooking_sessions` | `id`, `owner_id`, `proposal_id`, `inventory_snapshot`, `status`, `started_at`, `expires_at`, `completed_at` | 12시간 복구 가능한 완료 전 조리 상태와 기준 재고 스냅샷 |
| `cooking_session_usage` | `id`, `session_id`, `ingredient_id`, `base_quantity`, `delta_quantity`, `normalized_unit`, `source_message_id`, `status` | 조리 중 추가·감소·취소된 임시 사용량 원장 |
| `completed_recipes` | `id`, `owner_id`, `proposal_id`, `completed_at` | 완료 레시피 기록 |
| `inventory_events` | `id`, `pantry_id`, `type`, `payload`, `idempotency_key`, `created_at` | 변경 이력과 취소 근거 |
| `notification_preferences` | `owner_id`, `enabled`, `reminder_days`, `delivery_local_time`, `max_daily_notifications`, `timezone` | 기본 D-7·D-3·D-1, 현지 18:00과 하루 최대 1회 알림 설정 |
| `notification_deliveries` | `id`, `owner_id`, `local_date`, `inventory_lot_ids`, `milestones`, `status`, `sent_at` | 묶음 알림과 중복 발송 방지 기록 |
| `cooking_tools` | `id`, `owner_id`, `raw_label`, `normalized_type`, `capacity_value`, `capacity_unit`, `attributes`, `parse_confidence`, `created_at` | 사용자가 보유한 조리도구 |
| `user_allergens` | `id`, `owner_id`, `raw_label`, `allergen_id`, `match_status`, `match_confidence`, `created_at` | 사용자가 실제로 등록한 알레르기 항목. 기본 행은 생성하지 않음 |
| `allergens` | `id`, `canonical_name`, `aliases`, `derived_ingredients`, `source_ref`, `version` | 등록된 항목에 대해서만 최종 레시피 검사에 사용하는 내부 정규화·동의어 사전 |
| `shelf_life_rules` | `id`, `canonical_key`, `canonical_name`, `category`, `storage_method`, `package_state`, `duration_days`, `source_title`, `source_url`, `source_checked_at`, `evidence_type`, `confidence`, `status` | 정규화 재고명·보관·포장별 공용 권장 소진 기간 캐시. 인증 사용자는 활성 행만 읽고 서버만 쓴다. |
| `recipe_catalog.recipes` | `recipe_id`, `source`, `name`, 분류·영양·이미지·팁·원본 필드 | 사용자 생성 `public.recipes`와 분리된 MFDS·MAFRA 공공 레시피 원본 |
| `recipe_catalog.ingredients` | `id`, `recipe_id`, `ingredient_no`, `normalized_name`, `parent_ingredient`, `search_key`, 원본 필드 | 구조화 재료 검색과 레시피별 재료 상세 |
| `recipe_catalog.steps` | `id`, `recipe_id`, `step_no`, `description`, 이미지·팁·원본 필드 | 순서가 보존된 공공 레시피 조리 단계 |
| `recipe_catalog.shared_recipes` | `id`, `origin_recipe_id`, `title`, `content`, `ingredient_names` | 사용자 동의·요리 완료된 AI 생성 레시피의 개인정보 제거 독립 사본. 개인 레시피 삭제와 무관하게 유지 |

### 공공 레시피 카탈로그 적재 구현 상태

- `202609120003_public_recipe_catalog.sql` migration은 기존 사용자 소유 `public.recipes`를 변경하지 않고 비공개 `recipe_catalog` 스키마, 3개 테이블, FK·자연키·검색 인덱스를 생성한다.
- 카탈로그 테이블은 RLS를 활성화하고 `public`, `anon`, `authenticated`의 스키마·테이블·sequence 권한을 회수했다. Data API 공개 스키마에는 추가하지 않는다.
- `public.import_recipe_catalog_batch(text, jsonb)`는 service role만 실행할 수 있고 한 번에 최대 500행을 `recipes → ingredients → steps` 순서로 자연키 upsert한다. 동적 테이블 SQL은 사용하지 않는다.
- `public.verify_recipe_catalog()`는 원문 없이 테이블 건수, FK orphan 수와 자연키 중복 수만 반환한다.
- `tools/import_recipe_catalog.py --validate-only`는 Git에서 제외된 `scripts/data`를 읽기 전용으로 검사한다. 2026-09-12 로컬 검증 결과는 recipes 1,684건, ingredients 18,920건, steps 9,542건, orphan 0, 중복 0이며 `MFDS_000799` 한 건만 ingredient 행이 없다.
- 기본 migration과 PostgREST JWT claims 보정 migration은 연결된 Supabase 프로젝트에 적용했다. 2026-09-13 원격 적재를 두 번 연속 실행해 매번 recipes 1,684건, ingredients 18,920건, steps 9,542건, orphan 0, 자연키 중복 0을 확인했다.
- 이 단계는 Expo UI, 기존 Supabase 클라이언트, `menu-chat`과 현재 배포된 레시피 실행 경로를 변경하지 않는다.

### 날짜 출처

- `printed`: 구매목록 OCR 텍스트에 실제로 포함된 공식 표시일
- `user_official`: 사용자가 포장을 보고 직접 입력한 공식 표시일
- `user_override`: 사용자가 직접 정정한 관리 날짜
- `estimated`: 식재료·보관 상태 기준표로 계산한 권장 소진일

UI는 `estimated`를 소비기한으로 표현하지 않고 `권장 소진일(추정)`으로 표시한다.

### 날짜 계산

- 날짜 파이프라인은 OCR 텍스트의 공식 표시일을 우선하고, 표시일이 없으면 `canonical_key + storage_method + package_state`로 공용 `shelf_life_rules`를 조회한다.
- 다음 개정에서는 OCR·직접 입력·채팅 추가의 원문 품목 구절에서 `냉동`·`냉장`을 결정적으로 식별하고 식품군과 무관하게 `storage_method`를 우선한다. `foodName`과 보관 상태를 분리하고 새 `inventory_lots`에도 상태를 보존한다. 기존 lot은 근거 없이 일괄 재분류하지 않는다.
- `즉석밥 + room_temperature + unopened`은 제조사 공식 9개월 보관 안내를 근거로 D+180의 보수적 curated 규칙을 우선 적용한다. 실제 포장 표시일·사용자 입력일은 이 규칙보다 우선한다.
- 계란·우유처럼 `date_entry_recommended`로 설정된 식재료는 검수 화면에서 공식 표시일 직접 입력을 유도한다. 사용자가 `지금은 모르겠어요`를 선택하면 등록은 허용하고 보수적 추정 규칙을 적용한다.
- AI 구조화 결과는 정규화 식재료명, 식품군, 냉장·냉동·실온 후보와 개봉 상태 후보를 제공한다.
- 활성 캐시가 없거나 `source_checked_at`이 365일 이상 지난 경우에만 서버가 `gpt-5.6-terra`의 제한된 `web_search`를 호출한다. 응답 URL이 도구가 실제 반환한 HTTPS 출처 목록에 포함되고 기간·신뢰도 검증을 통과할 때만 service role로 upsert한다.
- 다음 개정에서는 검색 실패 또는 출처 검증 실패 시 식품군별 30일 기본값을 등록 가능한 날짜로 채우지 않고 날짜를 비워 사용자 확인을 받는다. 개인이 입력한 날짜는 공용 규칙으로 upsert하지 않는다.
- 기준표는 식약처·식품안전나라의 국내 표시·보관 원칙을 우선하고, 개별 비포장 식재료의 냉장·냉동·실온 기간은 USDA FoodKeeper 공개 데이터를 보완 근거로 사용한다.
- 원천이 기간 범위를 제공하면 `duration_days`에는 짧은 값을 저장한다. 각 규칙은 원천 URL·원천 버전·적용 보관 상태를 함께 기록하며, 참고값을 공식 소비기한으로 승격하지 않는다.
- 육류·생선처럼 보관 상태가 불명확한 고위험 식품은 더 짧은 냉장 규칙을 기본값으로 사용한다.
- 개봉 또는 보관 위치 변경 시 `state_changed_at`을 기준으로 재계산하고 사용자가 확정한 공식 표시일은 임의로 연장하지 않는다.
- `estimate_rule_id`로 사용한 기준과 버전을 추적해 같은 입력이 같은 결과를 내도록 한다.

### 수량과 단위

- `original_quantity`와 `original_unit`은 구매내역 또는 사용자가 표현한 `2팩`, `0.5봉` 같은 값을 보존한다.
- `normalized_quantity`와 `normalized_unit`은 계산 가능한 경우에만 채우며 초기 표준 단위는 `g`, `ml`, `count`다.
- `conversion_source`는 `package_label`, `user`, `deterministic`, `none` 중 하나로 기록한다.
- `300g × 2팩`처럼 포장 정보가 있으면 원본은 `2 pack`, 계산값은 `600 g`으로 저장한다.
- 중량을 모르는 `1망`, `1봉`은 계산값을 비워두며 식품 평균 중량으로 자동 변환하지 않는다.
- 합산 조회는 동일 재료의 호환 가능한 계산 단위를 우선 사용하고, 계산값이 없는 lot은 원본 단위별 소계로 분리한다.
- 레시피 차감은 계산 단위가 호환될 때만 자동 수행한다. 원본 단위만 있거나 단위가 충돌하면 사용자 확인 또는 직접 정정으로 전환한다.
- 액체 조미료의 레시피 표시 단위는 `T`와 `t`를 허용하며 각각 15ml와 5ml로 결정적으로 환산한 뒤 `inventory_lots`의 `ml` 수량에서 차감한다.

## 5. 주요 데이터 흐름

### 구매내역 캡처

1. 클라이언트가 번들 샘플을 복수 선택하거나 웹 파일 탐색기·Android 사진 보관함에서 최대 10장을 선택하고 개인정보 포함 가능성을 고지한다.
2. 클라이언트는 각 5MB 이하의 JPEG·PNG·WebP를 data URL로 바꾸고 사용자 JWT와 함께 한 장씩 `purchase-ocr`에 순차 전달한다.
3. 함수는 JWT와 이미지별 사용자 `purchase_ocr` 하루 10회 원자적 카운터를 검증한다.
4. `gpt-5.6-luna`에 `detail: original`, reasoning `none`, `store:false`, strict JSON schema로 요청한다. 상품 썸네일 외형을 근거로 추측하지 않고 화면 텍스트만 전사하도록 지시한다.
5. 모델은 원문, 재고용 식품명, 총량, 지원 단위, 식품군, 신뢰도, 검수 필요, 비식품 여부를 반환한다.
6. 서버는 비식품을 제외하고 정규화 재고명별 공용 소비기한 캐시를 조회한다. miss·stale만 제한된 웹 검색으로 보강하고, 검색 실패 fallback은 검수 대상으로 남긴다.
7. 클라이언트는 허용 단위·양수 수량·실제 날짜를 다시 검증한다. OCR 원문에 이름 근거가 없는 품목을 제거하고 같은 이미지의 완전 동일 행을 중복 제거하되, 여러 이미지에 반복된 완전한 행은 별도 구매 가능성이 있으므로 유지한다.
8. 서버가 필드별 신뢰도·내부 비고와 검증 결과를 반환하고, 클라이언트는 사용자에게 재고명·수량·권장 소진일만 수정 가능한 입력란으로 제시한다.
9. 재고명·수량·권장 소진일 중 비었거나 형식이 잘못된 필드가 있는 행만 확인 필요로 판정한다. 해당 행은 최상단에 빨간 테두리로 정렬하고 상단 경고를 표시하며 하나라도 남으면 등록을 차단한다. 이후 이미지 분석 결과를 병합할 때 기존 `user_edited` 값은 보존한다.
10. 이미지 일부가 실패해도 성공한 행과 수정값을 유지하고 실패 이미지만 오류 카드로 표시한다.
11. 사용자가 마지막 `등록`을 누른 뒤에만 검증된 품목을 `register_inventory_import` RPC에 전달한다.
12. RPC는 `auth.uid()` 소유권, 데이터 스키마와 idempotency key를 다시 검증하고 `inventory_events`와 `inventory_lots`를 하나의 작업으로 생성한다. 재시도된 동일 키는 중복 등록하지 않는다.
13. Android·웹 원본은 Storage나 DB에 저장하지 않고 함수의 요청 메모리에서만 사용한다. 응답 또는 오류가 끝나면 서버가 유지하는 이미지 참조는 없다.

부분 재분석은 품목과 필드 단위의 상태를 유지한다. 서버 응답을 병합할 때 `user_edited` 필드는 보존하고, 실패한 필드와 AI가 제안한 필드만 갱신한다.

OCR 원문과 구조화 검수 초안은 영구 테이블에 저장하지 않고 현재 등록 흐름의 메모리·클라이언트 상태로만 유지한다. 등록 확정·취소 시 폐기하며, 확정 후에는 `inventory_lots`, `inventory_events`, 입력 방식, 지원처 유형과 구매일만 남긴다. 주문번호·이름·주소·연락처·결제정보는 분석 로그, 오류 추적, AI 프롬프트 기록에도 포함하지 않는다.

### 자연어 재고 직접 입력

1. 클라이언트는 최대 2,000자의 자연어를 인증된 `inventory-parse` Edge Function에 전달한다.
2. 함수는 사용자 JWT와 `inventory_parse` 하루 30회 카운터를 확인하고 `gpt-5.6-luna`, reasoning `none`, `store:false`, strict schema로 실제 입력에 포함된 식품만 구조화한다.
3. 사용자가 소비기한을 입력하면 그 날짜를 우선하고, 없으면 구매내역과 동일한 공용 `shelf_life_rules` 조회·miss 검색·보수적 fallback을 사용한다.
4. 결과는 구매내역과 같은 편집형 검수 화면과 `register_inventory_import` RPC를 재사용한다.

### 캡처 입력 유형

| 유형 | 우선 지원 범위 | 분석 입력 | 파싱 전략 |
| --- | --- | --- | --- |
| `supported_order_history` | 배달의민족 장보기, 쿠팡, 마켓컬리 | 구매내역 이미지 | OpenAI 비전 전사 + 공통 strict schema |
| `generic_e_receipt` | 종이 영수증 레이아웃의 전자영수증 | 전자영수증 이미지 | OpenAI 비전 전사 + 공통 strict schema |

실물 종이 영수증 사진과 식재료 실물 사진은 MVP 입력으로 받지 않는다.

### 대화와 재고 변경

1. 클라이언트가 메시지와 대화 ID를 보낸다.
2. 서버가 사용자 세션과 pantry 권한을 확인한다.
3. AI는 자유 SQL이 아닌 허용된 도구 스키마만 선택한다.
4. 서버가 명령을 검증하고 조회 결과 또는 변경 미리보기를 반환한다.
5. `menu-chat`은 `inventory_change`를 식별해 재료명·동작(`add`/`consume`/`set`)·수량·단위만 반환한다. 이 단계는 DB 쓰기 권한이 없으며 완료를 주장하지 않는다.
6. 앱은 현재 사용자 재고 lot을 다시 읽어 변경안을 만들고, 추가 품목은 기존 `inventory-parse`로 권장 소진일을 보완한다. 모든 행의 재료명·수량과 추가 품목의 날짜를 편집·검증한 뒤 명시적 승인을 받는다.
7. 승인 후 `apply_chat_inventory_change(request_key, changes)` RPC가 `auth.uid()` 소유 lot만 잠그고 전체 명령을 선검증한다. 초과 소비는 쓰기 없이 `needs_confirmation`과 실제 잔량을 돌려준다. 전량 확인 후 잔량으로 제한한 명령을 동일 키로 재시도한다.
8. RPC는 추가를 먼저 적용하고 소비는 권장 소진일이 빠른 lot부터 차감한다. 등록되지 않은 품목의 소비는 무시한다. 재고 lot과 `inventory_events`는 단일 트랜잭션이며 동일 idempotency key 재시도는 중복 반영하지 않는다.
9. `complete_cooking`도 동일한 사용자별 잠금과 만료일 우선 다중 lot 차감을 사용한다. 레시피의 합산 사용량이 한 lot의 수량을 넘더라도 여러 lot의 총량 안이면 원자적으로 차감하고, 부족하면 전체 완료를 롤백한다.

### 대화 보존과 삭제

- 일반 사용자 메시지를 생성할 때 `messages.expires_at = created_at + 30일`로 고정한다. 이후 같은 대화에 새 메시지가 추가돼도 기존 메시지의 만료 시각을 바꾸지 않는다.
- 예약 정리 작업은 `expires_at <= now()`인 일반 사용자 메시지를 삭제하고, 남은 메시지가 없는 대화 세션을 정리한다. 게스트는 이 작업과 별도로 사용자 전체 데이터의 마지막 활동 후 7일 정리 정책을 우선 적용한다.
- AI 입력은 만료되지 않은 최근 30일 메시지만 조회한다. `conversations.summary`를 사용하면 삭제된 원문의 의미가 남지 않도록 현재 보존 구간의 메시지로 다시 만들고 `summary_window_started_at`을 함께 갱신한다.
- 메시지 삭제가 확정 재고 상태나 완료 레시피를 연쇄 삭제하지 않도록 `inventory_events`, `completed_recipes`와 보존이 필요한 레시피 기록은 대화 원문 생명주기와 분리한다. 만료된 메시지·대화를 참조하던 선택적 외래 키는 삭제 정책에 맞춰 `SET NULL` 또는 독립 스냅샷으로 보존한다.
- 애플리케이션 로그, 오류 추적과 분석 이벤트에는 전체 대화문을 복제하지 않는다.
- 사용자가 `채팅 기록 전체 삭제`를 최종 확인하면 서버는 JWT의 `auth.uid()` 범위에 속한 모든 `messages`와 `conversations`를 하나의 멱등한 삭제 작업으로 처리한다.
- 삭제 요청은 다른 사용자의 대화, `inventory_events`, 현재 재고, `completed_recipes`, 알레르기와 조리도구 설정에 접근하거나 영향을 주지 않는다.
- 활성 데이터베이스에서 삭제된 채팅은 앱 기능으로 복원하지 않는다. 인프라 백업이 존재하더라도 개별 사용자 채팅 복구 기능으로 사용하지 않고 공급자 보존 정책에 따라 만료시킨다.

### 레시피 추천과 완료

1. 사용자의 의도·시간·난이도·메뉴 조건과 `intent_specificity`를 구조화한다.
2. 현재 재고 스냅샷, 임박 lot, 보유 조리도구, `user_allergens`와 최근 완료 메뉴를 조회한다.
3. 등록 알레르기를 AI 입력과 검색 필터에 적용하고, 식품 안전·보유 조리도구·명시 시간 조건을 충족하지 못하는 후보를 먼저 제외한다.
4. 구체 요청은 메뉴 의도·조리 가능성·재고 활용도·임박도를, 막연한 요청은 임박도·재고 활용도·추가 구매량·조리 부담을 순서대로 평가한다.
5. 요청이 구체적이면 메뉴명·인분·시간·맛·도구 조건을, 막연하면 권장 소진일과 남은 양을 기준으로 핵심 재료를 구조화한다.
6. 비공개 `recipe_catalog.recipes`와 `recipe_catalog.ingredients`의 `normalized_name`, `parent_ingredient`, `search_key`를 조회해 이름·보유 재료 포함 수·필수 조건으로 후보를 정렬한다.
7. 명시 메뉴는 이름 완전 일치 또는 이름 부분 일치와 재료 일치가 있는 공공 후보 1개를 선택한다. 막연한 요청은 구조화 재료 2개 이상, 매칭 비율 60% 이상을 요구한다.
8. 공공 후보가 임계값에 미달하면 공유 AI 레시피를 2순위로 조회한다. 이 후보도 미달하면 웹 검색 없이 `gpt-5.6-terra`가 사용자 재고·알레르기·조리도구·시간과 공용 지침으로 생성한다. Luna는 요청 분류에만 사용한다.
9. DB 변형과 Terra 생성 결과 모두 필수 재료, 핵심 안전 조건과 고위험 조리 단계를 검증한다. 상세 점수식·생성 계약·재시도 기준은 공공데이터 적재 이후 별도 확정한다.
10. 필수 재료가 없으면 레시피 생성을 멈추고 `구매 후 원래 메뉴`, `현재 재료 기반 대체 메뉴`, 검증된 경우의 `안전한 재료 대체` 분기를 생성한다.
11. 사용자가 분기를 선택하면 AI가 공공 레시피 후보 또는 Terra 생성 초안을 기반으로 사용량과 단계를 새 표현으로 설계한다. 변경 사항은 `transformation_summary`에 구조화한다.
   레시피 생성은 공용 `recipe-guidelines` 지침 모듈을 사용하며 조리도구 세척 지시, 내부 차감 규칙 노출, 비조리 작업 또는 1분 이하 작업의 타이머 생성을 금지한다.
12. 검증기가 최종 재료와 `allergens.aliases`를 대조한 뒤 재고 초과 사용, 누락 필수 재료, 보유하지 않은 필수 조리도구, 비정상 단위, 시간 불일치와 고위험 조리 안전 조건을 검사한다. 실패한 결과는 사용자에게 제시하지 않는다.
13. 레시피 재료·조미료를 계량 단위로 정규화하고, 수치와 환산 근거가 있으면 `deduction_status=ready`, 불확실하거나 근거가 없으면 `review_required`로 분류한다.
14. 사용자에게 레시피와 예상 차감량을 제시한다. `transformation_summary`와 공공 DB·Terra 생성 경로 구분은 내부 검증·추적에만 사용하고 사용자 화면에는 노출하지 않는다.
15. 사용자가 조리를 시작하면 `cooking_sessions`와 기본 사용량 원장을 만들고, 조리 중 발화는 `cooking_session_usage`의 delta로만 기록한다. 취소 발화는 기존 delta를 상쇄하는 이벤트로 남긴다.
16. 완료 시 기본 사용량과 delta를 합산하고, `ready` 항목은 차감 미리보기에 자동 포함하며 `review_required` 항목만 수정·제외하게 한다. 확정 후 idempotency key를 사용해 재고 이벤트와 완료 레시피를 하나의 트랜잭션으로 기록한다.

구현 계약(2026-09-13): `search_recipe_candidates`와 `get_recipe_candidate_detail`은 service role만 호출한다. 검색은 구조화 `ingredients` 필드만 사용하고 각 원천에서 최대 20개 후보만 읽는다. 선택한 한 건만 Terra에 전달하며 응답의 `origin`은 모델이 아닌 서버가 지정한다. `complete_recipe_cooking_shared`는 완료·재고 차감·개인 저장 후 요청된 경우에만 `share_completed_ai_recipe`를 같은 트랜잭션에서 실행한다. 공유 함수는 소유자·완료 기록·AI 생성 origin·콘텐츠 구조를 검사하고 사용자 식별자 및 재고 키를 제거한 독립 스냅샷을 멱등하게 만든다. 완료 전 따봉 상태는 클라이언트의 공유 대기값이며 DB 레시피 저장이 아니다.

개정 설계(2026-09-14, 구현 전): 구매 필요 품목 수를 출처와 메뉴 이름 점수보다 먼저 평가한다. 공공·공유·Terra 각각에서 구매 0개를 먼저 시도하고, 불가능할 때만 구매 1개 이하를 허용한다. Terra의 필수 재료 제외·재고 대체 결과도 서버가 실제 lot·단위·수량과 대조해 구매 수를 검증한다. 자세한 계약은 `docs/superpowers/specs/2026-09-14-zero-purchase-recipes-storage-aware-shelf-life-design.md`를 따른다.

클라이언트 재진입 시 서버는 `status=active`이고 `expires_at`이 지나지 않은 소유자 세션을 반환한다. 사용자가 취소하면 `cancelled`, 시작 후 12시간이 지나면 `expired`로 전환하며 두 경우 모두 `cooking_session_usage`를 재고 이벤트로 승격하지 않는다.

후속 채팅이 맛·시간·재료 조건을 바꾸면 기존 `recipe_proposal`을 직접 덮어쓰지 않고 이전 제안을 가리키는 새 버전을 만든다. 사용자가 보고 있는 최신 버전만 완료 대상으로 사용한다.

게스트도 동일한 `chat-orchestrator`, `recipe-retrieve`, `recipe-adapt`, `inventory-command`를 호출한다. `is_guest`는 모델 기능을 축소하는 플래그가 아니라 rate limit과 보존 기간에만 사용한다. 모든 조회·대화·완료 트랜잭션은 게스트의 `owner_id`와 pantry 소유권을 강제하며, 공용 변경 가능 데이터는 두지 않는다.

### 동시 게스트 격리와 정리

1. 로그인 화면의 `게스트 로그인(심사)`을 누르면 클라이언트가 CAPTCHA 토큰과 함께 `signInAnonymously()`를 호출해 고유 `auth.uid()`와 JWT를 받는다.
2. `guest-bootstrap`은 JWT의 `is_anonymous`와 rate limit을 확인하고 `(owner_id, demo_seed_version)` 고유 제약을 가진 초기화 작업을 시작한다.
3. 서버는 프로필, pantry, 게스트 시드 v1, 조리도구와 새우 알레르기를 하나의 트랜잭션으로 복제한다. 재호출은 기존 완료 결과를 반환한다.
4. 모든 게스트 소유 테이블은 `owner_id = auth.uid()` 또는 소유 pantry 관계를 확인하는 RLS를 사용하며 공용 게스트 ID를 사용하지 않는다.
5. 같은 브라우저는 저장된 익명 세션을 재사용하고 다른 브라우저·시크릿 창은 새 익명 사용자를 생성한다.
6. 요청이 성공할 때마다 `last_active_at`을 제한적으로 갱신하고 `expires_at = last_active_at + 7일`로 계산한다.
7. 예약 정리 작업은 만료 게스트의 앱 데이터부터 삭제한 뒤 익명 인증 사용자를 삭제하며, 실패한 대상은 재시도 가능 상태로 기록한다.

Supabase 익명 사용자는 `authenticated` 역할을 사용하므로 unauthenticated `anon` 역할과 혼동하지 않는다. `is_anonymous` JWT claim은 게스트 기능 제한에만 사용하고 데이터 소유권은 항상 `auth.uid()`로 검사한다.

### 인증 진입과 세션 복원

1. 앱 시작 시 인증 가드는 저장 세션 확인이 끝날 때까지 로그인과 홈을 모두 렌더링하지 않고 중립적인 시작 상태를 표시한다.
2. 저장 세션이 없으면 로그인 화면을 열고, 있으면 Supabase 토큰 갱신과 사용자 존재 여부를 확인한다.
3. 유효한 Google 세션은 사용자 홈으로, 유효한 익명 세션은 해당 게스트 pantry의 홈으로 이동한다. 게스트 bootstrap은 idempotent하므로 재실행 시 시드를 중복 생성하지 않는다.
4. 인증 또는 게스트 bootstrap이 성공하면 초기 설정 상태와 관계없이 바로 홈으로 이동한다. 별도의 온보딩·체크리스트 라우트는 만들지 않는다.
5. 설정의 로그아웃은 Supabase 로그아웃 뒤 플랫폼 저장소의 세션을 제거하고 인증 내비게이션 스택을 초기화해 뒤로가기로 보호 화면에 돌아가지 못하게 한다.
6. 토큰 갱신 실패, 삭제된 사용자 또는 7일 비활성 정리가 완료된 게스트는 로컬 세션을 폐기하고 로그인 화면으로 복귀한다.

Android 세션은 OS가 보호하는 비밀 저장소를 사용하는 Expo 호환 adapter에, 웹 세션은 Supabase 브라우저 세션 저장 방식에 둔다. service role과 OpenAI API 키는 어느 클라이언트 저장소에도 넣지 않는다.

### 게스트 시드 v1 (과거 기준, v2로 대체)

| 품목 | 수량 | 생성일 기준 권장 소진일 |
| --- | ---: | ---: |
| 두부 | 300g | D+3 |
| 달걀 | 10개 | D+7 |
| 돼지고기 앞다리살 | 300g | D+1 |
| 김치 | 500g | D+14 |
| 양파 | 2개 | D+14 |
| 대파 | 2대 | D+7 |
| 감자 | 3개 | D+21 |
| 간장 | 500ml | D+180 |
| 된장 | 500g | D+180 |
| 식용유 | 500ml | D+180 |

게스트 날짜의 `date_source`는 `demo_seed`로 저장하며 실제 제품 표시일로 오인되지 않게 한다. 조리도구 시드는 `2.5L 냄비`, `계란 프라이용 프라이팬`, `전자레인지`, `1인용 에어프라이어`, 알레르기 시드는 `새우`다.

### 게스트 시드 v2 (2026-09-20 구현 기준)

`202609190002_guest_demo_30_foods.sql`의 `guest_demo_seed_rows()`가 새 게스트 bootstrap과 명시적 초기화에 동일한 30종을 공급한다. 기존 게스트의 재고는 세션 복원만으로 덮어쓰지 않는다. 기본 권장 소진일은 접속일 상대 데모 날짜(`date_source=estimated`)이며 실제 제품의 인쇄 소비기한이 아니다. 보관 상태도 각 lot에 기록한다.

| 구분 | 품목·초기 수량 |
| --- | --- |
| 기존 기본 10종 | 두부 300g, 계란 10개, 돼지고기 앞다리살 300g, 김치 500g, 양파 10개, 대파 10대, 감자 10개, 간장 500ml, 된장 500g, 식용유 500ml |
| 조미료 추가 8종 | 설탕 500g, 소금 500g, 고추장 500g, 고춧가루 500g, 다진마늘 500g, 참기름 500ml, 식초 500ml, 후추 500g |
| 기타 추가 12종 | 쌀 1000g, 당근 10개, 애호박 10개, 무 10개, 표고버섯 200g, 콩나물 300g, 양배추 10개, 오이 10개, 시금치 200g, 닭가슴살 300g, 소고기 300g, 멸치 200g |

앱의 `createGuestTools()` 기본값은 가스레인지, 냄비 1L·2.5L·4L, 24cm 프라이팬, 전자레인지, 1인용 에어프라이어, 집게, 뒤집개, 식칼, 도마, 국자, 채반, 믹싱볼, 계량스푼, 주걱의 16종이다. 현재 조리도구 설정은 Supabase 테이블이 아니라 앱 저장소에 보존되며 명시적 샘플 초기화에서 기본값으로 돌아간다. 레시피 설명은 AI 자유 문구로 출처를 주장하지 않는다. `MFDS`·`MAFRA` 원천일 때만 검증된 공공기관명을 표시하고, AI 생성·공유 레시피는 보유 재료 중심의 출처 없는 문구를 사용한다.

`202609200001_guest_count_units_ten.sql`은 새 게스트와 명시적 초기화에 사용하는 시드 함수의 `개`·`대` 단위 수량만 10으로 갱신한다. 기존 `inventory_lots`는 일괄 변경하지 않는다. 조리도구 카드 이름은 18px로 표시한다.

### 알레르기 설정

1. 일반 사용자의 `user_allergens`는 빈 상태로 시작하며 UI에는 전체 마스터 목록 대신 자유 입력란과 `등록된 알레르기 없음` 빈 상태만 제공한다.
2. 사용자가 한 항목을 입력하면 정규화 계층이 `allergens` 후보에 매칭한다. 명확한 경우 원문과 canonical ID를 저장하고, 불확실하거나 의미가 여러 개인 경우에만 정규화 후보를 한 번 확인받는다.
3. 추천 시 현재 사용자가 등록한 canonical ID에 연결된 `aliases`와 `derived_ingredients`만 로드한다. 등록하지 않은 canonical 항목은 필터에 포함하지 않는다.
4. 삭제는 사용자 소유권을 검증한 뒤 수행하고 이후 제안부터 적용한다.
5. `guest-bootstrap`은 새 게스트 소유 데이터에 `새우` 알레르기 한 항목만 복제한다.
6. 추천 파이프라인은 AI 사전 필터와 등록 항목 기준의 결정적 최종 검사 중 하나라도 실패하면 해당 제안을 폐기하고 다음 후보를 평가한다.

### 임박 재료 알림

1. 사용자 시간대와 `delivery_local_time`을 기준으로 발송 작업이 `status=available`인 재고 lot 중 D-7·D-3·D-1 경계에 새로 도달한 품목을 조회한다. 기본 시각은 18:00이다.
2. 이미 차감·폐기된 lot과 같은 milestone로 발송된 lot을 제외한다.
3. 남은 대상을 사용자별 하나의 알림으로 묶고 `notification_deliveries`에 먼저 기록해 중복 실행을 막는다.
4. 같은 사용자·현지 날짜에 성공 발송 기록이 있으면 추가 시스템 알림을 보내지 않는다.
5. Android는 묶음 푸시를 보내고 웹은 동일 대상을 앱 내 배너로 표시한다.
6. 알림 payload에는 원문 재료 정보가 아니라 `notification_delivery_id`만 넣는다.
7. 딥링크 진입 시 서버가 delivery 소유권과 현재 lot 상태를 다시 확인하고 유효한 임박 재료만 `chat_context.expiring_inventory`로 전달한다.
8. 유효 대상이 없으면 빈 임박 맥락으로 일반 채팅을 열고 이미 처리됐다는 안내를 반환한다.

알림 시간 또는 시간대가 바뀌면 기존 미래 예약을 폐기하고 다음 발송부터 다시 계산한다. `notification_deliveries.local_date`의 성공 기록을 확인해 같은 현지 날짜에 재발송하지 않는다.

### 조리도구 등록과 레시피 적용

1. 사용자가 조리도구 한 항목을 자연어 한 줄로 입력한다.
2. AI가 종류, 용량·크기, 용도·특징을 구조화하고 신뢰도를 반환한다.
3. 서버가 허용 길이와 스키마를 검증한 뒤 원문과 구조화 필드를 함께 저장한다.
4. 레시피 검색 시 `normalized_type`을 필수 도구 조건과 비교한다.
5. 용량·크기 조건이 있는 경우 구조화 값과 원문 속성을 함께 확인한다.
6. 도구가 없으면 사전에 허용된 안전한 대체 조리 규칙만 적용하고, 그 외 레시피는 후보에서 제외한다.

## 6. AI 설계

### AI가 담당하는 일

- OCR 원문에서 상품 필드 구조화
- 상품명을 정규화 재료 후보에 매칭
- 자연어 메뉴·시간·난이도·재고 발화 해석
- 자연어 조리도구의 종류·용량·용도 구조화
- 기본 레시피 검색 결과의 제한된 변형
- 검색 출처별 결과 적합도 판단과 사용자의 재고·요청에 맞춘 변주 요약 생성
- 사용자에게 이해하기 쉬운 설명 생성

상품 사진의 시각적 특징으로 품목을 판별하는 작업은 맡기지 않는다.

### 결정적 코드가 담당하는 일

- 단위 계산과 총용량 검증
- `T=15ml`, `t=5ml`의 결정적 환산과 `ml`·`g` 호환성 검사, 불확실 조미료 자동 차감 차단
- 날짜 계산과 날짜 출처 표시
- 표시일 입력 권장 품목 판정, 보관·개봉 상태별 기준표 조회와 보수적 기본값 적용
- 재고 가용량 확인과 FEFO lot 차감
- 권한 확인, 트랜잭션, idempotency, 취소
- 임시 조리 사용량 원장의 합산·상쇄와 완료 전 실제 재고 변경 차단
- 필수 필드와 JSON 스키마 검증
- 조리도구 필수 조건과 허용된 대체 조리 규칙 검증
- 등록 알레르기 정규화, 레시피 최종 재료·동의어 대조와 차단
- 공공 카탈로그의 원천 메타데이터 보존과 외부 원문·이미지의 무단 추가 저장 차단
- 비공개 `recipe_catalog`에 대한 클라이언트 직접 접근 차단과 제한된 검색 결과 계약 검증
- 공공 DB 변형·Terra 생성 모두에서 위험한 조리 단축·가열 생략 차단
- 고위험 재료·단계의 안전 조건과 저위험 변경 허용 목록 검사

### 출력 계약

모든 AI 도구 출력은 버전이 있는 JSON 스키마로 검증한다. 스키마 불일치, 낮은 신뢰도, 재고 초과 사용은 자동 실행하지 않고 재질문 또는 사용자 검수로 전환한다.

### 모델 전략

- MVP의 유일한 생성형 AI 제공자는 OpenAI이며, 모든 GPT 호출은 Responses API를 사용한다. Gemini 등 타사 생성형 AI 모델은 정상 경로와 장애 대체 경로에 포함하지 않는다.
- `fast` 경로는 `gpt-5.6-luna`를 사용해 상품·조리도구 구조화, 재고 발화 해석과 단순 대화를 처리한다.
- `quality` 경로는 `gpt-5.6-terra`를 사용해 공공 레시피 후보 변형, 카탈로그 정확도 미달 시 신규 레시피 생성과 복잡한 후속 대화를 처리한다.
- Luna 출력의 스키마 실패, 낮은 신뢰도 또는 규칙 검증 실패가 발생하면 요청당 최대 한 번 Terra로 승격한다. Terra도 실패하면 사용자 확인 또는 명확한 실패 상태로 전환한다.
- OpenAI adapter가 Responses API 요청, 구조화 출력, 도구 호출, 사용량 메타데이터를 내부 계약으로 정규화한다.
- 모델 ID는 `gpt-5.6-luna`와 `gpt-5.6-terra`로 고정한다. 2026-09-01 공식 표시 가격은 Luna가 입력 `$0.20`·출력 `$1.20`, Terra가 입력 `$2.00`·출력 `$12.00`/100만 토큰이며, 구현 시작과 제출 직전에 가격·가용성을 다시 확인한다.
- 제출서류에는 실제 배포 환경에서 호출이 검증된 모델만 기록한다.
- 온디바이스 대화 LLM, 자체 호스팅 오픈소스 LLM과 타사 생성형 AI는 MVP 필수 경로에 포함하지 않는다.

### OpenAI 자격 증명과 과금 경계

- ChatGPT Pro 구독과 OpenAI API 사용량은 별도이며, 냉톡의 GPT 호출 비용은 프로젝트의 OpenAI API 결제 계정에 청구된다.
- `OPENAI_API_KEY`는 사용자가 발급했으며 Supabase Edge Function secret으로만 등록한다. 등록 절차는 `docs/OPENAI_SETUP.md`를 따른다.
- 키는 Supabase 프로젝트 secret으로만 저장하고 Expo 앱, 웹 번들, 저장소, 로그와 문서에 포함하지 않는다.
- 게스트를 포함해 사용자별 하루 30회의 원자적 rate limit을 DB 함수로 적용한다. 최근 대화 6개·메시지 500자, Luna 출력 500토큰, Terra 출력 1,800토큰과 호출별 28초 제한을 적용한다. 최종 레시피의 재고 검증이 구매 제한을 초과하면 일반 후보 시도 후 부족 품목을 피하도록 Terra로 한 번 재작성한다. 재작성도 동일한 구매 0개 검증을 통과해야 한다. Edge의 안전한 JSON 오류 문구는 클라이언트가 그대로 표시한다.
- 카탈로그 RPC의 20개 재료 제한에 맞춰 사용자 발화에 명시된 보유 식품을 검색 목록 앞에 둔다. 분류기가 식품명을 누락해도 발화에서 현재 재고명을 추출한다. 최종 재작성에는 해당 식품과 실제 보유 조미료만 전달하고 단위·수량 일치를 명시한다. `추천 가능한 레시피 없음`처럼 실행 불가능한 제목은 유효 레시피로 반환하지 않는다.

## 7. API 경계 초안

| 작업 | 방식 | 중요 검증 |
| --- | --- | --- |
| 캡처 분석 요청 | Edge Function | MIME, 크기, 소유자, 요청 제한 |
| 캡처 검수 확정 | DB RPC 또는 Edge Function | 스키마, 단위, 중복 요청 |
| 채팅 전송 | `menu-chat` Edge Function JSON 응답 | JWT, pantry 소유권, rate limit, 구조화 출력 |
| 재고 변경 확정 | DB RPC | 예상 버전, idempotency, 트랜잭션 |
| 레시피 완료 | DB RPC 또는 Edge Function | proposal 소유권, 차감 가능량 |
| 게스트 초기화 | DB RPC | 게스트 프로필 확인, `auth.uid()` 소유 범위 삭제·재시드, 직접 테이블 DELETE 미허용·제한된 definer 실행 |
| 채팅 기록 전체 삭제 | DB RPC 또는 Edge Function | JWT, 소유자 범위, 멱등성, 비채팅 데이터 보존 |

클라이언트가 service role 또는 AI API 키를 보유하지 않도록 한다.

### 자연어 재고 직접 등록

1. 홈과 재고 화면은 동일한 등록 방법 모달 컴포넌트를 사용하고, 재고 화면은 상단 `재고 등록` 버튼으로 이를 연다.
2. `직접 입력`은 다중 행 textarea 모달로 전환한다. 클라이언트는 원문을 임의로 해석하지 않고 인증된 `inventory-parse` 서버 함수에 전달한다.
3. fast 모델은 쉼표·줄바꿈으로 표현된 여러 식품을 `name`, `original_quantity`, `original_unit`, `displayed_date_text`, `confidence` 배열로 구조화한다.
4. 서버는 스키마·허용 단위·날짜 파싱을 결정적으로 검증하고 항목별 `ready` 또는 `needs_confirmation`을 반환한다. 날짜 미입력은 오류가 아니라 권장 소진일 기준표 적용 대상으로 처리한다.
5. 사용자가 `ready` 항목을 등록하면 하나의 idempotency key로 여러 `inventory_lots`와 `inventory_events`를 트랜잭션 생성한다. 불확실 항목은 사용자 확인 전 생성하지 않는다.
6. 완료 응답의 event group ID를 사용해 등록 직후 전체 작업을 취소할 수 있으며, 취소도 별도 멱등성 있는 보상 트랜잭션으로 기록한다.

## 8. 권한과 보안

- 모든 사용자 소유 테이블에 RLS를 활성화하고 `owner_id = auth.uid()` 또는 pantry 소유 관계를 강제한다.
- 게스트도 익명 공유 계정이 아니라 세션별 사용자 ID를 사용한다.
- AI Edge Function은 사용자 JWT를 검증하고 사용자 범위의 DB 클라이언트를 사용한다.
- service role은 게스트 초기화 등 제한된 서버 작업에만 사용한다.
- Android·웹 이미지는 Storage에 업로드하지 않고 함수 요청 메모리에서만 처리한다. OpenAI 요청은 `store:false`이며 처리 후 참조를 남기지 않는다.
- 모델 지침은 주문번호·이름·주소·연락처·결제정보를 OCR 원문과 상품 결과에서 제외한다. 서버는 이미지나 OCR 원문을 로그에 쓰지 않는다.
- OCR 원문, 원본 캡처, 주소·연락처·결제정보를 애플리케이션 로그와 오류 추적 도구에 기록하지 않는다.
- 로그에는 구매내역 원문, 이메일, 전체 대화문을 기본 저장하지 않는다.
- 프롬프트 인젝션을 데이터로 취급하고 허용 도구·권한을 확장하지 않는다.

## 9. 플랫폼별 차이

| 기능 | Android | 웹 |
| --- | --- | --- |
| 구매내역 OCR | 인증된 OpenAI 비전 Edge Function | 인증된 OpenAI 비전 Edge Function |
| 임박 알림 | 시스템 푸시·로컬 알림 | 앱 내 배너 |
| 조리 타이머 | `AlarmClock.ACTION_SET_TIMER` Intent | 종료 시각 기반 앱 내부 타이머, 탭 전환 후 복원 |
| 이미지 선택 | 사진 보관함 다중 선택(최대 10장) | 파일 탐색기 다중 선택(최대 10장) |
| 화면 외곽 | OS 기기 화면을 그대로 사용 | 9:20 앱 프레임에 8px 베젤·38px 모서리·그림자를 적용한 반응형 휴대폰 셸 |
| 배포 | EAS 내부 배포 APK 공유 URL | EAS Hosting 심사용 공개 URL |

## 10. 오류 처리

- 일부 OCR·구조화 실패: 성공한 품목과 사용자 수정값을 유지하고 실패 필드만 `확인 필요`로 전환
- 전체 OCR 실패: 현재 입력을 보존한 채 다른 캡처 선택과 직접 입력 제공
- AI 구조화 전체 실패: OCR 원문과 편집 가능한 빈 품목 폼 제공
- 재료 매칭 충돌: 상위 후보를 사용자에게 선택 요청
- 레시피 출처 없음: 임의 생성 대신 조건 완화 또는 다른 메뉴 제안
- 재고 동시 수정: 최신 버전 재조회 후 차감 미리보기 갱신
- OpenAI API 장애: 짧은 재시도 예산 내 재시도 후 입력을 보존하고 명확한 실패·재시도 상태 제공
- 네트워크 단절: 입력을 보존하고 중복 실행을 방지하는 재시도 키 사용
- AI 호출을 기다리는 동안 버튼 텍스트 옆과 진행 카드에 네이티브 회전 로딩 표시를 보여주고 입력·중복 실행을 잠근다.

## 11. 성능·비용 목표 초안

- 일반 재고 조회·수정은 AI 호출 없이 수행 가능한 경로를 둔다.
- OCR과 상품 구조화 결과는 현재 작업 상태에서 재사용해 중복 호출을 줄이고, 정규화 식품별 권장 기간은 공용 캐시로 재사용한다.
- 채팅 첫 상태 피드백은 즉시 표시하고 긴 응답은 스트리밍한다.
- 게스트와 사용자별 호출량 제한을 둔다.
- 모델 승격률과 작업별 토큰·지연·비용을 기록해 라우팅 기준을 조정한다.
- 레시피 기본 데이터와 정규화 사전은 캐시 가능하게 설계한다.

기존 210회 사용 비용 추정은 웹 검색 기반 구조의 값이므로 더 이상 현재 레시피 경로의 기준으로 사용하지 않는다. 공공 DB hit율과 Terra 생성 비율이 확정되면 최신 공식 모델 가격으로 다시 계산한다. OpenAI 월 사용 한도는 사용자가 `$20`로 설정했다.

## 12. 테스트 전략

### 단위 테스트

- 단위 변환, 총용량, 권장 소진일, FEFO 차감
- 공식 표시일 우선순위, 날짜 미입력 fallback, 냉장·냉동·개봉 상태 변경 재계산, 만료 공식일 연장 차단
- 원본·계산 단위 병행 표시, 비호환 단위 분리 합산, 환산 근거 없는 자동 차감 차단
- 계량 가능한 조미료의 차감 준비 상태와 `약간`·`적당량`의 확인 필요 상태 분리
- AI JSON 스키마 검증과 거절 조건
- 부족 재료와 필수 재료 판정
- 구매안·대체 메뉴 분기 생성과 사용자 선택 전 레시피 확정 차단
- 요청 구체성별 후보 정렬, 필수 조건 차단, 최근 메뉴 반복 완화와 추천 근거 생성
- 최상위 후보 1개 선택, 후속 채팅 제안 버전 생성과 최신 버전 완료 제한
- 새우 알레르기 게스트의 새우·동의 재료 후보 차단

### 통합 테스트

- 인증·RLS·게스트 격리
- 필드별 확인 필요 판정, 품목 제외, 부분 재분석 시 사용자 수정값 보존, 명시적 수락과 일괄 lot 생성
- 레시피 완료 트랜잭션과 중복 요청
- 조리 중 추가·감소·취소 발화 누적, 앱 재진입 후 세션 복원, 완료 전 재고 불변성
- 12시간 경계 전후 복구, 명시적 취소·자동 만료와 두 경로의 재고 미차감
- OpenAI API 실패, 제한된 재시도와 입력 보존·사용자 재시도 경로

### AI 평가

- 배달의민족 장보기·쿠팡·마켓컬리 주문내역 샘플의 필드 정확도
- 종이 영수증 형식 전자영수증의 품목 행 분리·수량·단가 필드 정확도
- 조리도구 자연어의 종류·용량·특징 구조화 정확도
- 보유하지 않은 필수 조리도구가 필요한 레시피의 차단률
- 자연어 재고 변경 의도와 비변경 대화 구분
- 레시피의 재고 초과 사용률, 필수 재료 누락률, 단위 오류율
- 불가능한 메뉴에 대한 구매·대체 질문 적절성
- 필수 재료 누락 시 구매안과 현재 재료 기반 대체 메뉴의 동시 노출률
- 구체 요청의 메뉴 의도 보존율과 막연한 요청의 임박 재료 활용률
- 등록 알레르기 포함 레시피 차단률과 알레르기 없는 후보의 오차단률

### E2E·심사 시나리오

- 게스트 진입부터 요리 완료까지 대표 흐름
- Android 알림과 시스템 타이머
- 웹 새 세션의 샘플 데이터 복제와 격리
- 배포 URL 헬스체크와 모바일 화면 크기

## 13. 배포와 관측

- 개발·심사 환경을 분리한다.
- Expo web export는 EAS Hosting production URL에 배포한다. 정적 웹 제공과 Supabase 백엔드는 사용자의 로컬 컴퓨터 전원·네트워크 상태에 의존하지 않는다.
- production 웹 고정 주소는 `https://naengtalk.expo.app`이다. 웹 UI 변경은 새 export를 EAS Hosting production alias에 배포해 반영한다.
- 별도 도메인은 MVP 의존성에 포함하지 않는다. EAS Hosting의 무료 `*.expo.app` production URL을 안정적인 공개 주소로 사용하고, 같은 배포의 `/install` 라우트가 웹 체험과 최신 EAS 내부 배포 APK로 연결되는 고정 진입점 역할을 한다. QR 코드는 변경 가능한 APK 공유 URL이 아니라 이 고정 라우트를 인코딩한다.
- Android는 EAS Update의 `production` 채널과 `runtimeVersion.policy: appVersion`을 사용한다. 첫 APK 이후 JavaScript·스타일·번들 자산 변경은 동일 runtime에 OTA로 배포할 수 있지만, 네이티브 의존성·권한·앱 설정·네이티브 아이콘 변경은 새 Android 빌드가 필요하다.
- 사용자 결정에 따라 웹을 먼저 배포해 실시간 UI를 검수하고, 디자인 확정 후 첫 내부 배포 APK를 빌드한다. EAS Update 설정만 먼저 완료하며 이 단계에서는 APK를 생성하지 않는다.
- Supabase는 Auth·Postgres·Storage·Edge Functions를 담당하고 OpenAI 요청은 Edge Function의 서버 secret을 통해서만 수행한다.
- 심사 시작 전에 Supabase Pro로 전환해 비활성 자동 중지를 방지하고, 심사 종료 후 데이터 보존·서비스 유지 여부를 확인한 뒤 요금제를 조정한다.
- DB migration과 Edge Function 배포는 버전 관리한다.
- 오류 추적, AI 호출 지연·비용, 스키마 실패, 주요 사용자 이벤트를 관측한다.
- 개인정보를 제외한 correlation ID로 클라이언트·서버 요청을 연결한다.
- 심사 기간에는 정기 헬스체크와 게스트 핵심 흐름 점검을 수행한다.

## 14. 기술 결정 대기 목록

- Luna→Terra 승격 임계값과 평가 세트의 통과 기준
- 공공 DB 후보 채택 점수·정확도 임계값과 Terra 생성 fallback 계약
- 오류·가용성 모니터링 도구의 최종 선택
- Android 알림 구현 방식
- 단위 정규화 사전의 초기 범위

## 15. 공식 기술 근거

- Expo Router: https://docs.expo.dev/router/introduction/
- EAS Hosting: https://docs.expo.dev/eas/hosting/get-started/
- EAS Build Internal Distribution: https://docs.expo.dev/build/internal-distribution/
- EAS Android APK: https://docs.expo.dev/build-reference/apk/
- EAS Update: https://docs.expo.dev/deploy/send-over-the-air-updates/
- EAS Update runtime 호환성: https://docs.expo.dev/build/updates/
- EAS 요금제: https://docs.expo.dev/billing/plans/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Pricing: https://supabase.com/pricing
- Supabase Free Project Pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase Anonymous Sign-Ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase CAPTCHA: https://supabase.com/docs/guides/auth/auth-captcha
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Edge Function 보안: https://supabase.com/docs/guides/functions/auth
- OpenAI 이미지·비전 입력: https://developers.openai.com/api/docs/guides/images-vision
- Android AlarmClock: https://developer.android.com/reference/android/provider/AlarmClock
- 식약처 소비기한 안내: https://www.mfds.go.kr/brd/m_827/view.do?seq=3616
- 식품안전나라 식재료 보관 원칙: https://www.foodsafetykorea.go.kr/portalmobile/content/detail.do?bbs_no=bbs427&ntctxt_no=1069310
- USDA FoodKeeper 데이터 안내: https://ask.fsis.usda.gov/article/Where-can-I-find-the-data-set-for-the-FoodKeeper-application
- USDA FoodKeeper 데이터셋: https://catalog.data.gov/dataset/fsis-foodkeeper-data
- OpenAI API Quickstart: https://developers.openai.com/api/docs/quickstart
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses/create
- OpenAI Models: https://developers.openai.com/api/docs/models
- OpenAI API Pricing: https://developers.openai.com/api/docs/pricing
- OpenAI Web Search 도메인 필터: https://developers.openai.com/api/docs/guides/tools-web-search

2026-09-12 사용자 결정으로 기존 만개의레시피·YouTube·일반 웹 레시피 검색 경로는 폐기 대상으로 변경됐다. 사용자가 전처리한 MFDS·MAFRA 공공데이터를 비공개 `recipe_catalog`에 적재해 먼저 조회하고, 적합한 후보가 없거나 정확도가 임계값보다 낮으면 웹 검색 없이 `gpt-5.6-terra`가 레시피를 생성한다. 정확도 점수식과 Terra 생성·검증 계약은 데이터 적재 이후 별도 설계한다.

2026-09-19 구현 기준: 메뉴 Edge Function은 공개·공유 후보와 Terra 생성 결과를 실제 재고 lot에 대조해 구매 0개 후보를 먼저 채택하고, 2개 이상 구매가 필요한 결과는 반환하지 않는다. 공용 `shelf_life_rules`는 식품명과 `storage_method`를 함께 키로 사용하며, 조회 실패는 빈 날짜로 처리한다. `inventory_lots.storage_method`는 구매 import RPC와 채팅 재고 변경 RPC가 함께 보존한다. 관련 migration은 `202609140001`~`202609140003`, `202609190001`이며 Edge Function은 `_shared/shelf-life-resolver.ts`를 공유한다. 기존 lot의 보관 상태는 소급 추정하지 않는다.

구현 시작 시 공식 문서를 다시 확인하고 버전·제약을 고정한다.
