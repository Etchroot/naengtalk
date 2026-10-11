# 냉톡 Google Play 개인 계정: 계정 소유자가 직접 할 일

## 2026-10-10 확인된 계정 정보

- 공개 개발자 이름: **AloeTurtle**. 공개 사용자 문의 이메일: **jjamyeong@gmail.com**. 사용자가 공개 용도로 제공한 값만 기록했다.
- 개인 계정 신원 인증: **승인 완료**(사용자 보고). Android 기기 인증·공개 전화번호 인증·앱 생성 완료 여부는 별도로 확인한다.
- 공개 개발자 이름과 문의 이메일은 아래 미정 항목에서 확정됐다. 법적 이름·주소·개인정보 권리 행사 담당자 등 다른 값은 대신 추정하지 않는다. 정책 페이지 게시와 스토어 등록은 아직 완료하지 않았다.

확인일: 2026-10-03. 대상은 **새 개인 개발자 계정**, 첫 공개 국가 한국·미국·캐나다·호주, 만 18세 이상, 무료 앱과 AdMob 배너다. 메뉴 이름은 Play Console 개편 또는 계정 상태에 따라 달라질 수 있으므로 연결된 공식 안내와 콘솔의 실제 필수 작업을 우선한다. 이 문서는 계정 소유자가 자기 계정에서 수행할 순서다. 앱 구현·빌드·배포 상태는 [출시 게이트](GOOGLE_PLAY_RELEASE.md)와 별도로 확인한다.

## 0. 계정 생성 전에 공개 정보 결정

- [ ] **개인 명의로 앱을 제공할지 확인한다.** Google은 개인 계정도 수익화할 수 있다고 안내하지만, 사업체를 대표해 계정을 만드는 경우에는 조직 계정을 선택하도록 설명한다. 사업자등록증 보유만으로 개인사업자에게 어느 유형이 자동 적용되는지 공식 도움말은 명시하지 않는다. 이 앱의 공개 운영 주체와 수익 수취 명의를 개인으로 둘 계획을 Play 가입 화면에서 확인하고, 사업체 명의로 운영해야 한다면 계정 유형을 확정하기 전에 [Play Console 지원](https://support.google.com/googleplay/android-developer/answer/13634885)에 문의한다.
- [ ] **공개 개발자 이름, 사용자 문의용 이메일, 한국에서 인증할 공개 개발자 전화번호**를 정한다. 개인 계정의 법적 이름·주소는 연결된 Google 결제 프로필에서 가져온다. Google은 개인 개발자의 법적 이름·국가·개발자 이메일을 표시하고 Play에서 수익화하는 계정은 전체 주소도 표시한다고 안내한다. **현재 계획인 무료 앱의 AdMob 광고만으로 이 주소 공개 조건에 해당하는지는 공식 안내만으로 확정하기 어려우므로**, 가입 과정과 Play Console의 공개 개발자 프로필 미리보기에서 실제 표시 범위를 확인한다. 한국 개인 개발자는 개발자 전화번호를 추가로 제공·인증해야 하고 이 번호가 Play에 표시된다. 현재 주소가 바뀔 가능성이 있으므로, 본인이 수령·유지·갱신할 수 있는 법적 주소와 결제 프로필 정보를 먼저 정한다. [계정 생성 정보](https://support.google.com/googleplay/android-developer/answer/13628312), [한국 배포 요건](https://support.google.com/googleplay/android-developer/answer/6223646), [개발자 정보 인증](https://support.google.com/googleplay/android-developer/answer/10841920)
- [ ] 앱의 **공개 상호/운영 주체 표기, 지원 이메일, 웹 지원 연락처**를 확정한다. 개인정보처리방침·약관·탈퇴 페이지와 Play 등록정보에 같은 표기를 쓸 수 있어야 한다. 현재 미정이므로 해당 문서와 스토어 등록을 완료로 표시하지 않는다.
- [ ] 계정용 Google 로그인, 본인 확인 자료, 결제 수단, 인증 가능한 이메일·전화번호, Android 10 이상 비루팅 실물 기기를 준비한다. 가입 화면의 개인용 계정을 선택하고, 본인 정보 및 연락처를 본인 계정에서만 입력한다. [계정 유형과 연락처](https://support.google.com/googleplay/android-developer/answer/10840893), [기기 인증](https://support.google.com/googleplay/android-developer/answer/14316361)

**팀에 알려줄 상태:** 공개 표기·주소 유지 방침이 `결정/미정`, Play 계정이 `생성/심사 중/인증 완료`, 공개 전화번호 인증이 `완료/대기`인지 정도만 알린다. 법적 이름·주소·전화번호·결제 정보·인증 코드·계정 화면 원본은 채팅이나 저장소에 보내지 않는다.

## 1. Play 개인 계정과 기기 인증

1. [Play Console](https://play.google.com/console/)에서 개인 개발자 계정을 만들고 Google 결제 프로필·본인 인증·연락처 이메일/전화번호 인증을 콘솔 안내대로 마친다. 계정 세부정보는 `개발자 계정 > 내 정보`와 `연락처 정보`에서 다시 확인한다. 한국 개인 계정의 공개 개발자 전화번호도 필요한 순서에 따라 인증한다. [개발자 정보 인증](https://support.google.com/googleplay/android-developer/answer/10841920)
2. 계정 소유자로 Play Console 웹의 **홈**에서 `Android 휴대기기에 액세스할 수 있는지 인증` 작업을 열고 QR을 스캔한다. 실물 Android 10 이상 비루팅 기기에서 Play Console 앱을 열어 **동일한 소유자 계정**으로 로그인하고 `Verify/인증`을 완료한다. 홈 작업이 사라졌는지 확인한다. [새 계정 기기 인증](https://support.google.com/googleplay/android-developer/answer/14316361)
3. `냉톡` 앱을 만들 때 무료 앱, 기본 언어, 앱 이름을 실제 제품과 맞춘다. Android 패키지명은 빌드팀과 확인한 후 첫 AAB 등록 시 확정한다. 후보 `com.naengtalk.app`이 사용할 수 없으면 `com.naengtalk.mobile` 후보를 협의한다. 패키지명은 등록 후 쉽게 바꿀 수 없는 식별자다. [앱 만들기와 등록정보](https://support.google.com/googleplay/android-developer/answer/9859152)

**팀에 알려줄 상태:** 기기 인증 완료 여부, 앱 생성 여부, 확정된 **패키지명**만 전달한다. 패키지명은 공개 식별자다.

## 2. Google 로그인과 Supabase 설정 — 앱의 콜백 경로 확정 후

1. Google Cloud의 [Google Auth Platform](https://console.cloud.google.com/auth/overview)에서 프로젝트의 **Audience/동의 화면**을 구성하고 앱 이름·지원 이메일·승인된 도메인·필요 범위를 실제 서비스와 일치시킨다. 외부 이용자가 로그인할 공개 앱이면 테스트 사용자 제한 등 게시 상태를 확인한다. [Supabase Google 로그인 절차](https://supabase.com/docs/guides/auth/social-login/auth-google)
2. `Clients`에서 **Web application OAuth 클라이언트**를 만들고 `Authorized JavaScript origins`에 production 웹 origin `https://naengtalk.expo.app`을 등록한다. `Authorized redirect URIs`에는 Supabase 대시보드의 **Auth > Providers > Google** 화면에 표시되는 프로젝트별 callback URL을 그대로 등록한다. 임의의 Supabase URL을 추측해 입력하지 않는다. [Supabase Google 로그인 절차](https://supabase.com/docs/guides/auth/social-login/auth-google)
3. Supabase 대시보드의 **Authentication > Providers > Google**에서 공급자를 활성화하고 발급된 client ID와 client secret을 **대시보드 안에서만** 입력한다. **Authentication > URL Configuration**에서 production 웹 URL과 실제 앱 콜백 URL(`naengtalk://`, 현재 Android 앱 코드에서 확인한 정확한 복귀 URL)을 허용 redirect URL로 설정한다. 웹 탈퇴 페이지 복귀 경로도 구현 흐름에 맞춰 확인한다. [Redirect URL 허용 목록](https://supabase.com/docs/guides/auth/redirect-urls)
4. 로그인 가능한 APK가 준비되면 **실제 Android 기기**에서 로그인 성공·취소·실패 후 복귀, 앱 재실행 세션 복원, 로그아웃, 웹 로그인, 웹 탈퇴 페이지 복귀를 검증한다. 이 검증 전에는 OAuth 설정을 `완료`로 표시하지 않는다.

**팀에 알려줄 상태:** Cloud 동의 화면 `구성/게시`, OAuth 클라이언트와 Supabase 공급자 `연결/대기`, 웹·앱 콜백 검증 `통과/실패`만 전한다. client secret, 프로젝트 인증 정보, OAuth 코드·토큰은 공유하지 않는다.

## 3. EAS 빌드 환경 — 팀이 첫 preview APK를 빌드하기 전

### 첫 APK 로그인용 설정 순서

2026-10-03 최초 확인 시 Supabase Google 공급자는 비활성이었으나, 이후 사용자 설정 및 실기기 시도에서 Google 계정 선택 후 앱 홈 복귀와 홈 테스트 광고 표시를 확인했다. 아래는 설정 재현용 안내이며, 재실행 세션 복원과 로그아웃·동일 계정 재로그인은 사용자 보고로 확인했다. 로그인 취소 후 복귀·재시도는 사용자 보고로 확인했다. 로그인 실패 검증은 아직 남아 있다.

1. 현재 앱이 사용하는 Supabase 프로젝트를 열고 **Authentication > Providers > Google**에서 callback URL을 복사한다. 이 화면은 열어 둔다.
2. [Google Auth Platform](https://console.cloud.google.com/auth/overview)에서 사용할 Cloud 프로젝트를 선택한다. 처음이면 시작 화면에서 앱 이름 `냉톡`, 본인이 받을 지원 이메일과 개발자 연락 이메일을 입력한다. **Audience**는 일반 Google 계정으로 테스트할 수 있는 **External**을 선택하고, 테스트 상태에서는 **Test users**에 휴대폰에서 로그인할 Google 계정을 추가한다.
3. **Data Access**에 기본 로그인 범위 `openid`, 이메일, 프로필을 설정한다. 다른 Google 서비스 권한은 현재 로그인에 필요하지 않다.
4. **Clients > Create client**에서 유형 **Web application**, 식별용 이름 `냉톡 Supabase 로그인`을 선택한다. 현재 앱은 브라우저 OAuth를 사용한다.
   - **Authorized JavaScript origins**: `https://naengtalk.expo.app`
   - **Authorized redirect URIs**: 1번에서 복사한 Supabase callback URL
5. 생성된 client ID와 client secret을 Supabase의 Google 설정 칸에 입력하고 **Enable**을 켠 뒤 저장한다. 두 값은 본인 대시보드에서만 다루며, EAS 환경 변수나 채팅에 넣지 않는다.
6. Supabase **Authentication > URL Configuration > Redirect URLs**에 `naengtalk://`, `https://naengtalk.expo.app`, `https://naengtalk.expo.app/delete-account`를 추가하고 저장한다. 이미 있는 유효한 웹 설정은 유지한다. **Google Cloud의 callback URL**과 **Supabase의 앱 복귀 URL**은 서로 다른 설정 칸이다.
7. APK 설치 후 Google 로그인으로 2번의 테스트 계정을 선택한다. 앱 복귀와 로그인 성공을 확인하고 앱을 종료·재실행해 로그인 유지도 확인한다. 설정 완료만으로 로그인 검증을 통과한 것으로 기록하지 않는다.

공식 절차: [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [모바일 복귀 URL](https://supabase.com/docs/guides/auth/native-mobile-deep-linking). 설정을 마치면 `Google 공급자 활성화·앱 복귀 URL 등록 완료`라고만 알려준다.

- [x] 2026-10-03 사용자 등록 및 EAS 이름별 존재·빌드 로드 확인. Expo 프로젝트의 **Project settings > Environment variables**에서 `preview` 환경에 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`를 등록한다. 이 둘은 앱 번들에서 읽는 공개 설정이다. URL과 공개 키를 서로 다른 Supabase 프로젝트에서 섞지 않는다. `EXPO_PUBLIC_` 값은 최종 사용자에게 보일 수 있으므로 **service role, Google OAuth client secret, OpenAI API 키**를 넣지 않는다. 현재 앱의 preview 프로필은 EAS `preview` 환경을 사용한다. [EAS 변수 관리](https://docs.expo.dev/eas/environment-variables/manage/), [EAS 빌드 변수 사용](https://docs.expo.dev/eas/environment-variables/usage/)
- [ ] `preview` APK는 공식 AdMob 테스트 앱 ID/배너 단위 ID를 사용하도록 빌드팀이 확인한다. production AAB 전에만 `production` 환경에 실제 `ADMOB_ANDROID_APP_ID`와 `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`를 각각 등록한다. 앱 ID와 광고 단위 ID는 다르다. 광고 단위 ID는 앱에서 읽을 수 있는 공개 식별자이고, 값 전달은 EAS 설정에서 직접 한다. [Google 테스트 광고](https://developers.google.com/admob/android/test-ads), [EAS 변수 관리](https://docs.expo.dev/eas/environment-variables/manage/)

**팀에 알려줄 상태:** 각 변수의 **이름별 등록 여부**와 대상 환경 `preview/production`만 전한다. 값, EAS 변수 화면 캡처, Supabase 키를 보내지 않는다.

## 4. AdMob 계정·배너·동의 메시지

1. [AdMob](https://admob.google.com/) 계정을 개설하고 지급 프로필을 만든다. 앱이 아직 Play에 없으면 Android 앱을 **미게시(Unpublished)**로 추가해 테스트 준비를 한다. Play에 등록된 뒤 해당 스토어 앱과 연결하고 앱 준비 심사 상태를 확인한다. 신규 앱은 소유권 확인과 앱 준비 심사가 끝나야 광고가 온전히 공급된다. [AdMob 시작](https://support.google.com/admob/answer/15948559), [앱 설정](https://support.google.com/admob/answer/9989980)
2. 앱에서 **배너 광고 단위**를 만들고 Android 앱 ID와 배너 단위 ID를 구분해 본인 EAS `production` 환경에 넣는다. 실제 광고 ID는 테스트 APK에 사용하지 않는다. 팀의 APK 실기기 검증에서는 Google 공식 테스트 광고를 확인한다. [테스트 광고](https://developers.google.com/admob/android/test-ads)
3. **Privacy & messaging**에서 대상 지역에 맞는 메시지의 필요성을 확인하고 해당 메시지를 만들었다면 `Draft`가 아닌 `Published` 상태인지 확인한다. 앱의 UMP는 시작 시 동의 상태를 갱신하고 필요한 폼·개인정보 선택 진입점을 표시해야 한다. 팀에 한국·미국·캐나다·호주 기기 및 필요한 지역 시뮬레이션 검증을 요청한다. [UMP 설정](https://developers.google.com/admob/android/privacy), [메시지 게시](https://support.google.com/admob/answer/13651178), [메시지 유형](https://support.google.com/admob/answer/10114020)
4. **app-ads.txt**: Play 스토어의 개발자 웹사이트에 소유 가능한 주소를 넣고, AdMob이 제공하는 본인용 행을 그 호스트의 루트 `/app-ads.txt`에서 공개한다. 현재 계획인 `https://naengtalk.expo.app`에 게시할 수 있는지와 AdMob 크롤링 결과를 확인한다. 실패하면 전용 도메인으로 이전하는 결정을 빌드팀과 한다. AdMob `Apps > View all apps > app-ads.txt`에서 상태와 재확인을 확인한다. 2025년 이후 새 AdMob 앱은 app-ads.txt 확인이 중요하며, 미확인 앱은 광고 공급이 제한된다. [설정 절차·크롤러 위치](https://support.google.com/admob/answer/9363762), [소유권 확인](https://support.google.com/admob/answer/14538460)

**팀에 알려줄 상태:** AdMob 계정·앱·배너 단위 `생성/대기`, 메시지 `게시/대기`, app-ads.txt `확인/대기/실패`, 앱 준비 심사 `승인/심사 중/거절`만 전한다. 게시자 ID나 지급 정보는 공유하지 않는다.

## 5. 정책 URL과 Play 등록 양식 — 기능·문안·공개 연락처 확정 후

1. `https://naengtalk.expo.app`의 개인정보처리방침, 이용약관, 지원 안내, `/delete-account`를 브라우저에서 열어 **로그인하지 않아도 필요한 안내가 보이는지**, 앱 이름·운영 주체·지원 연락처가 일치하는지 확인한다. 계정 생성 앱은 **앱 안의 계정 삭제 경로**와 **앱 밖의 웹 삭제 요청 경로**가 모두 필요하다. 탈퇴 기능 배포와 실제 계정의 원격 데이터 삭제 검증이 끝나기 전에는 삭제 관련 Play 양식을 제출하지 않는다. [Google 계정 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111)
2. Play Console 앱의 **Policy > App content**에서 개인정보처리방침 URL, `App access` 심사용 로그인/접근 방법, `Ads`(광고 있음), `Target audience and content`(실제 18세 이상 대상), `Content ratings`, `Data safety` 및 계정 삭제 질문을 **실제 릴리스 빌드와 데이터 흐름에 맞춰** 작성한다. 한국어·영어 등록정보와 국가 설정도 실제 제공 범위에 맞춘다. 심사자가 로그인해야 하면 작동하는 접근 방법을 제공한다. [Play Console 요구사항](https://support.google.com/googleplay/android-developer/answer/10788890), [대상 연령](https://support.google.com/googleplay/android-developer/answer/9867159), [등급](https://support.google.com/googleplay/android-developer/answer/9898843), [계정 삭제 질문](https://support.google.com/googleplay/android-developer/answer/13327111)
3. `Data safety`는 Supabase 인증·재고·레시피, 구매내역 이미지의 일시 처리, OpenAI 처리, AdMob SDK의 수집·공유 가능 데이터, 삭제·보존을 **실제 빌드와 공급자 문서**에 맞춰 검토한다. 추정으로 `데이터 수집 없음`을 선택하지 않는다. Play 스토어 메인 등록정보에는 실제 앱 캡처·설명·지원 연락처를 넣고, 제출 전 언어별 화면과 개인정보 문안 일치를 확인한다. [데이터 보안 양식 안내](https://support.google.com/googleplay/android-developer/answer/10787469), [메인 스토어 등록정보](https://support.google.com/googleplay/android-developer/answer/9859152)

**팀에 알려줄 상태:** URL별 `공개/대기`, 앱 안·웹 탈퇴 검증 `통과/대기`, Play 양식별 `작성/검토/승인/반려` 및 반려 사유의 **개인정보를 지운 요약**만 전한다.

## 6. 비공개 테스트 12명·연속 14일 — AAB와 앱 설정 완료 후

1. 팀이 제공한 **production AAB**와 확정 패키지명을 확인한다. 필요하면 Play 내부 테스트로 소수 실기기에서 로그인·핵심 흐름·광고·탈퇴를 먼저 점검한다. 내부 테스트는 12명 요건을 대신하지 않는다. [새 개인 계정 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465)
2. Play Console의 **Test and release > Testing > Closed testing**에서 비공개 테스트 트랙을 만들고 테스터 이메일 목록 또는 Google 그룹을 구성한다. 최소 12명보다 여유 있게 모집한다. 앱 설정을 마치고 릴리스를 게시한 뒤 참여 링크를 공유한다. 각 테스터에게 Play의 **참여(opt in)** 버튼을 직접 누르게 하고, 14일 동안 참여를 해제하지 않도록 안내한다. 단순 초대나 APK 설치만으로 참여로 간주하지 않는다. [비공개 테스트와 참여 조건](https://support.google.com/googleplay/android-developer/answer/14151465)
3. 테스트 기간에 테스터가 실제로 로그인·재고·채팅·레시피·구매내역·탈퇴 흐름을 사용하도록 안내하고, 오류·기기·버전·재현 경로를 모은다. Play Console **Monitor and improve > Ratings and reviews > Testing feedback**와 별도 피드백 채널을 확인한다. 문제를 수정한 릴리스는 다시 점검한다. [테스터 참여 및 피드백](https://support.google.com/googleplay/android-developer/answer/14151465)
4. **신청 시점 직전 14일 동안 12명 이상이 연속 참여 상태**인지 콘솔에서 확인한다. 누군가 해제 후 재참여하면 그 사람의 14일은 다시 시작한다. 요건 달성 후 대시보드에서 production access를 신청하고 앱 설계·테스트 과정·피드백·수정·출시 준비 질문에 실제 기록으로 답한다. 승인 뒤 production 릴리스와 국가 설정을 제출하고 심사 결과를 기다린다. [프로덕션 접근 신청](https://support.google.com/googleplay/android-developer/answer/14151465)

**팀에 알려줄 상태:** 테스트 시작일, 현재 **연속 참여 인원 수**, 14일 충족 여부, production access `신청/승인/추가 테스트 요청`, Play 심사 `진행/승인/반려`만 전한다. 테스터 이메일·개별 활동 내역은 공유하지 않는다.

## 7. 지급·세금·주소 유지 확인

- [ ] AdMob **Payments**에서 지급 정보·결제 주소·지급 보류·세금 정보 요청을 확인한다. 수익 기준에 도달하면 신원·주소 인증이 필요할 수 있으므로 바뀔 예정인 주소로 우편 인증을 시작할지 먼저 판단한다. 실제 주소 변경 시 Google 결제 프로필과 Play·AdMob 정보를 갱신하고 필요한 재인증을 마친다. [AdMob 지급 정보](https://support.google.com/admob/answer/12835021), [지급 인증](https://support.google.com/admob/answer/6149211), [세금 정보](https://support.google.com/admob/answer/14135099)
- [ ] AdMob 광고 수익의 국내 사업자등록 업종, 부가가치세·종합소득세 처리, 해외 지급 및 Google이 요구하는 세금 양식은 **국세청 또는 세무사**와 개인 상황에 맞춰 확인한다. 기존 사업자등록의 업종·주소를 변경해야 한다면 국세청 정정 절차를 확인한다. Play 개인 계정 선택만으로 국내 세금 처리가 자동으로 결정되지는 않는다. [국세청 사업자등록 정정](https://b.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7779&mi=2446), [AdMob 세금 안내](https://support.google.com/admob/answer/2772620)

**팀에 알려줄 상태:** 지급 프로필 `설정/대기`, 신원·주소 인증 `완료/대기`, 세무 검토 `완료/대기`만 전한다. 은행·세금·신분증 자료는 공유하지 않는다.
