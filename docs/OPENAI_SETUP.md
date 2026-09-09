# OpenAI API 배포 설정

냉톡의 OpenAI 키는 Expo 앱이나 GitHub 저장소에 넣지 않고 **Supabase Edge Function secret**으로만 등록한다.

## 현재 완료된 항목

- OpenAI API 프로젝트 키 발급: 사용자 완료
- OpenAI 월 사용 한도 `$20`: 사용자 완료
- 클라이언트 → 인증된 `menu-chat` Edge Function 호출 코드: 구현 완료
- Luna 의도 분류, Terra 레시피 생성, 만개의레시피 우선 웹 검색: 구현 완료
- 사용자별 하루 30회 서버 제한: migration 작성 완료

## 사용자가 한 번만 할 작업

1. Supabase Dashboard에서 `naengtalk` 프로젝트를 연다.
2. 왼쪽의 **Edge Functions**로 이동해 **Secrets** 또는 **Manage secrets**를 연다.
3. 이름에 `OPENAI_API_KEY`, 값에 발급한 OpenAI API 키를 입력하고 저장한다.
4. 키를 채팅, 문서, `.env` 또는 GitHub에 붙여넣지 않는다.

Supabase 문서 기준으로 secret은 저장 즉시 함수에서 사용할 수 있어 secret 변경만으로는 재배포가 필요하지 않다.

## 함수 배포

저장소 루트에서 Supabase CLI 인증 후 다음을 실행한다.

```bash
pnpm dlx supabase@latest login
pnpm dlx supabase@latest functions deploy menu-chat --project-ref ygdbvbjvnnoxyjeidnnj --use-api
```

GitHub 연동은 DB migration을 production branch에 적용하지만 Edge Function 배포 여부는 별도로 확인한다. Dashboard의 **Edge Functions** 목록에 `menu-chat`이 보이고 상태가 배포됨이어야 한다.

## 최소 실환경 확인

1. 웹 앱에서 새 게스트로 로그인한다.
2. 채팅에 `20분 안에 두부로 얼큰한 메뉴 만들어줘`를 입력한다.
3. AI 답변과 레시피 전체 보기가 나타나는지 확인한다.
4. 출처가 열리고, 재료·단계·타이머가 표시되는지 확인한다.
5. `요리 완료` → 사용량 확정 후 두부 등 실제 재고가 한 번만 차감되는지 확인한다.
6. 같은 완료 요청을 재시도해도 중복 차감되지 않는지 확인한다.

실제 OpenAI 호출을 포함한 이 확인은 비용이 발생하므로 API 배포 후 한 번만 수행하고, 전체 E2E는 웹 배포와 APK 빌드 직전에 수행한다.

## 비용·남용 방지 기준

- 예상 사용량: 10명 × 하루 3회 × 7일 = 210회
- 앱 서버 제한: 사용자별 하루 30회
- OpenAI 요청은 `store: false`
- 최근 대화는 최대 6개, 각 메시지는 최대 500자
- Luna 출력 최대 500토큰, Terra 출력 최대 1,800토큰
- 레시피 검색은 최초 `10000recipe.com` 제한 검색 1회, 근거 실패 시 일반 웹 검색 1회만 재시도
- OpenAI 계정 월 사용 한도: `$20`

2026-09-09 공식 가격을 기준으로 210회 사용은 대략 `$7~15` 범위로 예상한다. 실제 비용은 입력 길이, Terra 호출 비율, 웹 검색 재시도 횟수에 따라 달라지며 배포 후 OpenAI Usage에서 확인한다.

## 공식 참고 문서

- OpenAI 가격: https://developers.openai.com/api/docs/pricing
- OpenAI Responses API: https://developers.openai.com/api/reference/cli/resources/responses/methods/create
- OpenAI 웹 검색: https://developers.openai.com/api/docs/guides/tools-web-search
- Supabase Edge Function secret: https://supabase.com/docs/guides/functions/secrets
- Supabase Edge Function 배포: https://supabase.com/docs/guides/functions/deploy
