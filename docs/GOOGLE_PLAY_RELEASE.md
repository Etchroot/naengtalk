# 냉톡 Google Play 출시 작업

기준일: 2026-09-28. 이 문서는 Android 공개 출시를 위한 작업·검증 기록이다. 현재 심사용 웹의 배포 상태와 Android 공개 출시 준비 상태를 혼동하지 않는다.

## 확정된 첫 출시 기준

- `main`의 시작 커밋 `fe0f8edbfffea4a923bc7ba64f805850b9357cb2`에서 `codex/google-play-launch` 브랜치를 분리한다. 복구 기준은 이 커밋이며 `main`에 출시 작업을 직접 반영하지 않는다.
- 첫 공개 국가는 한국·미국·캐나다·호주, 대상은 18세 이상이다. 앱 기능·정책·스토어 설명은 한국어와 영어를 지원한다.
- Android 공개판은 Google 로그인만 제공하고, 심사용 웹의 게스트 진입은 유지한다.
- Android의 홈·재고·완료 레시피 목록에만 AdMob 배너를 제공한다. 웹과 로그인·채팅·OCR·조리 흐름에는 광고를 두지 않는다.
- 공개 레시피 공유를 유지한다. 공유 전 약관 동의, AI 응답·공유 콘텐츠 신고, 콘텐츠·사용자 차단과 운영 검토, 탈퇴 시 공유 사본 정리를 출시 조건으로 둔다.
- 별도 도메인 없이 `https://naengtalk.expo.app`에서 개인정보처리방침·이용약관·탈퇴 안내·지원 정보를 먼저 제공한다. AdMob의 `app-ads.txt` 확인이 실패하면 전용 도메인으로 이전한다.

## 계정과 배포 선행 조건

1. 사용자는 사업장 주소가 곧 바뀔 수 있고 조직 웹사이트 준비 부담이 있어 **개인 개발자 계정으로 진행하기로 결정했다**. 계정 생성 전 공개 신원·주소 범위를 확인한다. 한국 개인 계정은 공개 개발자 전화번호도 인증해야 한다. 계정 생성은 사용자가 직접 한다. [계정 유형](https://support.google.com/googleplay/android-developer/answer/13634885), [공개 정보](https://support.google.com/googleplay/android-developer/answer/13628312), [한국 전화번호](https://support.google.com/googleplay/android-developer/answer/10841920)
2. 개인 계정으로 진행하면 실제 Android 기기 인증과 12명 이상이 연속 14일 참여하는 비공개 테스트를 준비하고, 완료 후 프로덕션 접근을 신청한다. 앱 설정을 마쳐야 비공개 테스트를 시작할 수 있으므로 출시 일정에 심사 시간을 별도로 둔다. [개인 계정 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465)
3. Google Cloud OAuth 클라이언트, Supabase Google 제공자와 허용 redirect URL, Play 개발자 계정, AdMob 앱·광고 단위, 사업자 지원 연락처를 준비한다. 인증 정보와 광고 게시자 정보는 채팅·저장소·로그에 기록하지 않는다.
4. 개발 기기 직접 설치에는 EAS `preview` APK, Play 업로드에는 `production` AAB를 사용한다. Android 패키지명 후보 `com.naengtalk.app`은 Play 등록 시 충돌을 확인하고, 충돌하면 `com.naengtalk.mobile`로 확정한다. [Expo APK/AAB 안내](https://docs.expo.dev/build-reference/apk/)
5. 계정 삭제는 공유 레시피 사본 삭제 migration을 먼저 배포한 뒤 `delete-account` Edge Function과 웹 `/delete-account`를 배포한다. 실제 Google 계정으로 앱 내·웹 경로 각각을 시험하고, 원격 재고·개인 레시피·공유 레시피가 모두 사라졌는지 확인한다. [Google Play 계정 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111), [Supabase 사용자 삭제](https://supabase.com/docs/guides/auth/managing-user-data)

### 계정에서 직접 설정할 항목

- Google Cloud에서 OAuth 동의 화면과 웹 OAuth 클라이언트를 준비하고 Supabase Auth의 Google 제공자를 활성화한다. Google Cloud 승인 리디렉션에는 Supabase가 표시하는 콜백 주소를 넣고, Supabase URL 허용 목록에는 웹 루트·`/delete-account`·앱의 `naengtalk://` 콜백을 등록한다. 실제 EAS APK의 딥링크 복귀와 웹의 삭제 페이지 복귀를 각각 검증한다.
- AdMob 계정과 Android 앱·배너 광고 단위를 만든다. `preview` APK에는 Google 공식 테스트 앱 ID·배너 단위 ID만 사용한다. `production` AAB 전에는 EAS 빌드 환경에 `ADMOB_ANDROID_APP_ID`와 `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`를 등록한다. 앱 ID와 광고 단위 ID는 서로 다른 값이며, 앱 ID는 네이티브 빌드 구성에 들어간다. 유효한 실제 ID가 없거나 테스트 ID를 쓰면 프로덕션 빌드 구성이 중단된다. 계정에서 발급받은 값은 채팅이나 문서에 붙여 넣지 않는다. [Google 테스트 광고](https://developers.google.com/admob/android/test-ads)
- 개인 계정 경로의 공개 신원·연락처·주소 표시를 확인하고 테스터 12명 이상을 확보한다. 조직 계정으로 방향을 바꿀 때만 D-U-N-S, 조직 웹사이트, 사업자 정보 일치를 준비한다.
- 공개 상호, 지원 이메일, 연락처·주소를 결정한다. 현재 미정이므로 개인정보처리방침·약관·Play 등록정보의 게시를 완료로 표시하지 않는다.
- D-U-N-S 기본 신청·회사 정보 갱신은 무료이며 유료 신속 처리·부가 서비스는 선택이다. 상호 변경은 먼저 사업자등록을 정정하고 D&B 프로필과 Google 결제 프로필의 법적 명칭·주소를 맞춘다. 동일 사업체의 상호 변경만으로 번호를 재발급받는다고 단정하지 않는다. [D&B 비용·갱신](https://www.dnb.com/en-us/smb/duns/get-a-duns.html), [Google 신원 정보 변경](https://support.google.com/googleplay/android-developer/answer/16260648)

### 한국 사업자·수익 신고 확인

- 현재 계획은 무료 앱의 AdMob 광고 수익이다. 조직 계정 선택 자체가 별도의 국내 영업 허가를 발생시키는 것은 아니지만, 광고 수익은 국세 신고 대상이므로 기존 사업자등록의 업종과 부가가치세·종합소득세 처리 방식을 국세청 또는 세무사와 확인한다. 기존 업종과 다르면 국세청 사업자등록 정정 절차를 사용한다. [국세청 사업자등록 정정](https://b.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7779&mi=2446), [AdMob 세금 안내](https://support.google.com/admob/answer/2772620)
- 앱을 유료로 팔거나 인앱 구매를 추가하면 한국의 전자상거래·통신판매 관련 신고와 Play의 사업자등록번호·통신판매업 신고번호 표시 요건을 별도 검토한다. 현재 광고 수익만으로 통신판매업 신고가 필요하다고 단정하지 않는다. [Google의 한국 배포 요건](https://support.google.com/googleplay/android-developer/answer/6223646), [전자상거래법의 통신판매 정의](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=009318&lsJoLnkSeq=900352868&print=print)
- 온라인 서비스가 부가통신역무에 해당하는지는 운영 형태로 판단한다. 소규모 인터넷 부가통신사업자는 신고 면제 규정이 있으므로 실제 해당 여부를 확인한다. [중앙전파관리소 FAQ](https://www.crms.go.kr/lay1/bbs/S1T123C131/A/23/view.do?article_seq=10581)

## 구현 및 검증 게이트

| 게이트 | 통과 조건 | 현재 상태 |
| --- | --- | --- |
| 빌드 설정 | Android package, APK/AAB 프로필, API 36, 서명·버전 코드 확인 | Expo Android 번들·네이티브 구성 분석 통과. EAS preview 환경에 Supabase 공개 설정이 아직 없어 로그인 가능한 APK 빌드·실기기 설치, 서명·버전 코드 확인 대기 |
| 인증 | Google 로그인·취소·실패·복원·로그아웃, 계정별 기기 데이터 격리, 심사용 웹 게스트 유지 | 로컬 코드·테스트 완료, OAuth 설정·실기기 검증 대기 |
| 다국어 | 모든 화면·오류·접근성 문구와 영어 재고 입력·AI 대화·레시피의 안전 검증 | 대기 |
| 개인정보·약관 | 공개 URL과 앱 내 링크, 데이터 흐름·국외 처리·광고·보존·삭제 고지, 계정 삭제 앱·웹 경로 | 삭제 화면·Edge Function·공유 사본 삭제 migration을 로컬 작성, 배포·실계정 삭제 검증 대기. 사업자 상호·지원 이메일·공개 연락처 미정 |
| AI·공유 운영 | 앱 내 신고·차단, 검토와 처리 기록, 이용약관 동의 | 대기 |
| 광고 | AdMob SDK·테스트 광고, 지역별 개인정보 선택, 광고 지면, `app-ads.txt` 검증 | SDK 16.5.0과 Android 전용 홈·재고·레시피 배너, UMP 동의 후 초기화, preview 테스트 ID·production 실제 ID 게이트를 로컬 작성. APK 광고 표시·국가별 동의·AdMob 운영 설정·`app-ads.txt` 검증 대기 |
| Play 등록 | 언어별 등록정보·스크린샷, 광고·연령·권한·데이터 보안 신고, 심사 계정 | 대기 |
| 실기기·출시 | APK 직접 설치, Play 내부 테스트 AAB, 핵심 흐름·광고·삭제·영어 QA, 계정 경로별 공개 조건 | 대기 |

출시 직전 Google Play와 AdMob 정책을 다시 확인한다. Play는 앱 내·외 계정 삭제 경로와 [AI 신고 기능](https://support.google.com/googleplay/android-developer/answer/13985936)을 요구한다. 공유 레시피에는 [사용자 생성 콘텐츠 정책](https://support.google.com/googleplay/android-developer/answer/9876937)을 적용해 준비한다. AdMob의 앱별 정상 광고 공급은 앱 공개 후 [소유권 확인과 준비 심사](https://support.google.com/admob/answer/14538460)에 따라 늦어질 수 있다.
