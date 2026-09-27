# 냉톡 사용자 흐름

- 기준일: 2026-09-27
- 범위: 현재 심사용 웹과 공용 Expo 클라이언트
- 표기: 실선은 현재 구현, 점선은 아직 출시되지 않은 경로다.

이 문서는 버튼 하나가 여는 화면과 데이터를 바꾸기 전 사용자가 거치는 확인 단계를 추적한다. 여러 화면에서 같은 곳으로 이동하면 별도 복제 없이 같은 노드로 합친다.

## 1. 전체 서비스 맵

```mermaid
flowchart TD
  AppStart["앱 시작"] --> SessionCheck{"유효 세션?"}
  SessionCheck -- "없음" --> LoginScreen["로그인 화면"]
  SessionCheck -- "있음" --> HomeScreen["홈"]
  LoginScreen --> GuestLoginBtn["게스트 로그인 버튼"] --> GuestAuth["익명 인증·30종 재고 생성"] --> HomeScreen
  LoginScreen -.-> GoogleLoginBtn["Google 로그인 버튼·후속"] -.-> GoogleOAuth["Google OAuth·미연결"] -.-> HomeScreen

  HomeScreen --> PurchaseHomeBtn["구매내역 등록 카드"] --> RegistrationRoot["재고 등록 방식 선택"]
  HomeScreen --> MenuHomeBtn["오늘 뭐 먹지? 카드"] --> ChatScreen["채팅"]
  HomeScreen --> UrgentList["임박 재고 최대 6개·조회"]

  BottomHome["하단 홈"] --> HomeScreen
  BottomChat["하단 채팅"] --> ChatScreen
  BottomInventory["하단 재고"] --> InventoryScreen["내 재고"]
  BottomRecipes["하단 레시피"] --> RecipesScreen["내 레시피"]
  BottomTools["하단 조리도구"] --> ToolsScreen["조리도구"]
  BottomSettings["하단 설정"] --> SettingsScreen["설정"]
  HeaderHomeBtn["상단 홈 아이콘"] --> HomeScreen

  InventoryScreen --> InventoryRegisterBtn["재고 등록 버튼"] --> RegistrationRoot
  RegistrationRoot --> CaptureBtn["구매내역 캡처 등록"] --> PurchasePicker["이미지 선택"] --> PurchaseReview["구매내역 확인"] --> InventoryCommit["재고 등록 트랜잭션"] --> InventoryScreen
  RegistrationRoot --> DirectBtn["직접 입력"] --> DirectInput["자연어 식품 입력"] --> PurchaseReview

  ChatScreen --> SendBtn["전송"] --> ChatClassify{"요청 분류"}
  ChatClassify -- "재고 조회" --> InventoryAnswer["재고 유무·수량 답변"] --> ChatScreen
  ChatClassify -- "재고 변경" --> ChatInventoryReview["재고 변경 검수"] --> InventoryMutation["승인된 재고 변경"] --> ChatScreen
  ChatClassify -- "메뉴 상담" --> PublicSearch["1순위 공공 레시피"] --> SharedSearch["2순위 공유 레시피"] --> TerraGenerate["3순위 Terra 생성"] --> RecipeProposal["레시피 제안"]
  RecipeProposal --> FullRecipeBtn["레시피 전체 보기"] --> RecipeDetail["레시피 상세"]

  RecipesScreen --> SavedRecipeCard["완료 레시피 카드"] --> RecipeDetail
  RecipeDetail --> TimerBtn["단계 타이머 시작"] --> InternalTimer["웹 내부 타이머"] --> RecipeDetail
  RecipeDetail --> ShareThumbBtn["좋아요·공유 아이콘"] --> ShareConsent["공유 동의"] --> RecipeDetail
  RecipeDetail --> CookCompleteBtn["요리 완료"] --> UsageReview["사용량 검수"] --> CookingCommit["완료 저장·재고 차감"] --> RecipesScreen
  CookingCommit --> ShareGate{"완료 전 공유 동의?"}
  ShareGate -- "예" --> SharedRecipeCopy["익명 추천 레시피 복사"]
  ShareGate -- "아니요" --> RecipesScreen

  SettingsScreen --> ResetDemoBtn["샘플 데이터 초기화"] --> GuestReset["30종·16도구 초기화"] --> HomeScreen
  SettingsScreen --> LogoutBtn["로그아웃"] --> Logout["세션 종료"] --> LoginScreen
```

## 2. 로그인·공통 이동

```mermaid
flowchart LR
  AppStart["앱 시작"] --> SessionCheck{"유효 세션?"}
  SessionCheck -- "없음·만료" --> LoginScreen["로그인 화면"]
  SessionCheck -- "있음" --> HomeScreen["홈"]
  LoginScreen --> GuestLoginBtn["게스트 로그인 버튼"] --> GuestAuth["익명 인증·30종 재고 생성"] --> HomeScreen
  LoginScreen -.-> GoogleLoginBtn["Google 로그인 버튼·후속"] -.-> GoogleOAuth["Google OAuth·미연결"]

  HeaderHomeBtn["상단 홈 아이콘"] --> HomeScreen
  BottomHome["하단 홈"] --> HomeScreen
  BottomChat["하단 채팅"] --> ChatScreen["채팅"]
  BottomInventory["하단 재고"] --> InventoryScreen["내 재고"]
  BottomRecipes["하단 레시피"] --> RecipesScreen["내 레시피"]
  BottomTools["하단 조리도구"] --> ToolsScreen["조리도구"]
  BottomSettings["하단 설정"] --> SettingsScreen["설정"]

  LogoutBtn["로그아웃"] --> Logout["세션 종료"] --> LoginScreen
  SessionExpired["요청 중 세션 만료"] --> LoginScreen
```

- 게스트 로그인 뒤에는 온보딩이 없고 바로 홈으로 간다.
- 세션은 재실행 때 복원되며 사용자가 설정에서 로그아웃할 때 종료된다.
- Google 로그인 UI는 있지만 production OAuth는 아직 연결하지 않았다.
- 상단 홈 아이콘과 하단 홈 버튼은 모두 같은 `HomeScreen`으로 합쳐진다.

## 3. 홈·재고 등록·정렬

```mermaid
flowchart TD
  HomeScreen["홈"] --> UrgentList["임박 재고 최대 6개·조회"]
  HomeScreen --> PurchaseHomeBtn["구매내역 등록 카드"] --> RegistrationRoot["재고 등록 방식 선택"]
  HomeScreen --> MenuHomeBtn["오늘 뭐 먹지? 카드"] --> ChatScreen["채팅"]

  InventoryScreen["내 재고"] --> InventorySortBtn["정렬 버튼"] --> SortModal["재고 정렬"]
  SortModal --> ExpirySortBtn["남은 소비기한 순"] --> InventoryScreen
  SortModal --> NameSortBtn["이름순"] --> InventoryScreen
  InventoryScreen --> InventoryRegisterBtn["재고 등록 버튼"] --> RegistrationRoot

  RegistrationRoot --> CaptureBtn["구매내역 캡처 등록"] --> PurchasePicker["이미지 선택"]
  PurchasePicker --> SampleToggle["예시 1~4 선택·해제"] --> PurchasePicker
  PurchasePicker --> ImageAddBtn["이미지 등록"] --> PlatformPicker{"실행 환경"}
  PlatformPicker -- "웹" --> FilePickerWeb["파일 탐색기·최대 10장"] --> PurchasePicker
  PlatformPicker -- "Android" --> PhotoLibraryAndroid["사진 보관함·최대 10장"] --> PurchasePicker
  PurchasePicker --> RemoveImageBtn["선택 이미지 삭제"] --> PurchasePicker
  PurchasePicker --> AnalyzeBtn["선택한 이미지 분석"] --> VisionOCR["OpenAI 비전 OCR·원본 비저장"] --> ShelfLifeResolve["공용 소비기한 DB 조회·보완"] --> PurchaseReview["구매내역 확인"]

  RegistrationRoot --> DirectBtn["직접 입력"] --> DirectInput["자연어 식품 입력"]
  DirectInput --> FoodRegisterBtn["식품 등록"] --> DirectParse["AI 구조화·소비기한 조회"] --> PurchaseReview

  PurchaseReview --> EditName["재고명 수정"] --> PurchaseReview
  PurchaseReview --> EditQuantity["수량 수정"] --> PurchaseReview
  PurchaseReview --> EditStorage["보관 상태 수정"] --> PurchaseReview
  PurchaseReview --> EditUseBy["권장 소진일 수정"] --> PurchaseReview
  PurchaseReview --> OtherImageBtn["다른 이미지 선택"] --> PurchasePicker
  PurchaseReview --> ReviewGate{"빈칸·오류 없음?"}
  ReviewGate -- "아니요·빨간 테두리" --> PurchaseReview
  ReviewGate -- "예" --> ReviewRegisterBtn["등록"] --> InventoryCommit["멱등 재고 등록 트랜잭션"] --> InventoryScreen

  RegistrationRoot --> RegistrationCloseBtn["닫기"] --> RegistrationOrigin{"진입 화면"}
  RegistrationOrigin -- "홈" --> HomeScreen
  RegistrationOrigin -- "재고" --> InventoryScreen
```

## 4. 채팅·레시피·요리 완료

```mermaid
flowchart TD
  ChatScreen["채팅"] --> ChatInput["메시지 입력"] --> SendBtn["전송"] --> ChatClassify{"요청 분류"}

  ChatClassify -- "재고 조회" --> InventoryLookup["사용자 lot 조회"] --> InventoryAnswer["재고 유무·수량 답변"] --> ChatScreen
  ChatClassify -- "구매·수령·추가·소비·잔량 정정" --> InventoryProposal["구조화 재고 변경안"] --> ChatInventoryReview["재고 변경 검수"]
  ChatInventoryReview --> ChatEditName["재료명 수정"] --> ChatInventoryReview
  ChatInventoryReview --> ChatEditQty["수량 수정"] --> ChatInventoryReview
  ChatInventoryReview --> ChatEditStorage["보관 상태 수정"] --> ChatInventoryReview
  ChatInventoryReview --> ChatEditUseBy["권장 소진일 수정"] --> ChatInventoryReview
  ChatInventoryReview --> ChatCancelBtn["취소"] --> ChatScreen
  ChatInventoryReview --> ChatApproveBtn["승인"] --> OverdrawGate{"보유량 초과 소비?"}
  OverdrawGate -- "아니요" --> InventoryMutation["원자적·멱등 재고 변경"] --> ChatScreen
  OverdrawGate -- "예" --> OverdrawModal["전량 소비 확인"]
  OverdrawModal --> OverdrawCancelBtn["취소"] --> ChatInventoryReview
  OverdrawModal --> OverdrawConfirmBtn["확인"] --> InventoryMutation
  InventoryProposal -- "재고에 없는 식품 소비" --> IgnoreUnknownConsume["변경 없이 무시"] --> ChatScreen

  ChatClassify -- "메뉴 상담" --> PublicSearch["1순위 공공 레시피"] --> PublicGate{"정확도·재고 기준 통과?"}
  PublicGate -- "예" --> RecipeAdapt["재고·알레르기·도구 맞춤 조정"]
  PublicGate -- "아니요" --> SharedSearch["2순위 공유 레시피"] --> SharedGate{"정확도·재고 기준 통과?"}
  SharedGate -- "예" --> RecipeAdapt
  SharedGate -- "아니요" --> TerraGenerate["3순위 Terra 생성"] --> RecipeValidate["구매 0개 우선·최대 1개·안전 검증"]
  RecipeAdapt --> RecipeValidate
  RecipeValidate -- "통과" --> RecipeProposal["레시피 제안"] --> ChatScreen
  RecipeValidate -- "실패" --> RecipeRetry["조건을 좁혀 1회 재작성"] --> RecipeValidate
  RecipeProposal --> FullRecipeBtn["레시피 전체 보기"] --> RecipeDetail["레시피 상세"]

  RecipesScreen["내 레시피"] --> SavedRecipeCard["완료 레시피 카드"] --> RecipeDetail
  RecipesScreen --> EmptyRecipes["완료 요리 없음"] --> ChatMoveBtn["채팅으로 이동"] --> ChatScreen
  RecipeDetail --> BackBtn["채팅·레시피 목록으로 돌아가기"] --> RecipeOrigin{"상세 진입 화면"}
  RecipeOrigin -- "채팅" --> ChatScreen
  RecipeOrigin -- "레시피" --> RecipesScreen
  RecipeDetail --> TimerBtn["단계 타이머 시작"] --> InternalTimer["웹 내부 타이머"] --> RecipeDetail

  RecipeDetail --> ShareThumbBtn["좋아요·공유 아이콘"] --> ShareConsent["공유 동의"]
  ShareConsent --> ShareCancelBtn["취소"] --> RecipeDetail
  ShareConsent --> ShareConfirmBtn["확인"] --> SharePending["완료 전 공유 대기"] --> RecipeDetail

  RecipeDetail --> CookCompleteBtn["요리 완료"] --> UsageReview["사용량 검수"]
  UsageReview --> UsageEdit["재료별 사용량 수정"] --> UsageReview
  UsageReview --> UsageConfirmBtn["사용량 확정"] --> CookingOverdrawGate{"보유량 초과?"}
  CookingOverdrawGate -- "예" --> OverdrawModal["전량 소비 확인"]
  CookingOverdrawGate -- "아니요" --> CookingCommit["완료 저장·재고 차감"]
  OverdrawModal --> OverdrawCancelBtn["취소"] --> UsageReview
  OverdrawModal --> OverdrawConfirmBtn["확인"] --> CookingCommit
  CookingCommit --> ShareGate{"완료 전 공유 동의?"}
  ShareGate -- "예" --> SharedRecipeCopy["익명 추천 레시피 복사"] --> RecipesScreen
  ShareGate -- "아니요" --> RecipesScreen
```

### 레시피 검색 불변 조건

1. 공공 레시피 → 공유 레시피 → Terra 생성 순서를 건너뛰지 않는다.
2. 보유 재료만으로 가능한 구매 0개 후보가 항상 우선이다.
3. 구매 필요 품목이 2개 이상인 결과는 사용자에게 보여주지 않는다.
4. 알레르기·고위험 가열·실제 재고 수량 검증을 통과한 결과만 상세 화면으로 보낸다.
5. 좋아요는 공유 의사만 저장한다. `요리 완료` 트랜잭션이 성공하기 전에는 공유 DB에 복사하지 않는다.

## 5. 조리도구·설정

```mermaid
flowchart TD
  ToolsScreen["조리도구"] --> ToolInput["조리도구 이름 입력"] --> ToolAddBtn["조리도구 입력"] --> ToolStore["기기 저장소 반영"] --> ToolsScreen
  ToolsScreen --> ToolDeleteBtn["도구 카드 삭제"] --> ToolStore

  SettingsScreen["설정"] --> AllergyInput["알레르기 항목 입력"] --> AllergyAddBtn["알레르기 등록"] --> AllergyStore["알레르기 목록 반영"] --> SettingsScreen
  SettingsScreen --> AllergyDeleteBtn["알레르기 삭제"] --> AllergyStore
  SettingsScreen --> ResetDemoBtn["샘플 데이터 초기화"] --> GuestReset["원격 30종 재고·로컬 16도구 초기화"] --> HomeScreen["홈"]
  SettingsScreen --> LogoutBtn["로그아웃"] --> Logout["세션 종료"] --> LoginScreen["로그인 화면"]
```

## 6. 데이터가 바뀌는 지점

| 변경 지점 | 사용자 확인 | 서버·저장소 결과 |
| --- | --- | --- |
| 구매내역/직접 입력 등록 | 검수 행의 이름·수량·보관·날짜 확인 후 `등록` | 원격 재고 lot과 이벤트를 멱등 저장 |
| 채팅 재고 변경 | 편집 가능한 변경안에서 `승인`; 초과 소비는 전량 소비를 한 번 더 확인 | 사용자 소유 lot만 원자적으로 변경 |
| 요리 완료 | 재료별 사용량 수정 후 `사용량 확정`; 초과 소비 재확인 | 완료 레시피 저장과 재고 차감을 같은 트랜잭션으로 처리 |
| AI 레시피 공유 | 좋아요 팝업 `확인` 후 실제로 `요리 완료` | 개인 완료 레시피가 존재할 때만 익명 공유 사본 생성 |
| 샘플 초기화 | 설정의 명시적 버튼 | 게스트 재고 30종과 조리도구 16종을 초기 상태로 복원 |
| 로그아웃 | 설정의 명시적 버튼 | 인증 세션 종료 후 로그인 화면 이동 |

AI 응답만으로는 재고가 바뀌지 않는다. 모든 재고 쓰기는 편집 가능한 검수 또는 요리 완료 확인 뒤에 실행한다.
