# 냉톡 첫 구현 계획

**Goal:** 승인된 기획을 Android·웹 공용 Expo 앱으로 구현한다.
**Architecture:** 화면과 순수 도메인 로직을 분리한다. 서버 연결 전 로컬 검증 모드는 명시적으로 구분하며 심사용 실제 익명 인증·AI로 오인시키지 않는다.
**Tech Stack:** Expo Router, React Native, TypeScript, Supabase, OpenAI.
**Spec:** `docs/PRD.md`, `docs/TRD.md`, `docs/PRODUCT_DECISIONS.md`.

## 첫 작업 단위: 재고·조리 도메인과 실행 기반

- [ ] `tests/cooking.test.ts`: 정상 차감, 재요리, 중복 완료, 부족 재고의 원자성, 잘못된 수량·단위, 타이머 종료시각 테스트를 먼저 작성하고 실패 확인.
- [ ] `src/domain/cooking.ts`: 순수 상태 전이 구현. 현재 재고를 복제해 모든 차감을 검증한 뒤 반환하고 원본을 변형하지 않는다.
- [ ] `src/domain/seed.ts`: 독립된 10종 샘플 재고 생성. 상대 날짜와 추정 표기, 계란·간장·된장 포함.
- [ ] `app/`, `package.json`: Expo 실행 기반과 TypeScript 검사 구성.
- [ ] 테스트·타입 검사·웹 빌드 실행 후 다음 UI 작업의 기반으로 사용.

## 이어지는 작업 단위

1. 승인된 와이어프레임 색상·구조를 Product Design 기준으로 Expo 화면으로 구현. 6탭, 로그인, 공용 등록창, 굵은 제목, 레시피 날짜 분리, 재요리 완료, 내부 타이머 검증.
2. Supabase 인증·RLS·게스트 시드·원자적 차감 RPC 및 개인정보 보존 구현. 프로젝트 연결 후 두 사용자 격리 통합검사.
3. 서버 OpenAI adapter, 주문형 레시피 검색, 구매내역 텍스트 구조화 구현. 키 등록 후 실제 다중 턴 평가.
4. Android OCR·시스템 타이머·알림·APK 및 웹 배포. 브라우저 시각 검수와 실기기 검사 후 제출서류 갱신.

공개 배포·유료 서비스 활성화·API 키 입력은 실제 필요 시 사용자와 연결한다. 미구현 기능은 완료로 표시하지 않는다.
