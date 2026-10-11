# 냉톡 Google Play 출시 작업

기준일: 2026-10-03. 이 문서는 Android 공개 출시를 위한 작업·검증 기록이다. 현재 심사용 웹의 배포 상태와 Android 공개 출시 준비 상태를 혼동하지 않는다. 계정 소유자가 수행할 상세 순서는 [개인 계정 직접 작업 가이드](PLAY_OWNER_ACTIONS.md), 한국어·영어 구현 범위는 [다국어 감사](GOOGLE_PLAY_I18N_AUDIT.md), 게시 전 검토할 문안은 [정책 초안](GOOGLE_PLAY_POLICY_DRAFT.md)을 따른다.

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
5. 공유 레시피 사본 삭제 migration은 2026-10-11 production에 배포했다. 다음으로 `delete-account` Edge Function과 웹 `/delete-account`를 배포한 뒤 실제 Google 계정으로 앱 내·웹 경로 각각을 시험하고, 원격 재고·개인 레시피·공유 레시피가 모두 사라졌는지 확인한다. [Google Play 계정 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111), [Supabase 사용자 삭제](https://supabase.com/docs/guides/auth/managing-user-data)

### 계정에서 직접 설정할 항목

- Google Cloud에서 OAuth 동의 화면과 웹 OAuth 클라이언트를 준비하고 Supabase Auth의 Google 제공자를 활성화한다. Google Cloud 승인 리디렉션에는 Supabase가 표시하는 콜백 주소를 넣고, Supabase URL 허용 목록에는 웹 루트·`/delete-account`·앱의 `naengtalk://` 콜백을 등록한다. 실제 EAS APK의 딥링크 복귀와 웹의 삭제 페이지 복귀를 각각 검증한다.
- AdMob 계정과 Android 앱·배너 광고 단위를 만든다. `preview` APK에는 Google 공식 테스트 앱 ID·배너 단위 ID만 사용한다. `production` AAB 전에는 EAS 빌드 환경에 `ADMOB_ANDROID_APP_ID`와 `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`를 등록한다. 앱 ID와 광고 단위 ID는 서로 다른 값이며, 앱 ID는 네이티브 빌드 구성에 들어간다. 유효한 실제 ID가 없거나 테스트 ID를 쓰면 프로덕션 빌드 구성이 중단된다. 계정에서 발급받은 값은 채팅이나 문서에 붙여 넣지 않는다. [Google 테스트 광고](https://developers.google.com/admob/android/test-ads)
- 개인 계정 경로의 공개 신원·연락처·주소 표시를 확인하고 테스터 12명 이상을 확보한다. 조직 계정으로 방향을 바꿀 때만 D-U-N-S, 조직 웹사이트, 사업자 정보 일치를 준비한다.
- 2026-10-10 사용자 확정: 공개 개발자 이름 **AloeTurtle**, 공개 지원 이메일 **jjamyeong@gmail.com**. 개인 계정 신원 인증 승인 완료(사용자 보고). Android 기기 인증은 별도 확인 필요. 나머지 법적 운영자·공개 연락처·주소 및 정책 상세는 미확정이므로 개인정보처리방침·약관·Play 등록정보의 게시는 완료로 표시하지 않는다.
- D-U-N-S 기본 신청·회사 정보 갱신은 무료이며 유료 신속 처리·부가 서비스는 선택이다. 상호 변경은 먼저 사업자등록을 정정하고 D&B 프로필과 Google 결제 프로필의 법적 명칭·주소를 맞춘다. 동일 사업체의 상호 변경만으로 번호를 재발급받는다고 단정하지 않는다. [D&B 비용·갱신](https://www.dnb.com/en-us/smb/duns/get-a-duns.html), [Google 신원 정보 변경](https://support.google.com/googleplay/android-developer/answer/16260648)

### 한국 사업자·수익 신고 확인

- 현재 계획은 무료 앱의 AdMob 광고 수익이다. 조직 계정 선택 자체가 별도의 국내 영업 허가를 발생시키는 것은 아니지만, 광고 수익은 국세 신고 대상이므로 기존 사업자등록의 업종과 부가가치세·종합소득세 처리 방식을 국세청 또는 세무사와 확인한다. 기존 업종과 다르면 국세청 사업자등록 정정 절차를 사용한다. [국세청 사업자등록 정정](https://b.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7779&mi=2446), [AdMob 세금 안내](https://support.google.com/admob/answer/2772620)
- 앱을 유료로 팔거나 인앱 구매를 추가하면 한국의 전자상거래·통신판매 관련 신고와 Play의 사업자등록번호·통신판매업 신고번호 표시 요건을 별도 검토한다. 현재 광고 수익만으로 통신판매업 신고가 필요하다고 단정하지 않는다. [Google의 한국 배포 요건](https://support.google.com/googleplay/android-developer/answer/6223646), [전자상거래법의 통신판매 정의](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=009318&lsJoLnkSeq=900352868&print=print)
- 온라인 서비스가 부가통신역무에 해당하는지는 운영 형태로 판단한다. 소규모 인터넷 부가통신사업자는 신고 면제 규정이 있으므로 실제 해당 여부를 확인한다. [중앙전파관리소 FAQ](https://www.crms.go.kr/lay1/bbs/S1T123C131/A/23/view.do?article_seq=10581)

## 구현 및 검증 게이트

| 게이트 | 통과 조건 | 현재 상태 |
| --- | --- | --- |
| 빌드 설정 | Android package, APK/AAB 프로필, API 36, 서명·버전 코드 확인 | 2026-10-03 preview의 Supabase 공개 변수 등록·빌드 로드 확인. EAS 서명 키와 preview 채널 생성, versionCode 1 초기화. 첫 APK 빌드의 Kotlin 버전 충돌을 수정하고 16.0.3으로 고정해 `628b1b17-76c8-41b0-9b8a-0c2f813e76d7` FINISHED 확인, APK 1.0.0/versionCode 1 생성 완료. 테스트 204개·TypeScript 통과. 사용자 실기기 설치·홈 진입 캡처 확인 |
| 인증 | Google 로그인·취소·실패·복원·로그아웃, 계정별 기기 데이터 격리, 심사용 웹 게스트 유지 | 로컬 코드·테스트 완료. 사용자 실기기에서 Google 로그인 후 앱 홈 복귀 및 재실행 로그인 유지(사용자 보고) 및 로그아웃·동일 계정 재로그인(사용자 보고) 및 로그인 취소·재시도 확인; 실패·계정 격리·웹 검증 대기 |
| 다국어 | 모든 화면·오류·접근성 문구와 영어 재고 입력·AI 대화·레시피의 안전 검증 | 코드 감사와 ko/en 공통 모듈, 기기 언어 감지, 로그인·설정 언어 선택/저장 기본 경로를 로컬 구현. 나머지 화면·오류·서버 문구, 영어 입력과 안전 검사, 실기기 검증 대기. 세부 범위는 [다국어 감사](GOOGLE_PLAY_I18N_AUDIT.md) |
| 개인정보·약관 | 공개 URL과 앱 내 링크, 데이터 흐름·국외 처리·광고·보존·삭제 고지, 계정 삭제 앱·웹 경로 | 한·영 정책 문안 초안 작성. 공유 사본 삭제 migration은 production 적용 완료. 삭제 화면·Edge Function 배포와 실계정 삭제 검증은 대기. 운영자·지원 연락처, 실제 보존·국외 처리 세부정보 미정 |
| AI·공유 운영 | 앱 내 신고·차단, 검토와 처리 기록, 이용약관 동의 | 대기 |
| 광고 | AdMob SDK·테스트 광고, 지역별 개인정보 선택, 광고 지면, `app-ads.txt` 검증 | SDK 16.0.3(Ads Android 24.9.0, UMP 4.0.0)과 Android 전용 홈·재고·레시피 배너, UMP 동의 후 초기화, 요구될 때 설정 화면의 개인정보 선택 진입점, preview 테스트 ID·production 실제 ID 게이트를 로컬 작성. 홈 테스트 배너는 실기기 캡처로 확인. 다른 광고 지면·국가별 동의·AdMob 운영 설정·`app-ads.txt` 검증 대기 |
| Play 등록 | 언어별 등록정보·스크린샷, 광고·연령·권한·데이터 보안 신고, 심사 계정 | 대기 |
| 실기기·출시 | APK 직접 설치, Play 내부 테스트 AAB, 핵심 흐름·광고·삭제·영어 QA, 계정 경로별 공개 조건 | APK 설치·Google 로그인·재실행 세션 복원·로그아웃·동일 계정 재로그인·홈 테스트 배너 확인. 나머지 기능·Play 검증 대기 |

출시 직전 Google Play와 AdMob 정책을 다시 확인한다. Play는 앱 내·외 계정 삭제 경로와 [AI 신고 기능](https://support.google.com/googleplay/android-developer/answer/13985936)을 요구한다. 공유 레시피에는 [사용자 생성 콘텐츠 정책](https://support.google.com/googleplay/android-developer/answer/9876937)을 적용해 준비한다. AdMob의 앱별 정상 광고 공급은 앱 공개 후 [소유권 확인과 준비 심사](https://support.google.com/admob/answer/14538460)에 따라 늦어질 수 있다.

## 첫 실기기 APK — 2026-10-03

- [APK 다운로드](https://expo.dev/artifacts/eas/kY31zbq5nuPoBKdVXwQFeIs-nHM1iog4XlSr5-jQvd4.apk) · [EAS 빌드 상세](https://expo.dev/accounts/myunggeon685/projects/naengtalk/builds/628b1b17-76c8-41b0-9b8a-0c2f813e76d7)
- preview 환경, `com.naengtalk.app`, 버전 1.0.0/versionCode 1. EAS FINISHED 상태 확인. Google 공식 테스트 광고 ID 사용.
- 최초 빌드 `3af7f13e-892d-4a64-881f-e19d47f3224d`는 Ads SDK 25.4.0의 Kotlin 메타데이터 2.3과 Expo SDK 55의 Kotlin 2.1 컴파일러 충돌로 실패했다. 광고 라이브러리 16.0.3(Ads 24.9.0/UMP 4.0.0)으로 고정한 재빌드는 성공했다.
- 사용자 실기기에서 Google 계정 선택 후 localhost 오류를 보고했다. URL Configuration의 앱 복귀 주소 등록을 안내한 뒤 사용자가 앱 홈 진입 성공을 보고했으며, 캡처에서 홈 테스트 광고도 확인했다. 실제 저장된 대시보드 설정 변경 내용은 별도 확인하지 않았다. 재실행 후 로그인 유지도 사용자 보고로 확인했다. 로그아웃·동일 계정 재로그인은 사용자 보고로 확인했다. 로그인 취소·실패, 계정 격리, 재고·AI·삭제 및 다른 광고 지면 검증은 남아 있다.

## 재고 검수 수정 — 2026-10-03

- 사용자 실기기 보고로 한국어 날짜 직접 등록 및 재실행 재고 저장 유지 확인. ISO 날짜 입력의 추정일 대체, 날짜 키패드의 하이픈 불가, 키보드 가림은 수정 대상으로 기록했다.
- 기존 APK의 Android preview/runtime 1.0.0에 EAS Update 게시: 그룹 `128810a7-04a7-4c69-a873-4bf5c4889ec6`, 업데이트 `01a10160-8307-7588-9e4c-34a9fa39cb3b`. 검수 모달 전체 스크롤·키보드 회피와 날짜 입력 개선 포함. Android 번들 내보내기·게시 성공.
- inventory-parse v9 배포 및 ACTIVE/verify_jwt=true 확인. 원문 명시 ISO·한국어 날짜를 검증해 추정일보다 우선하고 여러 품목 날짜 혼합을 방지한다. 실제 원격 모델 응답은 확보하지 않아 이번 원격 누락의 세부 원인은 확정하지 않는다.
- 210개 테스트·TypeScript 통과. 새 업데이트에서 키보드 가림 해소와 날짜 보존은 사용자 재검증 대기.

## 달력 날짜 선택 APK — 2026-10-03

- 사용자 재검증: 명시한 10월 10일은 서버 응답에 보존됨. 기존 APK의 키보드 가림·8자리 입력 개선은 사용자 기기에서 확인되지 않아 해결 완료로 기록하지 않는다.
- 사용자가 새 APK 빌드를 승인해 Android 공용 검수 날짜를 기본 달력으로 교체했다. 확인/취소·오늘 이전 제한·시간대에 안전한 로컬 날짜 변환을 적용하고 설정에 앱 버전을 표시한다.
- EAS preview 빌드 `fd56840d-0072-40d7-a77b-46524686b566` FINISHED: 앱 버전 1.0.1, versionCode 2, 기존 서명 키. 212개 테스트·TypeScript·태평양 시간대 날짜 테스트·웹 export 통과. 실기기 달력 검증 대기.
- [APK 1.0.1 다운로드](https://expo.dev/artifacts/eas/ZyCZQtVe2jewMAgxdAc2Q5sEaKYO7zL-eHLG5mNwMS4.apk). 기존 앱을 삭제하지 않고 업데이트 설치한 뒤 설정의 앱 버전 1.0.1, 검수 날짜의 달력 열기·확인·취소 및 재고 등록을 확인한다.

## 검수 팝업 떨림 수정 APK — 2026-10-03

- 사용자 실기기 보고로 APK 1.0.1의 달력 선택·재고 등록 성공을 확인했다. 직접 입력 분석 후 검수창이 반복적으로 위치를 바꾸는 영상이 제공되어 출시 전 해결이 필요하다.
- 공용 검수 팝업을 확대·축소·중앙 정렬 화면 밖으로 이동한 APK 1.0.2/versionCode 3 빌드 `60aa9e7b-a836-487e-b827-d1ea2be6afc6` FINISHED. 212개 테스트·TypeScript·웹 export 통과. 사용자 실기기 보고로 떨림 해결·달력 선택·재고 등록 정상 동작 확인 완료. 구매내역 이미지 분석 전체 흐름은 별도 검증한다.
- [APK 1.0.2 다운로드](https://expo.dev/artifacts/eas/keAPEaLBqb3mKF0tjq5YdAyNPLX_ykRRiaKWBnXsXsc.apk). 기존 앱 위에 업데이트 설치하고 설정 버전 1.0.2 확인 후 직접 입력 분석→검수창 대기·수량 편집·달력·등록을 확인한다.

## 구매내역 이미지 읽기 업데이트 — 2026-10-03

- 예시 4 분석 시 raw Network request failed 캡처를 받아, 네이티브 이미지 읽기를 fetch에서 Asset.downloadAsync/localUri 및 File.base64로 분리했다. 웹은 기존 이미지 읽기 유지. 214개 테스트·TypeScript·Android/웹 번들 통과.
- 기존 APK 1.0.2 빌드 로그의 expo-file-system 55.0.26 포함을 확인해 동일 모듈을 사용하는 호환 Android preview 업데이트를 게시했다. 그룹 `eb30cd3a-1a91-44bf-9127-c5f09a422b84`, update `01a101ce-13d7-73ee-8e1d-2c83f893ec16`, runtime 1.0.2. 실제 업데이트 endpoint 응답에서 해당 update 제공을 확인했다.
- 사용자 기기 다운로드·적용은 미확인. 온라인으로 앱을 열어 다운로드 시간을 준 뒤 완전 종료·재실행하고 설정의 `이미지 수정 1` 표시를 확인한다. 그 다음 예시 4 분석·검수·등록을 재검증한다. 표시가 없으면 적용 완료로 간주하지 않는다.
- 이후 사용자가 대기·종료·재실행 후에도 표시가 없다고 보고했다. OTA 적용 문제의 기기 측 원인은 미확정이다. 이미지 읽기 수정이 직접 포함된 APK 1.0.3/versionCode 4 빌드 `567d039b-5e90-414c-9eff-71ba6bad8f98`는 업데이트 승인 안내를 함께 포함하기 위해 취소했다.

## 업데이트 안내 포함 APK — 2026-10-03

- 다운로드 전 `나중에 / 업데이트`, 실제 다운로드 진행률·로딩, 완료 후 `지금 다시 시작 / 나중에`와 설정의 `앱 업데이트 확인`을 구현했다. 기본 자동 다운로드를 끄는 네이티브 설정은 새 APK 설치가 필요하다.
- APK 1.0.3/versionCode 5 빌드 `7e42c1e5-5ebc-4ef3-86bf-14a6f6df2d92` FINISHED. 같은 패키지·서명 키·preview 환경, runtime 1.0.3을 사용한다. 이미지 읽기 수정도 포함했다. [APK 1.0.3 다운로드](https://expo.dev/artifacts/eas/Q5RjfzVzN734itxmao0oI46Erlh-BnzP-JDAkShmFao.apk).
- 218개 테스트·TypeScript·웹 export 통과 및 코드 리뷰 완료. 실기기 업데이트 안내·진행·적용과 예시 4 분석 검증은 대기다.
- 새 APK의 설정에는 `업데이트 안내 1`이 포함된다. preview Android runtime 1.0.3 검증 업데이트 그룹 `239540aa-d541-443c-b494-22d38731818e`를 게시하고 실제 endpoint에서 제공 확인했다. 승인·다운로드·재시작 후 `업데이트 안내 2` 표시로 적용을 구분한다. 이 검증 업데이트는 기존 APK 1.0.2와 runtime이 다르다.
- 사용자 실기기 APK 1.0.3 설치 성공 확인. 업데이트 안내·진행률은 확인하지 못해 다음 업데이트 때 검증한다. 설치 성공과 OTA 수신·다운로드·적용 확인은 구분한다. 예시 4 분석·검수·등록 재검증은 대기다.
- 이후 사용자 보고로 APK 1.0.3 예시 4 분석·검수·등록 정상 동작 확인. 해당 이미지 읽기 오류의 증상 해소는 확인 완료. 사진 보관함 등 다른 입력과 업데이트 안내·진행률은 별도 검증한다.

## 사진 비교·재고 수정 삭제 업데이트 — 2026-10-03

- 사용자 실기기에서 실제 사진 분석·등록 성공 확인 후 사진 썸네일/X 선택 해제, 사진별 원본과 결과 비교·확대, 재고 DB 수정·삭제를 구현했다.
- 230개 테스트·TypeScript·Android/웹 번들 통과. 기존 APK 1.0.3용 preview Android 업데이트 그룹 `9a8eb892-4606-44ff-8b42-53e491f61d77`, update `01a10232-dded-7a3f-846b-130cb766379c` 게시 완료. 새로운 네이티브 모듈이나 DB migration은 추가하지 않았다.
- 설정의 앱 업데이트 확인에서 다운로드·재시작한 뒤 `사진·재고 관리 1` 표시를 확인한다. 썸네일/X, 사진별 검수·확대, DB 수정·삭제 및 앱 재실행 후 유지 검증은 실기기 대기다. 앱 버전/runtime은 1.0.3을 유지한다.
- 이후 사용자 보고로 위 사진·재고 관리 사항의 정상 동작을 확인했다. 업데이트 진행률 등 개별 항목의 별도 보고는 없다.

## 홈 화면 너비·손잡이 정렬 수정 — 2026-10-03

- 카드 전체 폭 안에서 손잡이를 중앙 정렬하고 네이티브 화면을 안전 영역 너비·실제 높이에 맞춘다. 짧은 Android 화면은 홈 본문 스크롤을 허용한다.
- 232개 테스트·TypeScript·Android/웹 번들 통과. 1.0.3 preview Android 업데이트 그룹 `d378c3a3-ccf7-4632-9f2f-d2e03d924f9a` 게시 및 실제 응답에서 제공 확인. 실기기 화면 검증은 대기. 적용 표시는 설정의 `화면 맞춤 1`이다.
- 2026-10-04 사용자 보고로 홈 화면 수정 실기기 확인 완료.

## 채팅 키보드·재고 카드·광고 위치 — 2026-10-04

- 채팅 키보드 위 입력창·전송, 간결한 2행 재고 카드, 상단바 아래 광고를 기존 APK 1.0.3의 preview 업데이트로 제공한다. 새 APK 설치는 필요하지 않다.
- 236개 테스트·TypeScript·Android/웹 번들 통과. 업데이트 그룹 `ef61ed8d-4a6c-427c-8ed6-8db722560ea9`, update `01a10253-088a-75e7-b65e-14a501307f7b` 게시 완료. 설정의 `채팅·카드 정리 1`을 확인한 뒤 입력·전송·키보드 닫기, 카드 높이·버튼·광고 위치를 실기기 검증한다.
- 사용자 업데이트 적용 확인 후 남은 키보드 가림 캡처에 따라 Android 좌표 원점을 상단 안전 영역으로 보정했다. 입력 예시와 함께 `입력 위치 보정 2` 업데이트 게시: 그룹 `ded3fd31-38c4-4523-a2d3-b44555f46212`, update `01a1025e-6676-7af1-a757-cfe1c0f5f748`. 238개 테스트·TypeScript·Android 번들 통과. 기존 APK 1.0.3에서 업데이트 가능하며 가림 해소는 실기기 확인 대기.
- 후속 사용자 보고로 채팅 입력 위치 보정의 실기기 증상 해소 확인. 다음은 메뉴 상담·레시피 상세·사용량 확정·DB 차감·재실행 유지 검증이다. 관련 기존 테스트 13개 통과, 실기기 결과 대기.
