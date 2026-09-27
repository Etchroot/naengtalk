# 냉톡 코드 리팩터링·문서·Supabase 감사 설계

- 상태: 사용자 방향 승인, 구현 계획 작성 전 검토본
- 기준일: 2026-09-27
- 대상: Expo/React Native 클라이언트, Supabase migration·Edge Function, 프로젝트 문서와 테스트

## 1. 목표

현재 production 동작과 승인된 UI 구조를 바꾸지 않으면서 다음 결과를 만든다.

1. 더 이상 제품에서 사용하지 않는 코드·자산·의존성을 근거와 함께 제거한다.
2. 약 1,995줄인 `mobile/src/features/NaengTalk.tsx`의 책임을 화면·모달·조정 로직 단위로 나눈다.
3. 향후 Android 앱 서비스화에 필요한 네이티브 기반은 보존한다.
4. Supabase 원격 프로젝트의 migration, 스키마, 함수, 카탈로그 데이터와 권한 상태를 다시 검증한다.
5. 외부 사용자·심사위원이 이해할 수 있는 최신 서비스 기획서와 전체 유저 플로우를 제공한다.
6. 리팩터링 전후에 동일한 기능 계약이 유지됨을 자동·원격 테스트로 확인한다.

## 2. 범위 밖

- UI 구조·색상·문구를 다시 디자인하지 않는다.
- 새로운 제품 기능, DB 테이블, RPC 또는 Edge Function을 추가하지 않는다.
- 기존 migration 파일을 수정하거나 원격 테이블·인덱스·데이터를 삭제하지 않는다.
- Google OAuth, Android APK, 푸시 알림처럼 아직 구현되지 않은 기능을 이번 리팩터링에서 새로 구현하지 않는다.
- production 배포와 GitHub push는 별도의 사용자 지시가 있을 때만 수행한다.

## 3. 보존 우선 원칙

### 3.1 제품 동작 보존

- 로그인, 게스트 초기화, 세션 복원, 홈, 채팅, 재고, 레시피, 조리도구, 설정의 화면 전환과 문구를 유지한다.
- 구매내역 OCR, 자연어 등록, 채팅 재고 변경, 레시피 검색·생성, 요리 완료·재고 차감·공유의 서버 계약을 변경하지 않는다.
- production Supabase migration과 함수는 immutable 운영 이력으로 취급한다.
- 리팩터링 과정에서 화면 상태와 사용자 데이터를 마이그레이션하는 변경을 만들지 않는다.

### 3.2 Android 보존 판단

현재 호출되지 않는 Android 관련 코드·설정도 아래 세 조건 중 하나에 해당하면 유지한다.

1. 이미 앱 설정이나 네이티브 빌드 계약에 포함돼 있다.
2. 제거 후 다시 만들 때 권한·저장소·빌드·배포 호환성을 재검증해야 한다.
3. 웹과 Android의 동일 기능 계약을 유지하는 adapter 또는 platform 분기다.

따라서 다음 기반은 직접 사용 횟수가 적더라도 보존 대상으로 본다.

- `expo-router`, Safe Area, Android adaptive icon·splash 설정
- `expo-secure-store`와 분할 세션 저장 adapter
- `expo-image-picker`와 Android 사진 보관함 권한 설정
- `expo-updates`, `eas.json`, runtimeVersion과 production channel 설정
- 웹·Android 공통 Supabase client와 platform별 저장소 분기
- 향후 네이티브 빌드에서 필요한 React Native peer dependency

반대로 Expo 시작 템플릿을 보여주기 위한 데모 컴포넌트·로고·힌트·예제 탭처럼 냉톡의 Android 기능과 무관하고 다시 만들 필요도 없는 코드는 제거할 수 있다.

## 4. 삭제 판정 절차

항목은 다음 네 단계를 모두 통과한 경우에만 삭제한다.

1. 정적 검색에서 앱 진입점·테스트·설정·문서가 참조하지 않는다.
2. Expo config plugin, Metro platform resolution, 패키지 peer dependency처럼 문자열 검색에 잡히지 않는 사용이 아니다.
3. PRD·TRD·제품 결정에 남은 Android 계획의 기반 코드가 아니다.
4. 삭제 후 TypeScript, 회귀 테스트, Expo 정적 export와 `expo-doctor`가 통과한다.

초기 삭제 후보는 다음과 같다.

- 제품에서 참조하지 않는 Expo 템플릿 UI 묶음: `ExternalLink`, `HintRow`, `WebBadge`, `Collapsible`, `ThemedText`, `ThemedView` 및 이들만 사용하는 theme hook
- 위 템플릿만 사용하는 Expo 로고·React 로고·탭 예시 이미지
- 심사용 구매 예시에서 제외된 `r2.jpg`
- 한 번도 실행할 필요가 없는 Expo 초기 프로젝트 재설정 스크립트와 이를 안내하는 템플릿 문서
- `getAndroidWebFrame`처럼 컴파일러가 확인한 미사용 import

다음 항목은 자동 삭제하지 않고 Expo dependency 검사와 실제 import graph를 함께 확인한다.

- `@react-navigation/*`, `react-native-screens`, `react-native-gesture-handler`
- `react-native-reanimated`, `react-native-worklets`
- `expo-linking`, `expo-constants`, `expo-system-ui`, `expo-status-bar`
- iOS icon 소스 폴더와 SUIT 라이선스처럼 코드에서 직접 참조하지 않아도 빌드·법적 고지에 필요한 자산

## 5. 클라이언트 모듈화

### 5.1 유지할 최상위 책임

`NaengTalk.tsx`는 다음 역할만 유지한다.

- 인증 완료 여부와 현재 탭 선택
- 앱 전체에서 공유하는 `LocalState`
- 원격 데이터 재조회와 오류 상태의 최상위 조정
- 화면과 모달 조합

### 5.2 추출 단위

현재 JSX 구조와 props 계약을 유지하면서 아래처럼 기능별 파일을 만든다.

- `mobile/src/features/naengtalk/model.ts`: 탭, 로컬 상태, 공통 화면 타입
- `mobile/src/features/naengtalk/sample-recipe.ts`: 로컬 검증용 샘플 레시피
- `mobile/src/features/naengtalk/components/`: 공통 버튼, 냉장고 손잡이, 화면 헤더, 하단 내비게이션
- `mobile/src/features/naengtalk/screens/`: 로그인, 홈, 채팅, 재고, 레시피 목록, 조리도구, 설정
- `mobile/src/features/naengtalk/modals/`: 채팅 재고 검수, 레시피 상세·사용량, 초과 사용, 공유 동의, 정렬, 구매 등록

서버 호출 순서와 상태 변경 함수는 먼저 원래 컨테이너에 남긴다. 화면 컴포넌트는 데이터와 callback을 props로 받고 Supabase를 직접 호출하지 않는다. 이 경계가 안정된 뒤에도 단순 이동 이상의 상태관리 재작성은 하지 않는다.

### 5.3 파일 분리 기준

- 각 파일은 하나의 화면 또는 하나의 모달 흐름만 담당한다.
- props는 화면이 실제로 표시하거나 실행하는 값만 전달한다.
- 기존 `domain`과 `services` 모듈의 책임은 유지한다.
- 스타일은 현재 시각 결과가 바뀌지 않도록 기존 token을 재사용하고, 해당 화면에서만 쓰는 스타일만 같은 기능 폴더로 이동한다.
- 테스트가 문자열·스타일 계약을 직접 확인하는 경우 새 경로를 따라가도록 갱신하되 테스트 의미는 바꾸지 않는다.

## 6. Supabase 감사

### 6.1 읽기 전용 검증

- 로컬·원격 migration 버전 일치 확인
- `db lint --linked --level warning`
- 배포 Edge Function 이름·버전·JWT 검증 설정 확인
- `public`과 `recipe_catalog`의 테이블 행 수·크기 확인
- 공공 카탈로그의 1,684/18,920/9,542건 유지 확인
- 소비기한 규칙과 원본 출처 행 수 확인
- RLS·grant·service-role 전용 RPC 계약을 migration 회귀 테스트로 재검증

### 6.2 정리하지 않을 항목

- 낮은 트래픽에서 scan 수가 0인 인덱스를 미사용으로 단정하지 않는다.
- 운영 이력을 보존해야 하는 legacy wrapper 함수와 migration을 즉시 삭제하지 않는다.
- 사용자·게스트 데이터는 감사 목적으로 수정하거나 일괄 정리하지 않는다.

실제 제거가 필요한 DB 객체가 발견되면 이번 작업에서 drop하지 않고 근거·영향·후속 migration 제안만 문서화한다.

## 7. 문서 산출물

### 7.1 서비스 기획서

기존 `docs/PRODUCT_PLAN.md`가 전체 서비스 기획서 역할을 하므로 새 최상위 기획서를 중복 생성하지 않는다. 다음을 현재 구현 기준으로 갱신한다.

- 게스트 재고 30종·조리도구 16종
- Android·웹 공통 OpenAI 비전 OCR
- 공공 DB → 공유 레시피 → Terra 생성 경로
- 실제 구현 완료·대기·제외 기능의 구분
- 배포 주소와 Android APK 준비 상태

최상위 `README.md`에서 기획서와 유저 플로우를 명확히 연결한다.

### 7.2 전체 유저 플로우

`docs/USER_FLOW.md`를 만들고 GitHub가 직접 렌더링하는 Mermaid를 단일 source of truth로 사용한다.

- 전체 서비스 지도: 로그인부터 6개 탭과 핵심 완료 상태까지 한 화면에서 연결
- 인증·세션 흐름
- 구매내역·직접 입력·채팅 재고 변경 흐름
- 메뉴 상담·공공/공유/Terra 라우팅·레시피 상세 흐름
- 요리 완료·초과 사용·공유·재고 차감 흐름
- 설정·알레르기·게스트 초기화·로그아웃 흐름

각 화면·모달·기능은 고유한 노드 하나를 갖고, 같은 화면으로 합류하는 버튼은 동일 노드로 연결한다. 화살표 라벨에는 사용자가 누르는 버튼이나 발생 조건을 기록한다. 큰 지도와 기능별 상세도를 함께 제공해 한눈에 보는 용도와 빠짐없는 추적을 모두 만족한다.

외부 Mermaid 스킬은 별도 설치하지 않는다. 현재 제공되는 시각화 지침과 GitHub Mermaid가 요구사항을 충족하며, 조사한 외부 후보보다 저장소 의존성과 공급망 위험이 작다.

### 7.3 운영 문서

- `README.md`: 실제 기능, 실행·검증 명령, 문서 인덱스 정리
- `TODO.md`: 이미 완료된 항목, 실제 대기 항목, 다음 출시 단계 정리
- `HUMAN-IN-THE-ROOF.md`: 현재 디자인 유지와 리팩터링·Android 보존 결정 추가
- `docs/PRD.md`, `docs/TRD.md`, `docs/PRODUCT_DECISIONS.md`: 구현과 충돌하는 문장만 최소 수정
- `mobile/README.md`: Expo 템플릿 안내를 제거하고 모바일 프로젝트 실행·빌드 안내로 교체

## 8. 검증 전략

### 8.1 변경 전 기준선

- Node 회귀 테스트 168개 통과를 기준선으로 고정한다.
- TypeScript `noUnusedLocals`·`noUnusedParameters` 검사에서 현재 미사용 import 1건을 기록한다.
- Supabase 원격 migration 23개 일치, DB lint 결과 0건, Edge Function 3개 활성 상태를 기준선으로 기록한다.

### 8.2 리팩터링 중

- 파일을 이동하기 전 현재 동작을 고정하는 테스트가 없는 경계에는 먼저 테스트를 추가한다.
- 화면·모달 추출 단위마다 관련 테스트와 TypeScript 검사를 실행한다.
- 삭제 묶음마다 import graph와 Expo dependency 검사를 다시 실행한다.

### 8.3 최종 검증

1. 전체 Node 회귀 테스트
2. TypeScript strict + 미사용 검사
3. Expo dependency·config 검사
4. Android·웹 번들에 영향을 주는 Expo 정적 web export
5. Supabase migration list, DB lint, table stats, function list
6. 격리된 익명 게스트로 다음 원격 스모크 흐름 확인
   - 로그인·시드·재고 조회
   - 구매 OCR 또는 자연어 직접 등록의 구조화 응답
   - 채팅 재고 조회·변경 승인
   - 공공/공유/Terra 메뉴 상담
   - 요리 완료·수정 사용량·재고 차감·중복 방지
   - AI 레시피 공유 동의와 공유 후보 생성
7. 로컬 웹에서 6개 탭·모달·하단 내비게이션의 시각적 회귀 확인

API 비용이 발생하는 실서비스 스모크 테스트는 대표 성공 경로를 한 번씩만 실행한다. 원격 테스트가 만든 임시 게스트 데이터는 제품의 7일 게스트 정리 정책을 따르며, 기존 사용자의 데이터는 건드리지 않는다.

## 9. 완료 기준

- 제품 동작과 승인 UI가 변경되지 않는다.
- 삭제된 항목마다 참조 부재와 빌드·테스트 통과 근거가 있다.
- Android 앱 전환 기반이 유지된다.
- `NaengTalk.tsx`가 최상위 조정 역할 중심으로 줄어들고 화면·모달 책임이 분리된다.
- Supabase 원격 상태와 공공 카탈로그 개수가 검증된다.
- README, 제품 기획서, TODO, 사용자 개입 기록과 기술 문서가 현재 구현과 일치한다.
- 전체 유저 플로우에서 모든 주요 버튼·분기·합류 화면을 추적할 수 있다.
- 최종 자동·원격·시각 검증 결과가 작업 보고에 포함된다.
