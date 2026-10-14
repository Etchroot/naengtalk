(function () {
  'use strict';
  const model = window.ProfitModel;
  const storageKey = 'naengtalk-profitability-v1';
  const byId = id => document.getElementById(id);
  if (!model) { byId('warnings').textContent = '계산 모델을 불러오지 못했습니다. model.js가 같은 폴더에 있는지 확인해 주세요.'; return; }
  const nf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 });
  const unitDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
  let state = { ...model.defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      model.fields.forEach(field => {
        const value = saved[field.key];
        if (typeof value === 'number' && Number.isFinite(value)) state[field.key] = Math.min(field.max ?? Infinity, Math.max(field.min ?? 0, value));
      });
    }
  } catch (_) { byId('save-status').textContent = '브라우저 저장을 사용할 수 없습니다. 입력값은 이번 화면에서 유지됩니다.'; }
  const groups = { audience: '사용자와 환율', ads: '배너 광고', usage: '사용자 1명당 월 사용량', usageDetail: '재시도·레시피·소진일 캐시', tokens: 'AI 토큰 가정', prices: 'AI·검색 단가와 토큰 캐시', infrastructure: '인프라와 무료 제공량' };
  const advanced = document.createElement('details'); advanced.className = 'advanced';
  const summary = document.createElement('summary'); summary.textContent = '상세 비용 가정 조절'; advanced.append(summary);
  Object.keys(groups).forEach(group => {
    const fields = model.fields.filter(field => group === 'usageDetail' ? field.group === 'usage' && !field.key.endsWith('PerUser') : field.group === group && (group !== 'usage' || field.key.endsWith('PerUser')));
    if (!fields.length) return;
    const fieldset = document.createElement('fieldset'); fieldset.className = 'control-group';
    const legend = document.createElement('legend'); legend.textContent = groups[group]; fieldset.append(legend);
    fields.forEach(field => {
      const wrapper = document.createElement('div'); wrapper.className = 'field';
      const label = document.createElement('label'); label.htmlFor = 'input-' + field.key;
      const title = document.createElement('span'); title.textContent = field.label;
      const unit = document.createElement('span'); unit.className = 'unit'; unit.textContent = field.unit || '';
      label.append(title, unit); wrapper.append(label);
      let input;
      if (field.key === 'testAds' || field.key === 'refreshEnabled') {
        input = document.createElement('select');
        (field.key === 'testAds' ? [['0', '실제 광고 가정'], ['1', '테스트 광고 · 매출 0']] : [['0', '새로고침 없음'], ['1', '표시 중 주기적 요청']]).forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); });
      } else {
        input = document.createElement('input'); input.type = 'number'; input.inputMode = 'decimal';
        if (field.min != null) input.min = field.min;
        if (field.max != null) input.max = field.max;
        input.step = field.step || 'any';
      }
      input.id = label.htmlFor; input.name = field.key; input.value = state[field.key];
      if (field.help) { const help = document.createElement('small'); help.id = 'help-' + field.key; help.textContent = field.help; input.setAttribute('aria-describedby', help.id); wrapper.append(input, help); } else wrapper.append(input);
      input.addEventListener('input', () => {
        if (input.value === '' || !Number.isFinite(Number(input.value))) { input.setAttribute('aria-invalid', 'true'); return; }
        const raw = Number(input.value);
        const value = Math.min(field.max ?? Infinity, Math.max(field.min ?? 0, raw));
        input.setAttribute('aria-invalid', String(raw !== value)); state[field.key] = value; render(); save();
      });
      input.addEventListener('change', () => { input.value = state[field.key]; input.removeAttribute('aria-invalid'); });
      fieldset.append(wrapper);
    });
    (['usageDetail', 'tokens', 'prices', 'infrastructure'].includes(group) ? advanced : byId('controls')).append(fieldset);
  });
  byId('controls').append(advanced);
  byId('controls').addEventListener('submit', event => event.preventDefault());
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); byId('save-status').textContent = '현재 가정을 이 브라우저에 저장했습니다.'; }
    catch (_) { byId('save-status').textContent = '브라우저 저장을 사용할 수 없습니다. 시나리오 저장으로 내려받을 수 있습니다.'; }
  }
  function krw(value) { return Number.isFinite(value) ? nf.format(value * state.fx) + '원' : '계산 불가'; }
  function usd(value) { return Number.isFinite(value) ? '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : '계산 불가'; }
  function set(id, text) { byId(id).textContent = text; }
  function render() {
    const result = model.calculate(state);
    set('revenue', krw(result.adRevenue)); set('revenue-usd', usd(result.adRevenue));
    set('cost', krw(result.totalCost)); set('cost-usd', usd(result.totalCost));
    set('profit', krw(result.profit)); set('profit-usd', usd(result.profit));
    byId('profit-card').classList.toggle('negative', result.profit < 0);
    set('per-user-revenue', krw(result.perUserRevenue)); set('per-user-cost', krw(result.perUserCost)); set('contribution', krw(result.contribution));
    set('break-even', result.breakEvenUsers === null ? (result.contribution <= 0 ? '달성 불가' : '범위 내 없음') : nf.format(Math.ceil(result.breakEvenUsers)) + '명');
    set('break-even-note', result.breakEvenUsers === null ? (result.contribution <= 0 ? '1인당 광고 매출이 AI·기타 변동비 이하입니다. 사용자 증가만으로 손익분기점을 달성할 수 없습니다.' : '인프라 초과 비용을 포함해 계산 범위 내 손익분기점을 찾지 못했습니다.') : '처음 비용을 회수하는 사용자 수입니다. 무료 제공량을 넘으면 이후 다시 적자가 될 수 있습니다.');
    set('break-even-ecpm', result.breakEvenEcpm === null ? (state.testAds ? '테스트 광고: 적용 불가' : '노출 없음') : usd(result.breakEvenEcpm));
    const features = byId('feature-costs'); features.replaceChildren();
    (result.featureCosts || []).forEach(feature => {
      const item = document.createElement('div');
      const label = document.createElement('dt'); label.textContent = feature.label;
      const cost = document.createElement('dd'); cost.textContent = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(feature.unitCost * state.fx) + '원';
      const usage = document.createElement('small'); usage.textContent = '월 ' + decimal.format(feature.volume) + '회';
      cost.append(usage); item.append(label, cost); features.append(item);
    });
    [['ad-requests','adRequests'],['impressions','impressions'],['ai-calls','aiCalls'],['search-calls','searchCalls'],['edge-calls','edgeInvocations']].forEach(([id,key]) => set(id,nf.format(result[key]) + '회'));
    const body = byId('cost-rows'); body.replaceChildren();
    result.rows.forEach(row => {
      const tr = document.createElement('tr');
      [row.label, decimal.format(row.volume) + ' ' + (row.unit || ''), typeof row.unitCost === 'number' ? '$' + unitDecimal.format(row.unitCost) : String(row.unitCost ?? '—'), krw(row.cost), row.note || ''].forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); }); body.append(tr);
    });
    const warnings = byId('warnings'); warnings.replaceChildren();
    result.warnings.forEach(warning => { const p = document.createElement('p'); p.textContent = warning; warnings.append(p); });
    drawChart(result);
  }
  function drawChart(current) {
    const svg = byId('chart');
    const ns = 'http://www.w3.org/2000/svg';
    svg.querySelectorAll('.drawn').forEach(node => node.remove());
    const add = (tag, attrs, text) => { const node = document.createElementNS(ns,tag); node.classList.add('drawn'); Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key,String(value))); if (text != null) node.textContent = text; svg.append(node); return node; };
    const maxUsers = Math.min(model.fields.find(field => field.key === 'mau')?.max ?? 10000000, Math.max(1000, state.mau * 3));
    const points = Array.from({length:41}, (_,i) => { const mau = maxUsers * i / 40; const r = model.calculate({...state,mau}); return {mau,revenue:r.adRevenue * state.fx,cost:r.totalCost * state.fx}; });
    const max = Math.max(1,...points.flatMap(point => [point.revenue,point.cost])) * 1.12;
    const x = value => 68 + value / maxUsers * 550;
    const y = value => 225 - value / max * 196;
    const compact = value => new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}).format(value);
    for(let i=0;i<5;i++) {
      const value = max * i / 4; const yy = y(value);
      add('line',{x1:68,y1:yy,x2:618,y2:yy,stroke:'#e7ece4','stroke-width':1});
      add('text',{x:58,y:yy+4,'text-anchor':'end',fill:'#617066','font-size':11},compact(value));
      const users = maxUsers * i / 4;
      add('text',{x:x(users),y:248,'text-anchor':'middle',fill:'#617066','font-size':11},compact(users));
    }
    add('text',{x:68,y:16,fill:'#617066','font-size':10},'월 금액 (원)');
    add('text',{x:618,y:267,'text-anchor':'end',fill:'#617066','font-size':10},'월 활성 사용자 (명)');
    [['cost','#b18249'],['revenue','#2f7450']].forEach(([key,color]) => add('path',{d:points.map((point,i) => `${i?'L':'M'}${x(point.mau).toFixed(2)},${y(point[key]).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
    add('line',{x1:x(state.mau),y1:29,x2:x(state.mau),y2:225,stroke:'#617066','stroke-width':1,'stroke-dasharray':'4 4'});
    add('text',{x:x(state.mau)+6,y:39,fill:'#617066','font-size':10},'현재');
    set('chart-desc', `현재 월 활성 사용자 ${nf.format(state.mau)}명에서 매출 ${krw(current.adRevenue)}, 비용 ${krw(current.totalCost)}입니다. 그래프는 0명부터 ${nf.format(maxUsers)}명까지 같은 사용량 가정을 적용합니다.`);
    set('chart-summary',`0명부터 ${nf.format(maxUsers)}명까지 비교합니다. 사용자당 사용량·노출·단가는 동일하며, DB·파일 저장 용량은 입력한 값으로 고정합니다. 무료 제공량에 따라 비용 기울기가 달라집니다.`);
  }
  byId('reset').addEventListener('click',() => { state = {...model.defaults}; model.fields.forEach(field => { const input = byId('input-'+field.key); input.value=state[field.key]; input.removeAttribute('aria-invalid'); }); render(); save(); });
  byId('export').addEventListener('click',() => {
    const data = {name:'냉톡 월간 수익성 가정',exportedAt:new Date().toISOString(),currency:'USD',assumptions:state,result:model.calculate(state)};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
    const link = document.createElement('a'); link.href=url; link.download='naengtalk-profitability-'+new Date().toISOString().slice(0,10)+'.json'; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    set('save-status','현재 시나리오를 JSON 파일로 내려받았습니다.');
  });
  render();
})();
