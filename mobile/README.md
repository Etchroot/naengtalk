# 냉톡 Expo 앱

이 디렉터리는 냉톡의 Android·웹 공용 Expo 클라이언트입니다. 제품 전체 설명과 현재 구현 상태는 상위 [`README.md`](../README.md), 화면·버튼 흐름은 [`docs/USER_FLOW.md`](../docs/USER_FLOW.md)를 참고합니다.

## 환경 준비

- Node.js
- pnpm
- 실제 Supabase 연결 시 `mobile/.env.local`

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
```

클라이언트에는 publishable/anon key만 둡니다. OpenAI API key와 Supabase service role key는 앱 환경변수에 넣지 않습니다.

## 실행

```bash
pnpm install
pnpm web
pnpm android
```

Supabase 공개 환경값이 없으면 일부 원격 기능 대신 로컬 검증 경로가 사용됩니다. Android 실행에는 에뮬레이터 또는 USB 디버깅이 허용된 기기가 필요합니다.

## 검증

저장소 루트에서 전체 테스트를 실행하고, 이 디렉터리에서 타입과 Expo 의존성을 확인합니다.

```bash
# 저장소 루트
npm test

# mobile/
pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters
pnpm exec expo install --check
pnpm exec expo export --platform web
```

## 주요 구조

```text
src/app/                Expo Router 진입점
src/domain/             재고·OCR·레시피 관련 순수 도메인 로직
src/features/           화면, 모달, 상태 조합
src/services/           Supabase·세션·플랫폼 adapter
assets/                 앱 아이콘·글꼴·심사용 샘플
```

웹 production은 [https://naengtalk.expo.app](https://naengtalk.expo.app)에서 확인할 수 있습니다. Android APK는 별도 EAS 내부 배포 단계가 남아 있습니다.
