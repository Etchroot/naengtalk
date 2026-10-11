# 냉톡 공개 정책 문안 초안 (한국어 / English)

작성 기준: 2026-09-30. **게시 승인 전 작업용 초안**이다. 아래 `{{...}}`는 미정 값이며, 하나라도 남아 있으면 공개하지 않는다. Android 첫 공개 범위는 한국·미국·캐나다·호주의 18세 이상, Google 로그인, Android 일부 화면의 AdMob 배너다. 웹 심사용 게스트는 별도 경로로 유지한다. 앱·서버의 현재 소스와 [Google Play 출시 게이트](GOOGLE_PLAY_RELEASE.md)를 근거로 하되, 배포되지 않은 기능을 이미 제공한다고 주장하지 않는다.

## 게시 전 필수 값과 확인

2026-10-10 사용자 확정: Play 공개 개발자 이름은 **AloeTurtle**, 공개 사용자 문의 이메일은 **jjamyeong@gmail.com**이다. 공개 명칭은 법적 이름을 대체하지 않는다. 개인정보 권리 행사 전용 연락처·법적 운영자 정보·시행일 등 나머지 자리표시자는 미확정이며 문안은 게시 전 초안 상태를 유지한다.

| 자리표시자 | 소유자가 확정할 내용 |
| --- | --- |
| `{{OPERATOR_LEGAL_NAME}}` | 실제 개인정보처리자 법적 이름. 확정된 공개 명칭 AloeTurtle과 다르면 관계를 설명한다. |
| `{{OPERATOR_PUBLIC_NAME}}` | AloeTurtle로 확정하여 공개 문안에 반영했다. |
| `{{SUPPORT_EMAIL}}` | jjamyeong@gmail.com으로 확정하여 공개 문안에 반영했다. |
| `{{OPERATOR_ADDRESS}}`, `{{SUPPORT_PHONE_IF_PUBLISHED}}` | 실제 공개 주소·연락 경로. Play 개인 계정의 공개 범위와 일치시킨다. |
| `{{PRIVACY_CONTACT_NAME_OR_ROLE}}`, `{{PRIVACY_CONTACT_EMAIL}}` | 개인정보 보호책임자/담당자와 권리 행사 연락처. |
| `{{EFFECTIVE_DATE}}`, `{{REVISION_DATE}}` | 시행일과 개정일. |
| `{{SUPABASE_ENTITY_COUNTRY_REGION_CONTACT}}`, `{{OPENAI_ENTITY_COUNTRY_REGION_CONTACT}}`, `{{GOOGLE_ADS_ENTITY_COUNTRY_REGION_CONTACT}}` | 실제 계약 주체·국외 처리 지역·문의처. 공급자 계약과 콘솔에서 확인한다. |
| `{{CROSS_BORDER_TRANSFER_BASIS_AND_METHOD}}`, `{{CROSS_BORDER_TRANSFER_TIME_AND_ITEMS}}`, `{{CROSS_BORDER_RETENTION}}` | 국외 이전 법적 근거·방법/시점·항목·보유/이용 기간. 한국 개인정보보호법에 맞춰 검토한다. |
| `{{ACCOUNT_AND_CONTENT_RETENTION}}`, `{{CHAT_RETENTION}}`, `{{BACKUP_RETENTION}}`, `{{LEGAL_RETENTION_EXCEPTIONS}}` | 실제 DB·백업·법정 보존 기간과 예외. 코드만으로 확정할 수 없다. |
| `{{REPORT_CHANNEL}}`, `{{REPORT_REVIEW_STANDARD_AND_PERIOD}}` | AI 응답·공유 레시피 신고, 차단, 운영 검토의 실제 경로와 처리 기준. 구현 후 채운다. |

**출시 차단 게이트:** (1) 위 운영자 정보와 국외 처리 세부사항 확정, (2) 공개 URL과 앱 내 링크의 한국어·영어 실기기 확인, (3) Google OAuth·원격 계정 삭제·공유 사본 삭제의 실제 계정 검증, (4) 광고 SDK/UMP의 실제 데이터 수집과 Play Data safety 답변 대조, (5) 공유 전 약관 동의·신고·차단·검토 구현, (6) 게스트·대화·백업 보존 정책의 실제 배치/운영 확인. 자세한 체크는 문서 마지막에 적는다.

---

## A. 개인정보처리방침 — 한국어 공개 문안

**시행일:** `{{EFFECTIVE_DATE}}`
**운영자:** `{{OPERATOR_LEGAL_NAME}}` (서비스·Play 공개 명칭: `AloeTurtle`, 주소: `{{OPERATOR_ADDRESS}}`)

### 1. 처리하는 정보와 목적

냉톡은 냉장고 재고 관리, 대화·레시피 추천, 구매내역 인식, 계정 관리, 광고 제공을 위해 아래 정보를 처리합니다. Android 앱은 Google 계정으로 로그인합니다. 심사용 웹의 게스트 기능은 사용자별 별도 익명 계정을 만듭니다.

| 기능 | 처리 정보 | 목적 |
| --- | --- | --- |
| 계정·인증 | Google 로그인으로 전달되는 계정 식별자 및 인증 서비스가 제공하는 기본 프로필 정보 `{{ACTUAL_GOOGLE_PROFILE_FIELDS}}`, 세션 정보 | 로그인, 계정 식별, 접근 보호, 세션 유지 |
| 재고·맞춤 추천 | 식품명, 수량·단위, 보관법, 구매일·권장 소진일, 재고 변경 이력, 조리도구, 알레르기 설정, 저장·완료 레시피 | 재고 관리, 알레르기·도구 조건 확인, 레시피 추천과 조리 기록 |
| 대화·AI | 사용자가 보낸 문장, 현재 재고·알레르기·도구 등 추천에 필요한 맥락, AI 응답 | 대화 이해, 재고 변경안과 레시피 생성·검증 |
| 구매내역 인식 | 사용자가 선택한 구매내역/전자영수증 이미지와 이미지에서 추출된 상품 정보 | 상품 후보 추출과 사용자 확인 후 재고 등록. 이미지에는 이름·주소·연락처·결제정보가 포함될 수 있으므로 업로드 전 가려 주세요. |
| 레시피 공유·안전 운영 | 사용자가 명시적으로 공유한 완성 AI 레시피의 제목·내용·재료, 신고 내용 `{{REPORT_DATA_FIELDS}}` | 다른 사용자를 위한 레시피 검색, 유해 콘텐츠 신고·검토·차단 |
| 광고·서비스 운영 | AdMob 및 관련 SDK가 처리하는 기기/광고 식별자·광고 상호작용·동의 선택 등 `{{ACTUAL_AD_SDK_DATA_FIELDS}}`, 오류·요청 식별 정보 `{{ACTUAL_DIAGNOSTIC_FIELDS}}` | Android 일부 화면 광고, 개인정보 선택, 장애 대응·남용 방지 |

구매내역 원본 이미지는 인증된 서버 함수의 요청 메모리에서 OpenAI 비전 처리에 사용하며 앱 데이터베이스나 Storage에 원본을 영구 저장하지 않는 설계입니다. OCR 원문과 확인 전 초안은 등록·취소 전 현재 흐름에서만 사용하고, 확정한 품목의 재고 정보만 저장합니다. 실제 배포본에서 이 동작과 로그 제외가 검증된 후 이 문구를 확정합니다. OpenAI 요청의 `store:false` 설정은 **당사 요청 설정**이며 공급자의 모든 내부 보존이 0이라는 뜻으로 쓰지 않습니다.

### 2. 처리 근거·보유 기간

계정 운영과 핵심 기능에 필요한 정보는 서비스 제공 계약의 이행에 필요한 범위에서, 선택적 공유·광고 개인정보 선택 등은 해당 화면의 선택 및 적용 법령에 따라 처리합니다. 구체적 법적 근거와 동의 화면은 출시 전 법률 검토와 실제 UX에 맞춰 `{{PROCESSING_BASIS_BY_PURPOSE}}`로 확정합니다.

계정·재고·저장 레시피는 `{{ACCOUNT_AND_CONTENT_RETENTION}}`, 대화는 `{{CHAT_RETENTION}}`, 서비스 로그는 `{{LOG_RETENTION}}`, 백업은 `{{BACKUP_RETENTION}}`에 따라 보유한 후 삭제합니다. 법령에 따라 별도 보존해야 할 항목·근거·기간은 `{{LEGAL_RETENTION_EXCEPTIONS}}`에 밝힙니다. 심사용 웹 게스트의 7일 비활성 정리와 대화 30일 삭제는 설계 문서에 있으나, 배치 작업과 원격 삭제가 검증되기 전에는 이 공개 문안의 확정 기간으로 적지 않습니다.

### 3. 처리 위탁·국외 이전

서비스 운영에는 Supabase(인증·데이터베이스·서버 함수·호스팅 관련 처리), OpenAI(구매내역 이미지와 AI 요청 처리), Google/AdMob(Android 광고·개인정보 선택), Expo/EAS(앱 빌드 및 웹 호스팅)가 관여할 수 있습니다. **공급자별 위탁/제공 구분, 법인명·국가·처리 위치, 이전 항목·방법·시점·기간·거부 시 영향**을 실제 계약·배포 지역으로 확인한 뒤 아래 표를 완성합니다. 확정 전에는 국외 이전이 없다고 표시하지 않습니다.

| 상대방/업무 | 이전 항목·시점·방법 | 국가/연락처 | 보유·이용 기간/근거 |
| --- | --- | --- | --- |
| Supabase: 인증·앱 데이터·서버 처리 | `{{SUPABASE_TRANSFER_ITEMS_TIME_METHOD}}` | `{{SUPABASE_ENTITY_COUNTRY_REGION_CONTACT}}` | `{{SUPABASE_TRANSFER_RETENTION_BASIS}}` |
| OpenAI: AI 대화·이미지 분석 | `{{OPENAI_TRANSFER_ITEMS_TIME_METHOD}}` | `{{OPENAI_ENTITY_COUNTRY_REGION_CONTACT}}` | `{{OPENAI_TRANSFER_RETENTION_BASIS}}` |
| Google/AdMob: Android 광고·동의 | `{{GOOGLE_ADS_TRANSFER_ITEMS_TIME_METHOD}}` | `{{GOOGLE_ADS_ENTITY_COUNTRY_REGION_CONTACT}}` | `{{GOOGLE_ADS_TRANSFER_RETENTION_BASIS}}` |
| Expo/EAS: 웹 제공·배포 운영 | `{{EXPO_TRANSFER_ITEMS_TIME_METHOD}}` | `{{EXPO_ENTITY_COUNTRY_REGION_CONTACT}}` | `{{EXPO_TRANSFER_RETENTION_BASIS}}` |

국외 이전의 법적 근거, 거부·중지 요청 방법 및 서비스 영향: `{{CROSS_BORDER_TRANSFER_BASIS_AND_METHOD}}`. 한국 개인정보 보호법의 국외 이전 요건을 운영자와 담당자가 확인한 뒤 게시합니다.

### 4. 광고와 개인정보 선택

광고는 Android의 홈·재고·완료 레시피 목록에만 표시할 계획입니다. 광고에 관해 지역별로 필요한 안내·동의·선택 변경은 AdMob UMP와 앱의 `광고 개인정보 선택`에서 제공합니다. 광고 SDK의 실제 정보 처리와 제3자 공유는 출시 빌드의 SDK 설정 및 [Google 광고 개인정보 문서](https://policies.google.com/privacy)에 맞춰 `{{ACTUAL_AD_SDK_DATA_FIELDS}}`를 확정합니다. 웹·로그인·채팅·OCR·조리 화면에는 광고를 두지 않는 현재 출시 범위입니다.

### 5. 삭제·권리 행사·안전 조치

사용자는 앱의 `설정 > 계정 및 데이터 삭제` 또는 웹 [`/delete-account`](https://naengtalk.expo.app/delete-account)에서 본인 Google 계정으로 로그인한 후 계정 삭제를 요청할 수 있습니다. 삭제 대상은 인증 계정과 연결된 재고, 개인·완료 레시피, 공유한 레시피 사본 등입니다. 실제 배포와 원격 데이터 검증이 끝나기 전에는 이 경로를 공개하지 않습니다. 앱 삭제만으로 서버 계정이 삭제되지는 않습니다. 별도 보존 의무가 있다면 항목·근거·기간 `{{LEGAL_RETENTION_EXCEPTIONS}}`을 안내합니다.

사용자는 자신의 정보 열람·정정·삭제·처리 정지 등 법령상 권리와 문의를 `{{PRIVACY_CONTACT_EMAIL}}`로 요청할 수 있습니다. 담당자 `{{PRIVACY_CONTACT_NAME_OR_ROLE}}`, 연락처 `{{PRIVACY_CONTACT_EMAIL}}` / `{{SUPPORT_PHONE_IF_PUBLISHED}}`. 계정별 접근 통제와 인증, 서버 비밀값 분리, 원본 이미지·민감 텍스트의 로그 제외를 적용하고, 실제 운영 통제는 배포 점검 후 업데이트합니다. 정책 변경 시 `{{POLICY_CHANGE_NOTICE_METHOD}}`로 알립니다.

---

## B. Privacy Policy — English publication draft

**Effective date:** `{{EFFECTIVE_DATE}}`
**Operator:** `{{OPERATOR_LEGAL_NAME}}` (public service/developer name: `AloeTurtle`; address: `{{OPERATOR_ADDRESS}}`)

### 1. Data we process and why

NaengTalk processes data to manage pantry inventory, provide chat and recipe suggestions, recognize purchase records, operate accounts, and show ads. The Android app uses Google sign-in. The web review guest flow creates a separate anonymous account for each guest.

| Feature | Data | Purpose |
| --- | --- | --- |
| Account | Google account identifier and basic profile fields actually received `{{ACTUAL_GOOGLE_PROFILE_FIELDS}}`; session data | Sign-in, account access, session continuity |
| Pantry and recipes | Food names, amounts, units, storage method, purchase and recommended use-by dates, inventory changes, cooking tools, allergy settings, saved and completed recipes | Pantry functions, allergy and tool checks, recipe suggestions |
| Chat and AI | Your messages, relevant pantry/allergy/tool context, AI output | Understand requests, propose inventory changes and recipes |
| Purchase recognition | Images you select and extracted product candidates | Propose items for your review before adding them to inventory. Images may contain names, addresses, contact or payment details; cover them before upload. |
| Sharing and safety | Recipes you explicitly share, their titles, contents and ingredients; report details `{{REPORT_DATA_FIELDS}}` | Show recipes to others and review reports |
| Ads and operations | AdMob/device/ad/consent data `{{ACTUAL_AD_SDK_DATA_FIELDS}}`; diagnostic data `{{ACTUAL_DIAGNOSTIC_FIELDS}}` | Android advertising, privacy choices, service protection and troubleshooting |

The current design processes purchase images in an authenticated server function and sends them to OpenAI for image recognition without permanently storing originals in our app database or Storage. OCR text and unconfirmed drafts remain only in the active entry flow; confirmed pantry items are stored. We will make these statements final only after verifying the deployed service and logs. `store:false` describes our OpenAI request setting; it is not a claim that all provider-side retention is zero.

### 2. Basis and retention

We use account and feature data as needed to provide the service; optional sharing and ad privacy choices follow your actions and applicable law. The purpose-specific legal basis and consent wording must be finalized as `{{PROCESSING_BASIS_BY_PURPOSE}}` before publication.

Account, pantry and recipe data: `{{ACCOUNT_AND_CONTENT_RETENTION}}`; chat: `{{CHAT_RETENTION}}`; logs: `{{LOG_RETENTION}}`; backups: `{{BACKUP_RETENTION}}`. Any legally required retention and its exact basis and period: `{{LEGAL_RETENTION_EXCEPTIONS}}`. The planned seven-day inactive guest cleanup and 30-day chat deletion are **not yet verified operating retention rules**.

### 3. Providers and international processing

Supabase may handle authentication, database and server processing; OpenAI handles AI and image requests; Google/AdMob handles Android ads and privacy choices; Expo/EAS supports builds and web hosting. Before publication, we will identify each actual contracting entity, processing country/region, categories transferred, transfer timing/method, retention, legal basis and a contact point. The provider table in the Korean version must be completed and translated consistently. Transfer basis, refusal/stop request method and service effect: `{{CROSS_BORDER_TRANSFER_BASIS_AND_METHOD}}`.

### 4. Ads and choices

The planned Android ads appear only on Home, Pantry and Completed Recipes list screens. Where required, AdMob UMP presents privacy choices and the app offers an `Ad privacy choices` entry. Actual SDK data practices must be checked against the release build and completed as `{{ACTUAL_AD_SDK_DATA_FIELDS}}`. No ads are planned on the web or on sign-in, chat, purchase recognition or cooking screens.

### 5. Your choices, deletion and contact

You can request deletion in the app under `Settings > Delete account and data` or at [`/delete-account`](https://naengtalk.expo.app/delete-account) by signing in with your Google account. Deletion is intended to remove the account and linked pantry, personal/completed recipes and shared recipe copies. These paths must be deployed and verified with a real account before this text is published. Uninstalling the app does not itself delete server data. Any legal retention exception is listed at `{{LEGAL_RETENTION_EXCEPTIONS}}`.

For access, correction, deletion, processing restriction and other applicable rights, contact `{{PRIVACY_CONTACT_EMAIL}}`. Privacy contact: `{{PRIVACY_CONTACT_NAME_OR_ROLE}}`, `{{PRIVACY_CONTACT_EMAIL}}` / `{{SUPPORT_PHONE_IF_PUBLISHED}}`. We use account-scoped access controls, authentication and separated server secrets, and aim to keep original images and sensitive OCR text out of logs; operational controls must be verified before release. We announce material policy changes through `{{POLICY_CHANGE_NOTICE_METHOD}}`.

---

## C. 이용약관 — 한국어 공개 문안

**시행일:** `{{EFFECTIVE_DATE}}` · 운영자 `AloeTurtle` (`{{OPERATOR_LEGAL_NAME}}`)

1. **서비스.** 냉톡은 식품 재고 기록, 구매내역 인식, AI 대화·레시피 제안, 조리 기록을 제공합니다. Android 공개판은 Google 로그인이 필요합니다. 서비스 대상은 만 18세 이상입니다. 서비스 범위와 화면은 변경될 수 있으며 중요한 변경은 `{{TERMS_NOTICE_METHOD}}`로 알립니다.
2. **사용자 확인.** AI가 읽은 품명·수량·날짜와 제안한 재고 변경은 사용자 확인 후 적용합니다. `권장 소진일`은 관리용 추정치이며 포장 표시 소비기한이나 식품 안전 보증이 아닙니다. 알레르기·교차 접촉·조리 안전은 실제 제품 표시와 개인 상태를 사용자가 확인해야 합니다. 앱의 안전 검증은 오류 가능성을 없애지 않습니다.
3. **계정과 사용.** 사용자는 자신의 계정을 보호하고 타인의 권리를 침해하거나 허위·불법·유해 콘텐츠를 게시하지 않아야 합니다. 자동화된 남용, 무단 접근, 서비스 방해는 허용되지 않습니다. 계정 삭제는 앱과 웹의 삭제 안내를 따릅니다.
4. **공유 레시피.** 사용자가 완성한 AI 레시피를 명시적으로 공유하면 제목·재료·조리 내용의 사본이 다른 이용자의 검색·추천에 쓰일 수 있습니다. 사용자는 공유할 권리가 있는 내용만 제출하고 타인의 개인정보, 저작권 침해, 위험한 조리 지시를 포함하지 않아야 합니다. 운영자는 `{{REPORT_REVIEW_STANDARD_AND_PERIOD}}`에 따라 신고를 검토하고 콘텐츠 노출 제한·삭제 또는 계정 조치를 할 수 있습니다. 운영자가 공유 콘텐츠를 서비스 안에 표시·검색·안전 검토하는 데 필요한 **비독점적·무상·서비스 한정 이용 허락**을 받으며, 계정 삭제 시 해당 공유 사본은 삭제하는 정책입니다. 실제 공유 전 약관 동의와 신고·차단 기능이 구현·검증되어야 이 조항을 게시합니다.
5. **AI 결과와 외부 데이터.** AI 결과는 참고 제안이며 정확성·적합성을 보증하지 않습니다. 공공 레시피 원천과 AI·공유 레시피 표시는 실제 출처와 구분합니다. 제3자 서비스 사용에는 해당 제공자의 조건이 적용될 수 있습니다.
6. **서비스 변경·문의.** 장애·보안·운영 필요에 따라 기능을 제한할 수 있고, 법령상 의무와 사용자 권리는 존중합니다. 문의·신고: `jjamyeong@gmail.com`, `{{REPORT_CHANNEL}}`. 법령상 강행 규정을 제한하는 것으로 해석하지 않습니다. 준거법·분쟁 경로는 `{{GOVERNING_LAW_AND_DISPUTE_ROUTE}}`로 확정합니다.

## D. Terms of Service — English publication draft

**Effective date:** `{{EFFECTIVE_DATE}}` · Operator: `AloeTurtle` (`{{OPERATOR_LEGAL_NAME}}`)

1. **Service.** NaengTalk provides pantry records, purchase recognition, AI chat and recipe suggestions, and cooking records. The public Android app requires Google sign-in and is intended for adults 18 and older. We will announce material service changes through `{{TERMS_NOTICE_METHOD}}`.
2. **Review and food safety.** You review AI-extracted item names, amounts and dates and approve inventory changes. A recommended use-by date is an estimate for pantry management, not a product expiry date or a safety guarantee. Check the package, allergy and cross-contact information, and safe cooking requirements yourself. App checks cannot eliminate every error.
3. **Accounts and acceptable use.** Protect your account. Do not submit unlawful, harmful or rights-infringing content, abuse automation, access another person's data, or disrupt the service. Follow the deletion guide to remove your account.
4. **Shared recipes.** If you expressly share a completed AI recipe, a copy of its title, ingredients and cooking content may become searchable and usable by others. Submit only content you may share and do not include another person's data, infringing material or unsafe instructions. We may review reports and restrict or remove content or accounts under `{{REPORT_REVIEW_STANDARD_AND_PERIOD}}`. You grant the operator a non-exclusive, royalty-free license limited to displaying, searching and safety-reviewing shared content within the service. Our planned policy is to remove the shared copy when your account is deleted. Publish this clause only after consent, reporting, blocking and deletion have been implemented and tested.
5. **AI output and third-party material.** AI results are suggestions and may be inaccurate. Public-source recipes, AI recipes and shared recipes should be identified according to their actual origin. Third-party services may have their own terms.
6. **Changes and contact.** We may limit features for service, security or abuse reasons while respecting mandatory rights. Questions and reports: `jjamyeong@gmail.com`, `{{REPORT_CHANNEL}}`. This text does not limit mandatory legal protections. Governing law and dispute path: `{{GOVERNING_LAW_AND_DISPUTE_ROUTE}}`.

---

## E. 계정 삭제 안내 / Account deletion notice

**한국어:** 냉톡 계정을 삭제하려면 Android 앱에서 `설정 > 계정 및 데이터 삭제`를 열고 확인하세요. 앱을 제거했거나 접근할 수 없다면 [웹 계정 삭제](https://naengtalk.expo.app/delete-account)에서 같은 Google 계정으로 로그인한 뒤 `계정 및 데이터 영구 삭제`를 누르세요. 계정과 연결된 재고·개인 및 완료 레시피·공유 레시피 사본이 삭제됩니다. 별도 법정 보존 정보가 있다면 `{{LEGAL_RETENTION_EXCEPTIONS}}`에 항목·기간을 밝힙니다. 문제가 있으면 `jjamyeong@gmail.com`로 문의하세요. **이 경로는 배포·실계정 데이터 검증 전에는 공개하지 않습니다.**

**English:** To delete your NaengTalk account, open `Settings > Delete account and data` in the Android app and confirm. If you no longer have the app, visit [Delete account on the web](https://naengtalk.expo.app/delete-account), sign in with the same Google account and select `Permanently delete account and data`. We intend to delete your account, linked pantry, personal and completed recipes, and shared recipe copies. Any legally required retention must be specified at `{{LEGAL_RETENTION_EXCEPTIONS}}`. Contact `jjamyeong@gmail.com` for help. **Do not publish this path until deployed and verified with a real account.**

## F. 지원 안내 / Support notice

**한국어:** 냉톡 사용, 로그인, 결제 없는 광고 서비스, 데이터 삭제, 부정확한 AI 응답 또는 공유 레시피 신고는 `jjamyeong@gmail.com`로 문의해 주세요. 공유/AI 콘텐츠 신고는 앱의 `{{REPORT_CHANNEL}}`에서도 접수합니다(출시 전 구현 확인). 문의 시 계정 비밀번호, 인증 코드, 영수증 원본, 결제정보를 보내지 마세요. 운영자: `AloeTurtle`; 연락 가능한 시간·응답 목표: `{{SUPPORT_HOURS_AND_RESPONSE_TARGET}}`.

**English:** For NaengTalk help with use, sign-in, ads, data deletion, inaccurate AI output or shared recipes, contact `jjamyeong@gmail.com`. You can also report AI or shared content through `{{REPORT_CHANNEL}}` once available in the released app. Do not email passwords, verification codes, original receipts or payment details. Operator: `AloeTurtle`; support hours and response target: `{{SUPPORT_HOURS_AND_RESPONSE_TARGET}}`.

## 근거와 게시 검증 기록

- **소스 근거:** `mobile/src/services/auth.ts`(Google/게스트 인증·삭제 호출), `mobile/src/app/delete-account.tsx`(웹 삭제), `supabase/functions/delete-account/index.ts`(인증 사용자 삭제), `supabase/migrations/202609280001_delete_shared_recipes_with_account.sql`(공유 사본 삭제 트리거), `supabase/migrations/202609080001_core_inventory.sql`(계정 소유 데이터 cascade·RLS), `supabase/functions/purchase-ocr/index.ts` 및 `_shared/purchase-ocr-contract.ts`(이미지 처리·`store:false`), `supabase/functions/menu-chat/index.ts`(AI 요청 `store:false`), Android 광고·UMP 컴포넌트. 이 소스가 **배포·실행 검증을 대신하지는 않는다**.
- **정책 근거:** [개인정보 보호법 제30조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0030&lsiSeq=283839&urlMode=lsScJoRltInfoR), [국외 이전 제28조의8](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1034292881), [개인정보위 2026 작성지침 개정 안내](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&nttId=12021), [Google Play 개인정보 정책](https://support.google.com/googleplay/android-developer/answer/17517561), [계정 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111), [AI 생성 콘텐츠 정책](https://support.google.com/googleplay/android-developer/answer/14094294), [사용자 생성 콘텐츠 정책](https://support.google.com/googleplay/android-developer/answer/9876937), [AdMob UMP](https://developers.google.com/admob/android/privacy).
- [ ] 실제 앱 데이터 흐름, SDK 수집 목록, 공급자 계약·처리 지역·국외 이전 근거를 확인하고 한국어/영어 문안을 동일하게 완성한다. `{{` 자리표시자 0개를 확인한다.
- [ ] Google 로그인, 공유 동의·신고·차단, 광고 개인정보 선택, 앱·웹 계정 삭제, 보존·백업 삭제를 실제 출시 빌드와 원격 프로젝트에서 검증한다. 검증 전 완료형 표현을 공개하지 않는다.
- [ ] 개인정보처리방침·약관·삭제·지원 URL을 로그인 없이 열고, 앱 내 링크와 Play Console URL·Data safety·스토어 운영자 정보를 대조한다. 공개 페이지 구현·배포와 계정 설정은 이 문서의 범위가 아니다.
