(() => {
  'use strict';
  const STORAGE_KEY = 'korean-history:king-quiz:v1';
  const stage = document.querySelector('#king-stage');
  const filtersForm = document.querySelector('#king-filters');
  const startSelect = document.querySelector('#round-start');
  const endSelect = document.querySelector('#round-end');
  const kingdomSelect = document.querySelector('#kingdom-filter');
  const filterStatus = document.querySelector('#filter-status');
  let data, questions, state, composing = false;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => value.normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase();
  const isResolved = response => ['correct', 'revealed'].includes(response?.status);
  const emptyResponse = () => ({status: 'pending', missed: false, input: ''});
  const selectedSources = question => question.sources.filter(source => source.round >= state.filters.start && source.round <= state.filters.end);
  const eligible = filters => data.questions.filter(question => (filters.kingdom === 'all' || question.kingdom === filters.kingdom) && question.sources.some(source => source.round >= filters.start && source.round <= filters.end));
  function validFilters(filters) {
    return filters && data.rounds.includes(filters.start) && data.rounds.includes(filters.end) && filters.start <= filters.end && (filters.kingdom === 'all' || data.questions.some(question => question.kingdom === filters.kingdom));
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { document.querySelector('#storage-note').textContent = '이 브라우저에서는 진행 상황을 저장할 수 없습니다.'; }
  }
  function freshState(filters) {
    return {version: data.version, fingerprint: data.revision, filters, deck: [], index: 0, responses: {}, mode: 'all'};
  }
  function restore() {
    const defaults = {start: data.rounds[0], end: data.rounds[data.rounds.length - 1], kingdom: 'all'};
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* Start clean if storage is unavailable or corrupted. */ }
    const base = freshState(validFilters(saved?.filters) ? saved.filters : defaults);
    if (!saved || saved.version !== data.version || saved.fingerprint !== base.fingerprint || !validFilters(saved.filters)) return base;
    const allowed = new Set(eligible(saved.filters).map(question => question.id));
    if (!Array.isArray(saved.deck) || saved.deck.some(id => typeof id !== 'string' || !allowed.has(id)) || new Set(saved.deck).size !== saved.deck.length || !Number.isInteger(saved.index) || saved.index < 0 || saved.index > saved.deck.length || !['all', 'missed'].includes(saved.mode) || !saved.responses || typeof saved.responses !== 'object' || Array.isArray(saved.responses)) return base;
    if (saved.deck.length && saved.mode === 'all' && saved.deck.length !== allowed.size) return base;
    for (let index = 0; index < saved.deck.length; index++) {
      const response = saved.responses[saved.deck[index]];
      if (!response || !['pending','wrong','correct','revealed'].includes(response.status) || typeof response.missed !== 'boolean' || typeof response.input !== 'string' || response.input.length > 100 || (index < saved.index && !isResolved(response)) || (index > saved.index && (response.status !== 'pending' || response.missed)) || (['wrong','revealed'].includes(response.status) && !response.missed)) return base;
    }
    return {...base, deck: saved.deck, index: saved.index, mode: saved.mode, responses: Object.fromEntries(saved.deck.map(id => [id, saved.responses[id]]))};
  }
  function shuffle(ids) {
    for (let index = ids.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [ids[index], ids[other]] = [ids[other], ids[index]];
    }
    return ids;
  }
  function startDeck(ids, mode = 'all') {
    state.deck = shuffle([...ids]);
    state.index = 0;
    state.mode = mode;
    state.responses = Object.fromEntries(ids.map(id => [id, emptyResponse()]));
    save();
    render(true);
  }
  function sourceHTML(question) {
    const links = selectedSources(question).map(source => `<a href="exam.html?round=${source.round}&amp;mode=instant#q-${source.number}" target="_blank" rel="noopener">${source.round}회 ${source.number}번 · ${source.choice}번 선지 ↗<span class="visually-hidden"> (새 탭)</span></a>`).join('');
    return `<div class="king-sources"><p>출제된 기출문제</p><div>${links}</div></div>`;
  }
  function feedbackHTML(question, response) {
    if (response.status === 'pending') return '';
    if (response.status === 'wrong') return '<svg class="king-pen" viewBox="0 0 30 30" aria-hidden="true"><path d="M6 5 24 25M24 5 6 25"/></svg><span>다시 생각해 보세요.</span>';
    if (response.status === 'correct') return `<svg class="king-pen" viewBox="0 0 30 30" aria-hidden="true"><path d="m3 16 7 9L26 4M4 17l6 7L25 5"/></svg><span><strong>${escapeHTML(question.king)}</strong></span>`;
    return `<span>정답은 <strong>${escapeHTML(question.king)}</strong> · 다시 풀 문제에 담았어요.</span>`;
  }
  function render(focus = false) {
    document.querySelector('#apply-filters').textContent = state.deck.length ? '적용' : '시작';
    filterStatus.classList.remove('is-error');
    filterStatus.textContent = `${state.filters.start}~${state.filters.end}회 · ${state.filters.kingdom === 'all' ? '전체 나라' : state.filters.kingdom} · ${eligible(state.filters).length}문제${state.mode === 'missed' ? ' · 틀린 문제 복습 중' : ''}`;
    if (!state.deck.length) {
      stage.innerHTML = `<p class="king-start-note">${eligible(state.filters).length ? '회차를 고르고 시작을 눌러 주세요.' : '선택한 범위에 문제가 없습니다. 회차나 나라를 바꿔 주세요.'}</p>`;
      return;
    }
    if (state.index === state.deck.length) {
      const missed = state.deck.filter(id => state.responses[id].missed);
      const correct = state.deck.filter(id => state.responses[id].status === 'correct' && !state.responses[id].missed).length;
      stage.innerHTML = `<div class="king-card king-summary"><h2 tabindex="-1" id="king-summary-title">${state.mode === 'missed' ? '복습' : '오늘의 왕 맞히기'} 완료</h2><div class="king-score">${correct}<small> / ${state.deck.length}문제</small></div><p>한 번에 맞힌 문제 ${correct}개 · 다시 볼 문제 ${missed.length}개</p><div class="king-card-actions"><button type="button" class="button button-primary" id="retry-missed" ${missed.length ? '' : 'disabled'}>틀린 문제만 다시 풀기${missed.length ? ` (${missed.length})` : ''}</button><button type="button" class="button button-secondary" id="restart-kings">전체 다시 풀기</button></div></div>`;
      document.querySelector('#retry-missed').addEventListener('click', () => startDeck(missed, 'missed'));
      document.querySelector('#restart-kings').addEventListener('click', () => startDeck(eligible(state.filters).map(question => question.id)));
      if (focus) document.querySelector('#king-summary-title').focus();
      return;
    }
    const question = questions.get(state.deck[state.index]);
    const response = state.responses[question.id];
    const resolved = isResolved(response);
    const roundCount = new Set(selectedSources(question).map(source => source.round)).size;
    stage.innerHTML = `<div class="king-progress"><span><strong>${state.index + 1}</strong> / ${state.deck.length}문제</span><span>한 번에 정답 ${state.deck.filter(id => state.responses[id].status === 'correct' && !state.responses[id].missed).length}개</span></div><progress class="king-progress-bar" value="${state.index}" max="${state.deck.length}" aria-label="풀이 진행"></progress><article class="king-card"><div class="king-meta"><span>${escapeHTML(question.kingdom)}</span><span>선택 범위 내 ${roundCount}개 회차 출제</span></div><h2 class="king-prompt" id="king-prompt">${escapeHTML(question.prompt)}</h2><form id="king-answer-form" class="king-answer-form"><label for="king-answer">왕 이름</label><div class="king-answer-row"><input id="king-answer" name="answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100" placeholder="왕 이름을 입력하세요" value="${escapeHTML(response.input)}" aria-describedby="king-feedback" ${resolved ? 'disabled' : ''}><button type="submit" id="check-answer" class="button button-primary" ${resolved ? 'disabled' : ''}>확인</button></div></form><div id="king-feedback" class="king-feedback ${response.status}" role="status" aria-live="polite">${feedbackHTML(question, response)}</div><div class="king-card-actions">${resolved ? `<button type="button" class="button button-primary" id="next-king">${state.index + 1 === state.deck.length ? '결과 보기' : '다음 문제 →'}</button>` : '<button type="button" class="text-button" id="reveal-king">정답 보기</button>'}</div>${resolved ? sourceHTML(question) : ''}</article>`;
    const input = document.querySelector('#king-answer');
    composing = false;
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; response.input = input.value; save(); });
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault(); });
    input.addEventListener('input', () => { response.input = input.value; save(); input.removeAttribute('aria-invalid'); });
    document.querySelector('#king-answer-form').addEventListener('submit', event => {
      event.preventDefault();
      if (composing || resolved) return;
      response.input = input.value;
      if (!normalize(input.value)) {
        document.querySelector('#king-feedback').textContent = '왕 이름을 입력해 주세요.';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      const correct = [question.king, ...question.acceptedAnswers].some(answer => normalize(answer) === normalize(input.value));
      response.status = correct ? 'correct' : 'wrong';
      if (!correct) response.missed = true;
      save();
      render(true);
      if (!correct) document.querySelector('#king-answer').select();
    });
    document.querySelector('#reveal-king')?.addEventListener('click', () => {
      response.status = 'revealed';
      response.missed = true;
      save();
      render(true);
    });
    document.querySelector('#next-king')?.addEventListener('click', () => {
      state.index++;
      save();
      render(true);
    });
    if (focus) (resolved ? document.querySelector('#next-king') : input).focus();
  }
  filtersForm.addEventListener('submit', event => {
    event.preventDefault();
    const filters = {start: Number(startSelect.value), end: Number(endSelect.value), kingdom: kingdomSelect.value};
    if (!validFilters(filters)) {
      filterStatus.textContent = '시작 회차는 끝 회차보다 클 수 없습니다.';
      filterStatus.classList.add('is-error');
      startSelect.setAttribute('aria-invalid', 'true');
      startSelect.focus();
      return;
    }
    startSelect.removeAttribute('aria-invalid');
    state = freshState(filters);
    startDeck(eligible(filters).map(question => question.id));
  });
  async function init() {
    try {
      const result = await fetch('assets/data/king-quiz.json?v=20261012-kings');
      if (!result.ok) throw new Error('Data unavailable');
      data = await result.json();
      if (!data || !Number.isInteger(data.version) || typeof data.revision !== 'string' || !data.revision || !Array.isArray(data.rounds) || !data.rounds.length || !data.rounds.every(Number.isInteger) || !Array.isArray(data.questions) || !data.questions.length || !data.questions.every(question => typeof question.id === 'string' && question.id && typeof question.prompt === 'string' && question.prompt && typeof question.king === 'string' && normalize(question.king) && typeof question.kingdom === 'string' && Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.every(answer => typeof answer === 'string' && normalize(answer)) && Array.isArray(question.sources) && question.sources.length && question.sources.every(source => data.rounds.includes(source.round) && Number.isInteger(source.number) && source.number > 0 && Number.isInteger(source.choice) && source.choice > 0 && source.choice <= 5)) || new Set(data.questions.map(question => question.id)).size !== data.questions.length) throw new Error('Invalid data');
      data.rounds = [...new Set(data.rounds)].sort((a, b) => a - b);
      questions = new Map(data.questions.map(question => [question.id, question]));
      const options = data.rounds.map(round => `<option value="${round}">${round}회</option>`).join('');
      startSelect.innerHTML = options;
      endSelect.innerHTML = options;
      kingdomSelect.innerHTML += [...new Set(data.questions.map(question => question.kingdom))].map(kingdom => `<option value="${escapeHTML(kingdom)}">${escapeHTML(kingdom)}</option>`).join('');
      state = restore();
      startSelect.value = state.filters.start;
      endSelect.value = state.filters.end;
      kingdomSelect.value = state.filters.kingdom;
      filtersForm.hidden = false;
      render();
    } catch {
      stage.innerHTML = '<div class="king-empty"><p>문제를 불러오지 못했습니다.</p><button type="button" class="button button-secondary" id="reload-kings">다시 불러오기</button></div>';
      document.querySelector('#reload-kings').addEventListener('click', () => location.reload());
    }
  }
  init();
})();
