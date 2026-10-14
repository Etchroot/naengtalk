/* Browser and Node-compatible, dependency-free monthly forecast. No billing connections. */
(function (root) {
  'use strict';
  const fields = [];
  const defaults = {};
  function field(group, key, label, value, unit, help, max = 1000000, step = 1) {
    fields.push({ group, key, label, unit, help, min: 0, max, step });
    defaults[key] = value;
  }
  field('audience', 'mau', '월 활성 사용자', 1000, '명', '해당 월에 실제로 사용하는 사용자 수. 가입자 누적 수가 아닙니다.', 10000000);
  field('audience', 'activeDays', '1인당 월 사용 일수', 12, '일/월', '광고 계산에만 적용. 아래 기능 사용량은 이미 월 기준입니다.', 31);
  field('audience', 'androidPct', 'Android 사용자 비율', 100, '%', '웹에는 배너가 없습니다. AI 비용은 모든 플랫폼 사용자에게 적용됩니다.', 100);
  field('audience', 'fx', '달러 환산 환율', 1400, '원/USD', '예시 환율입니다. 실시간 시세나 카드 환전 수수료를 가져오지 않습니다.', 10000);
  field('ads', 'testAds', '테스트 광고 모드', 0, '0=출시 예상 · 1=테스트', '현재 preview APK는 테스트 광고입니다. 1이면 수익은 항상 0입니다.', 1);
  field('ads', 'adSessions', '광고 화면 체류 구간', 2, '구간/사용일', '홈·재고·완료 레시피의 연속 체류 구간. 탭 이동마다 새 유료 노출을 보장하지 않습니다.', 100, 0.1);
  field('ads', 'visibleSeconds', '구간당 배너 표시 시간', 45, '초', '실제로 배너가 보이는 시간만 입력. 키보드·팝업·광고 없는 화면 시간 제외.', 3600);
  field('ads', 'refreshEnabled', '배너 새로고침 가정', 1, '0=끔 · 1=켬', 'AdMob 실제 설정을 읽지 않습니다. Google 최적화 주기는 고정값이 아닙니다.', 1);
  field('ads', 'refreshSeconds', '새 광고 요청 주기', 60, '초', '사용자 지정 AdMob 주기는 30~150초. 모델상 가정이며 앱 설정을 변경하지 않습니다.', 150);
  field('ads', 'requestAllowedPct', '광고 요청 가능 비율', 90, '%', '개인정보 선택·SDK 준비·서비스 제한 등을 반영. 동의 거절이 항상 광고 불가라는 의미는 아닙니다.', 100);
  field('ads', 'matchPct', '광고 매칭률', 90, '%', '요청 중 광고를 받아오는 비율.', 100);
  field('ads', 'showPct', '받은 광고의 실제 표시율', 95, '%', '매칭된 광고 중 실제 노출로 기록될 비율.', 100);
  field('ads', 'ecpm', '배너 eCPM', 1, 'USD/1,000노출', '임의의 시뮬레이션 값. 한국 평균이나 보장 단가가 아닙니다. 실제 AdMob eCPM으로 교체하세요.', 1000, 0.05);
  for (const [key, label, value, unit, help] of [
    ['ocrPerUser', '사진 OCR 분석', 4, '장/인·월', '사진마다 Luna 1회. 이미지 토큰과 소진일 조회는 별도 비용입니다.'],
    ['textPerUser', '재고 직접 텍스트 분석', 2, '회/인·월', 'Luna 파싱 1회와 소진일 조회. 채팅에서 추가한 건은 아래 별도 입력합니다.'],
    ['menuPerUser', '메뉴 추천·다시 추천', 8, '회/인·월', 'Luna 분류 + Terra 개인화/생성. 기존 레시피를 찾아도 Terra를 사용합니다.'],
    ['chatPerUser', '기타 상담·채팅 재고 변경', 5, '회/인·월', '인사·재고 질문·소비/수량 변경은 Luna 분류 1회. 메뉴 추천과 채팅 추가는 제외.'],
    ['chatAddPerUser', '채팅으로 재고 추가', 1, '회/인·월', 'Luna 분류 + Luna 재고 파싱 = 2회, 소진일 조회도 포함.'],
    ['manualPerUser', '직접 재고 수정·삭제', 8, '회/인·월', 'AI 0회. DB 저장·조회와 서버 자원에만 영향.'],
    ['cookingPerUser', '요리 완료·재고 차감', 4, '회/인·월', 'AI 0회. 완료 RPC와 DB 재고 갱신.'],
    ['sharePerUser', '레시피 공유', 1, '회/인·월', 'AI 0회. DB RPC.'],
    ['readPerUser', '목록 조회 등 기타 DB 작업', 40, '회/인·월', '각 기능 뒤 재조회와 별개인 기타 작업의 부하 가정. 요청당 DB 요금은 따로 붙지 않습니다.'],
    ['deletePerUser', '계정 삭제', 0, '회/인·월', 'AI 0회. delete-account Edge 호출 추정.'],
    ['retryPct', '사용자 재시도 추가 비율', 5, '%', '이미 청구된 분석 뒤 재시도한 횟수의 추가분. 코드의 자동 HTTP 재시도를 의미하지 않습니다.'],
    ['catalogPct', '기존 레시피 후보 선택 비율', 60, '%', '이 비율은 Terra 개인화와 새 생성의 토큰 구성을 바꿉니다. AI 무료 비율이 아닙니다.'],
    ['repairPct', '레시피 검증 후 재작성률', 10, '%', '최초 Terra 뒤 최대 1회 추가. 네트워크 재시도와 별개.'],
    ['uniqueItems', '분석 1회당 소진일 조회 품목', 3, '종류', '사진·직접 입력·채팅 추가에 공통 적용하는 평균 조합 수. 3종씩 조회. 소수는 인접 정수 개수의 혼합 가정. 명시 날짜가 있어도 조회합니다.'],
    ['shelfCachePct', '소진일 캐시·사전 정보 적중률', 90, '%', '세 등록 방식의 공통 가정. 품목별 적중이 독립이라고 가정해 묶음 호출 기대값 계산. 적중은 추가 AI·검색 0회. 토큰 입력 캐시와 다름.'],
    ['unverifiedPct', '검색 후 미확인 비율', 20, '%', '캐시 누락 중 웹 검색으로 확인되지 않아 Terra 추정이 추가되는 비율.'],
    ['searchTools', '검색 요청당 웹 검색 도구 호출', 1, '회', '코드상 최대 3회. 실제 계측 없음. 모델 토큰 비용과 별도로 청구.'],
  ]) field('usage', key, label, value, unit, help, key.endsWith('Pct') ? 100 : key === 'searchTools' ? 3 : key === 'uniqueItems' ? 50 : 10000, 0.1);
  const tokenPairs = [
    ['ocr', '사진 OCR (이미지 포함)', 2500, 600],
    ['parse', '텍스트 재고 파싱', 1000, 400],
    ['classify', '메뉴·채팅 의도 분류', 1800, 200],
    ['personalize', '기존 레시피 개인화', 3500, 1000],
    ['generate', '새 레시피 생성', 3000, 1100],
    ['repair', '레시피 재작성', 4000, 1100],
    ['search', '소진일 검색 프롬프트', 1500, 600],
    ['estimate', '소진일 추정', 1500, 500],
  ];
  for (const [key, label, input, output] of tokenPairs) {
    field('tokens', key + 'Input', label + ' · 입력', input, '토큰/호출', '실측 미연동 가정값. 이미지·재고·대화 길이에 따라 변합니다.', 272000, 100);
    field('tokens', key + 'Output', label + ' · 출력', output, '토큰/호출', '한도값이 아닌 평균 청구 토큰. 추론 토큰도 포함해 입력하세요.', 100000, 100);
  }
  field('tokens', 'searchContentTokens', '검색 도구당 가져온 검색 내용', 2000, '입력 토큰/도구호출', '검색 프롬프트 입력과 별도로 더할 가정. 이미 총 입력에 포함했다면 0으로 설정.', 272000, 100);
  field('prices', 'lunaInputPrice', 'Luna 일반 입력 단가', 0.2, 'USD/100만 토큰', 'GPT-5.6 Luna 공식 단가, 2026-10-11 확인.', 1000, 0.01);
  field('prices', 'lunaCachedPrice', 'Luna 캐시 읽기 단가', 0.02, 'USD/100만 토큰', 'API 프롬프트 캐시 읽기. 소진일 DB 캐시와 다릅니다.', 1000, 0.01);
  field('prices', 'lunaOutputPrice', 'Luna 출력 단가', 1.2, 'USD/100만 토큰', '표준 API 단가. ChatGPT 구독과 별개.', 1000, 0.01);
  field('prices', 'terraInputPrice', 'Terra 일반 입력 단가', 2, 'USD/100만 토큰', 'GPT-5.6 Terra 공식 단가, 2026-10-11 확인.', 1000, 0.01);
  field('prices', 'terraCachedPrice', 'Terra 캐시 읽기 단가', 0.2, 'USD/100만 토큰', 'API 프롬프트 캐시 읽기 단가.', 1000, 0.01);
  field('prices', 'terraOutputPrice', 'Terra 출력 단가', 12, 'USD/100만 토큰', '표준 API 단가. 출력에는 청구되는 추론 토큰도 포함.', 1000, 0.01);
  field('prices', 'inputCachedPct', '입력 토큰 캐시 읽기 비율', 0, '%', '현재 trace는 캐시 상세를 측정하지 않습니다. 할인은 기본 0으로 가정.', 100);
  field('prices', 'inputCacheWritePct', '입력 토큰 캐시 쓰기 비율', 0, '%', '공식 캐시 쓰기 단가는 일반 입력의 1.25배. 읽기와 합계 100% 이하.', 100);
  field('prices', 'searchToolPrice', '웹 검색 도구 호출 단가', 10, 'USD/1,000호출', 'OpenAI web search: 도구 비용 + 검색 내용 입력 토큰. 메뉴 레시피에는 검색 도구 없음.', 1000, 0.1);
  field('infrastructure', 'supabaseBase', 'Supabase 기본 월 요금', 25, 'USD/월', 'Pro 시작 요금 예시. 실제 계정 요금제 확인 후 수정. Free는 0 입력; 한도 초과 시 자동 유료 확대를 가정하지 마세요.', 10000, 1);
  field('infrastructure', 'computeExtra', '추가 DB compute', 0, 'USD/월', '기본 요금과 크레딧에 이미 포함된 compute는 중복 입력하지 않습니다.', 10000, 1);
  field('infrastructure', 'edgeIncluded', 'Edge 포함 호출', 2000000, '회/월', 'Pro 200만. Free는 50만, 초과 유료 지원 여부는 요금제 확인.', 100000000);
  field('infrastructure', 'edgePrice', 'Edge 초과 단가', 2, 'USD/100만 호출', 'Pro/Team 초과 사용 단가.', 10000, 0.1);
  field('infrastructure', 'extraEdge', '기타 Edge 호출', 0, '회/월', '백그라운드·다른 프로젝트의 호출. 중복되는 분석 호출은 제외.', 100000000);
  field('infrastructure', 'authIncluded', 'Auth 포함 MAU', 100000, '명', 'Pro 10만. Free는 5만; 현재 요금제 기준으로 수정.', 100000000);
  field('infrastructure', 'authPrice', 'Auth 초과 단가', 0.00325, 'USD/명', 'Pro의 포함 MAU 초과분. 인증 가능한 전체 사용자를 대상으로 계산.', 10, 0.00025);
  field('infrastructure', 'egressKb', '사용자 작업당 전송량', 20, 'KB/작업', '응답·DB 전송량 가정. 구매 원본 사진의 업로드는 인바운드라 이 값에 넣지 않습니다.', 100000, 1);
  field('infrastructure', 'extraEgress', '기타 전송량', 0, 'GB/월', '다른 프로젝트·파일 다운로드 등. 아래 포함량과 같은 GB 기준을 사용.', 100000, 0.1);
  field('infrastructure', 'egressIncluded', '전송량 포함', 250, 'GB/월', 'Pro 일반 egress 250GB 예시. 캐시 전송은 요금이 다를 수 있음.', 100000);
  field('infrastructure', 'egressPrice', '전송량 초과 단가', 0.09, 'USD/GB', 'Supabase 일반 egress 단가. 실제 청구 내역과 비교하세요.', 100, 0.01);
  field('infrastructure', 'dbGb', 'DB 저장 공간', 1, 'GB', '사용자·재고·레시피·관측 로그의 합계. 월 말 용량 가정이며 사용자 수에 자동 비례하지 않습니다.', 100000, 0.1);
  field('infrastructure', 'dbIncluded', 'DB 포함 용량', 8, 'GB', 'Pro 프로젝트 1개 예시.', 100000, 0.1);
  field('infrastructure', 'dbPrice', 'DB 초과 단가', 0.125, 'USD/GB·월', '프로젝트별 DB disk 초과분.', 100, 0.001);
  field('infrastructure', 'storageGb', '파일 Storage 저장량', 0, 'GB', '현재 OCR 원본은 영구 저장하지 않으므로 기본 0. 다른 파일을 저장하면 입력.', 100000, 0.1);
  field('infrastructure', 'storageIncluded', 'Storage 포함 용량', 100, 'GB', 'Pro 100GB 예시.', 100000);
  field('infrastructure', 'storagePrice', 'Storage 초과 단가', 0.021, 'USD/GB·월', '파일 보관 요금. 원본 OCR 사진 비용을 기본으로 중복 부과하지 않습니다.', 100, 0.001);
  field('infrastructure', 'realtimeMessages', 'Realtime 메시지 수', 0, '회/월', '현재 이 경로에서 필수 사용하지 않음. 다른 기능에서 사용하는 경우 입력.', 100000000);
  field('infrastructure', 'realtimeIncluded', 'Realtime 포함 메시지', 5000000, '회/월', 'Pro 500만 예시.', 100000000);
  field('infrastructure', 'realtimePrice', 'Realtime 초과 단가', 2.5, 'USD/100만 메시지', 'Peak 연결·기타 add-on은 별도 비용에 추가.', 1000, 0.1);
  field('infrastructure', 'hosting', '웹·EAS Hosting 월 비용', 0, 'USD/월', '실제 플랜 금액 입력. 현재 기본 0은 비용이 항상 없다는 뜻이 아닙니다.', 10000, 1);
  field('infrastructure', 'easFixed', 'EAS Build·Update 기본 요금', 0, 'USD/월', '월 구독료. Pro/ChatGPT API 비용과 중복하지 않도록 실제 청구서 기준 입력.', 10000, 1);
  field('infrastructure', 'builds', '추가 유료 빌드 수', 0, '회/월', '포함 크레딧 밖에서 유료인 빌드만 입력.', 1000);
  field('infrastructure', 'buildPrice', '추가 빌드당 비용', 0, 'USD/빌드', '계정·리소스별 실제 EAS 단가 입력. 무료 빌드는 0.', 1000, 0.1);
  field('infrastructure', 'updateExtra', 'OTA 전송·호스팅 초과', 0, 'USD/월', '현재 요금제의 Update MAU·전송량 초과 등을 직접 입력.', 10000, 1);
  field('infrastructure', 'miscFixed', '도메인·운영·기타 고정 비용', 0, 'USD/월', '도메인 연간 비용은 12로 나누기. 결제·세금·인건비를 포함하고 싶으면 여기 입력.', 100000, 1);
  field('infrastructure', 'miscPerUser', '기타 사용자당 변동 비용', 0, 'USD/인·월', '추가 서비스·결제 수수료 등 모델 밖에서 발생하는 비용.', 1000, 0.01);
  field('infrastructure', 'aiBudget', 'AI 월 예산 경고선', 20, 'USD/월', '계산기 경고용. 서버 호출 제한이나 결제를 실제로 차단하지 않습니다.', 100000, 1);

  const fraction = (x) => x / 100;
  function normalize(input) {
    return Object.fromEntries(fields.map(f => {
      const raw = Number(input?.[f.key] ?? defaults[f.key]);
      return [f.key, Math.max(f.min, Math.min(f.max, Number.isFinite(raw) ? raw : defaults[f.key]))];
    }));
  }
  // Exact expectation of ceil(cache misses / 3), per request; never batch unrelated users together.
  function integerBatches(n, p) {
    if (p <= 0 || n <= 0) return 0;
    if (p >= 1) return Math.ceil(n / 3);
    const probabilities = new Array(n + 1).fill(0);
    probabilities[0] = 1;
    for (let trial = 1; trial <= n; trial++) {
      for (let k = trial; k >= 0; k--) {
        probabilities[k] = probabilities[k] * (1 - p) + (k ? probabilities[k - 1] * p : 0);
      }
    }
    return probabilities.reduce((sum, prob, k) => sum + Math.ceil(k / 3) * prob, 0);
  }
  function expectedBatches(n, p) {
    const lower = Math.floor(n), tail = n - lower;
    return integerBatches(lower, p) * (1 - tail) + integerBatches(lower + 1, p) * tail;
  }
  function core(input) {
    const s = normalize(input), warnings = [], rows = [];
    const read = fraction(s.inputCachedPct), write = Math.min(fraction(s.inputCacheWritePct), 1 - read);
    if (s.inputCachedPct + s.inputCacheWritePct > 100) warnings.push('토큰 캐시 읽기·쓰기 합계가 100%를 넘어 쓰기 비율을 남은 범위로 제한했습니다.');
    if (s.refreshEnabled && s.refreshSeconds < 30) warnings.push('AdMob 사용자 지정 주기는 30~150초입니다. 계산은 최소 30초로 제한했습니다.');
    const modelCost = (kind, inputTokens, outputTokens) => {
      const normal = s[kind + 'InputPrice'], cached = s[kind + 'CachedPrice'];
      return (inputTokens * ((1 - read - write) * normal + read * cached + write * normal * 1.25) + outputTokens * s[kind + 'OutputPrice']) / 1e6;
    };
    const call = (kind, feature) => modelCost(kind, s[feature + 'Input'], s[feature + 'Output']);
    const repeat = 1 + fraction(s.retryPct);
    const volume = key => s.mau * s[key] * repeat;
    const ocr = volume('ocrPerUser'), text = volume('textPerUser'), menus = volume('menuPerUser'), chat = volume('chatPerUser'), add = volume('chatAddPerUser');
    const row = (label, count, unit, unitCost, note) => rows.push({ label, volume: count, unit, unitCost, cost: count * unitCost, note });
    row('사진 OCR 분석', ocr, '장', call('luna', 'ocr'), 'Luna 1회/장 · 소진일 조회는 아래 별도');
    row('직접 텍스트 파싱', text, '회', call('luna', 'parse'), 'Luna 1회 · 소진일 조회 별도');
    const catalog = fraction(s.catalogPct), repair = fraction(s.repairPct);
    const recipeUnit = call('luna', 'classify') + catalog * call('terra', 'personalize') + (1 - catalog) * call('terra', 'generate') + repair * call('terra', 'repair');
    row('메뉴 추천·레시피 제작', menus, '회', recipeUnit, 'Luna + Terra 1회 · 검증 실패 시 Terra 최대 1회 추가');
    row('기타 상담·채팅 변경', chat, '회', call('luna', 'classify'), 'Luna 분류 · 소비/수량 확정은 DB');
    row('채팅 재고 추가 파싱', add, '회', call('luna', 'classify') + call('luna', 'parse'), 'Luna 2회 · 소진일 조회 별도');
    const analyses = ocr + text + add, miss = 1 - fraction(s.shelfCachePct);
    const searchRequests = analyses * expectedBatches(s.uniqueItems, miss);
    const estimateRequests = analyses * expectedBatches(s.uniqueItems, miss * fraction(s.unverifiedPct));
    const searchCalls = searchRequests * s.searchTools;
    const searchModelUnit = modelCost('terra', s.searchInput, s.searchOutput) + s.searchTools * s.searchContentTokens * s.terraInputPrice / 1e6;
    row('소진일 웹 검색 · 모델', searchRequests, '묶음', searchModelUnit, '분석별 미적중 3종씩 · 검색 내용은 일반 입력 단가');
    row('소진일 웹 검색 · 도구', searchCalls, '호출', s.searchToolPrice / 1000, '검색 모델 토큰과 별도 청구 · 요청당 최대 3회');
    row('소진일 추가 추정', estimateRequests, '묶음', call('terra', 'estimate'), '검색으로 미확인된 품목 3종씩');
    const shelfUnit = expectedBatches(s.uniqueItems, miss) * (searchModelUnit + s.searchTools * s.searchToolPrice / 1000) + expectedBatches(s.uniqueItems, miss * fraction(s.unverifiedPct)) * call('terra', 'estimate');
    const featureCosts = rows.slice(0, 5).map((r, i) => ({ label: r.label, unitCost: r.unitCost + ([0, 1, 4].includes(i) ? shelfUnit : 0), volume: r.volume }));
    const aiCost = rows.reduce((sum, r) => sum + r.cost, 0);
    const aiCalls = ocr + text + menus * (2 + repair) + chat + add * 2 + searchRequests + estimateRequests;
    for (const [key, label, note] of [
      ['manualPerUser', '직접 재고 수정·삭제', 'AI 비용 0 · DB compute/전송/용량에 반영'],
      ['cookingPerUser', '요리 완료·차감', 'AI 비용 0 · DB RPC'],
      ['sharePerUser', '레시피 공유', 'AI 비용 0 · DB RPC'],
      ['readPerUser', '목록 조회·기타 DB', '요청당 DB 정액 요금 없음'],
    ]) row(label, s.mau * s[key], '회', 0, note);
    const edgeInvocations = ocr + text + menus + chat + add * 2 + s.mau * s.deletePerUser + s.extraEdge;
    const userOperations = ocr + text + menus + chat + add + s.mau * (s.manualPerUser + s.cookingPerUser + s.sharePerUser + s.readPerUser + s.deletePerUser);
    const egressGb = userOperations * s.egressKb / 1e6 + s.extraEgress;
    const over = (usage, quota) => Math.max(0, usage - quota);
    const infraRows = [];
    const infra = (label, count, unit, price, note) => infraRows.push({ label, volume: count, unit, unitCost: price, cost: count * price, note });
    infra('Supabase 기본 + 추가 compute', 1, '월', s.supabaseBase + s.computeExtra, '요금제와 프로젝트 compute 크레딧 확인');
    infra('Edge 초과 사용', over(edgeInvocations, s.edgeIncluded), '호출', s.edgePrice / 1e6, `포함 ${s.edgeIncluded.toLocaleString()}회 · 총 ${Math.round(edgeInvocations).toLocaleString()}회`);
    infra('Auth MAU 초과', over(s.mau, s.authIncluded), '명', s.authPrice, '포함 MAU 초과분');
    infra('전송량 초과', over(egressGb, s.egressIncluded), 'GB', s.egressPrice, '이미지 인바운드 제외 · 응답량 추정');
    infra('DB 용량 초과', over(s.dbGb, s.dbIncluded), 'GB', s.dbPrice, '입력한 용량 기준; 성장 차트에서 용량 고정');
    infra('파일 Storage 초과', over(s.storageGb, s.storageIncluded), 'GB', s.storagePrice, 'OCR 원본 영구 보관 없음');
    infra('Realtime 메시지 초과', over(s.realtimeMessages, s.realtimeIncluded), '메시지', s.realtimePrice / 1e6, '선택 사용량');
    infra('웹 Hosting', 1, '월', s.hosting, '실제 플랜/초과 금액 입력');
    infra('EAS 구독·OTA 초과', 1, '월', s.easFixed + s.updateExtra, '빌드 추가분 별도');
    infra('추가 유료 빌드', s.builds, '빌드', s.buildPrice, '크레딧 밖 유료분');
    infra('기타 운영 고정 비용', 1, '월', s.miscFixed, '세금·인건비 등 기본 미포함');
    infra('기타 사용자 변동 비용', s.mau, '명', s.miscPerUser, '선택 입력');
    const infraCost = infraRows.reduce((sum, r) => sum + r.cost, 0);
    rows.push(...infraRows);
    const refresh = Math.max(30, s.refreshSeconds);
    const opportunities = s.visibleSeconds <= 0 ? 0 : 1 + (s.refreshEnabled ? Math.max(0, Math.ceil(s.visibleSeconds / refresh) - 1) : 0);
    const adRequests = s.mau * s.activeDays * fraction(s.androidPct) * s.adSessions * opportunities * fraction(s.requestAllowedPct);
    const impressions = adRequests * fraction(s.matchPct) * fraction(s.showPct);
    const adRevenue = s.testAds ? 0 : impressions / 1000 * s.ecpm;
    const totalCost = aiCost + infraCost, profit = adRevenue - totalCost;
    const fixedCost = s.supabaseBase + s.computeExtra + s.hosting + s.easFixed + s.updateExtra + s.builds * s.buildPrice + s.miscFixed + over(s.dbGb, s.dbIncluded) * s.dbPrice + over(s.storageGb, s.storageIncluded) * s.storagePrice + over(s.realtimeMessages, s.realtimeIncluded) * s.realtimePrice / 1e6;
    const adPerUser = s.activeDays * fraction(s.androidPct) * s.adSessions * opportunities * fraction(s.requestAllowedPct) * fraction(s.matchPct) * fraction(s.showPct) / 1000 * (s.testAds ? 0 : s.ecpm);
    // Per-user contribution excludes fixed fees and threshold-based infrastructure overages.
    const perUserAi = s.mau ? aiCost / s.mau : 0;
    if (s.aiBudget > 0 && aiCost > s.aiBudget) warnings.push(`AI 예상 비용이 월 경고선 $${s.aiBudget}를 넘습니다. 계산기가 실제 호출을 차단하지는 않습니다.`);
    if (s.testAds) warnings.push('테스트 광고 모드: 예상 노출이 있어도 광고 수익은 0입니다. 현재 preview APK가 이 경우입니다.');
    if (s.supabaseBase === 0 && (edgeInvocations > s.edgeIncluded || s.mau > s.authIncluded || egressGb > s.egressIncluded || s.dbGb > s.dbIncluded || s.storageGb > s.storageIncluded)) warnings.push('기본 요금 0 설정에서 한도를 초과했습니다. Free는 유료 초과 사용을 지원하지 않을 수 있어 서비스 중단/업그레이드를 별도로 고려해야 합니다.');
    if (s.ocrPerUser * repeat > s.activeDays * 10 || (s.textPerUser + s.chatAddPerUser) * repeat > s.activeDays * 30 || (s.menuPerUser + s.chatPerUser + s.chatAddPerUser) * repeat > s.activeDays * 30) warnings.push('입력 사용량이 현재 일별 제한을 넘을 수 있습니다 (OCR 10회, 재고 파싱·상담 각 30회/일).');
    return { adRequests, impressions, adRevenue, aiCost, infraCost, totalCost, profit, fixedCost, perUserRevenue: adPerUser, perUserCost: s.mau ? totalCost / s.mau : 0, contribution: adPerUser - perUserAi - s.miscPerUser, aiCalls, searchCalls, edgeInvocations, egressGb, featureCosts, rows, warnings };
  }
  function calculate(input) {
    const s = normalize(input), r = core(s);
    const perOne = core({ ...s, mau: 1 });
    r.contribution = perOne.adRevenue - perOne.aiCost - s.miscPerUser;
    // Earliest threshold-aware break-even. Later overage thresholds may reverse profitability.
    const upper = 10000000;
    r.breakEvenUsers = null;
    if (core({ ...s, mau: 0 }).profit >= 0) r.breakEvenUsers = 0;
    else if (r.contribution > 0) {
      const edges = [0, s.authIncluded, upper];
      const edgePerUser = perOne.edgeInvocations - s.extraEdge;
      if (edgePerUser > 0) edges.push((s.edgeIncluded - s.extraEdge) / edgePerUser);
      const gbPerUser = perOne.egressGb - s.extraEgress;
      if (gbPerUser > 0) edges.push((s.egressIncluded - s.extraEgress) / gbPerUser);
      const points = [...new Set(edges.filter(n => n >= 0 && n <= upper))].sort((a, b) => a - b);
      for (let i = 1; i < points.length; i++) {
        const lo = points[i - 1], hi = points[i], a = core({ ...s, mau: lo }), b = core({ ...s, mau: hi });
        if (a.profit >= 0) { r.breakEvenUsers = Math.ceil(lo); break; }
        if (b.profit >= 0 && b.profit > a.profit) {
          const candidate = Math.ceil(lo + (-a.profit) * (hi - lo) / (b.profit - a.profit));
          if (core({ ...s, mau: candidate }).profit >= -1e-9) r.breakEvenUsers = candidate;
          break;
        }
      }
    }
    r.breakEvenEcpm = r.impressions > 0 && !s.testAds ? r.totalCost / r.impressions * 1000 : null;
    if (r.breakEvenUsers !== null && core({ ...s, mau: upper }).profit < 0) r.warnings.push('첫 손익분기점 이후에도 인프라 포함량을 넘으면 다시 적자가 될 수 있습니다. 사용자 증가 그래프와 초과 단가를 함께 확인하세요.');
    if (r.contribution <= 0) r.warnings.push('현재 가정에서는 사용자 1명의 광고 수익보다 변동 비용이 큽니다. 사용자를 늘리는 것만으로 흑자가 되지 않습니다.');
    else if (r.breakEvenUsers === null) r.warnings.push('현재 인프라 초과 단가를 포함하면 1,000만 MAU 범위에서 손익분기점을 찾지 못했습니다.');
    r.warnings.push('토큰·검색 호출·eCPM·사용량은 시뮬레이션 가정입니다. AI 청구/AdMob 실적과 연결되어 있지 않습니다. 세금·인건비·카드 수수료는 입력한 기타 비용 외에는 제외됩니다.');
    return r;
  }
  root.ProfitModel = { fields, defaults, normalize, calculate, expectedBatches };
})(typeof window === 'undefined' ? globalThis : window);
