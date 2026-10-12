(() => {
  'use strict';
  const main = document.querySelector('#main');
  const storageKey = 'korean-history:must-know:v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => value.replace(/\s+/gu, '').toLowerCase();
  async function init() {
    try {
      const [selection, guide, exams, keywords] = await Promise.all(['must-know', 'study-guide', 'exams', 'keyword-guide'].map(async name => {
        const response = await fetch(`assets/data/${name}.json?v=20261013-essential-expanded`);
        if (!response.ok) throw new Error('자료를 불러오지 못했습니다.');
        return response.json();
      }));
      const facts = new Map([...guide.facts, ...keywords.facts].map(fact => [fact.id, fact]));
      const sources = new Map(guide.sources.map(source => [source.id, source]));
      const cards = selection.cards.map(card => {
        const selectedFacts = [...card.factIds, ...card.keywordFactIds].map(id => facts.get(id));
        if (selectedFacts.some(fact => !fact)) throw new Error('암기 자료를 확인해 주세요.');
        const questionSources = card.references.flatMap(ref => exams.find(exam => exam.id === ref.round).questions.find(question => question.number === ref.number).explanationSources || []);
        const evidence = [...selectedFacts.flatMap(fact => (fact.sourceIds || []).map(id => sources.get(id))), ...questionSources];
        return {...card, eras: [...new Set(selectedFacts.map(fact => fact.era))],
          sources: [...new Map(evidence.filter(Boolean).map(source => [source.url, source])).values()]};
      });
      const ids = new Set(cards.map(card => card.id));
      let learned = new Set();
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved?.version === selection.version && Array.isArray(saved.learned)) learned = new Set(saved.learned.filter(id => ids.has(id)));
      } catch { /* Start with an empty checklist when storage is unavailable. */ }
      let selectedEra = 'all';
      let hideAnswers = false;
      const revealed = new Set();
      const eras = guide.eras.filter(era => cards.some(card => card.eras.includes(era.id)));
      main.innerHTML = `<header class="memory-heading"><p class="eyebrow">70~79회 · 먼저 외울 ${cards.length}가지</p><h1>이것만은 꼭 외우자!</h1><p>${esc(selection.basis)}</p></header>
        <div class="memory-tools"><button type="button" class="button button-secondary" id="hide-answers" aria-pressed="false">답 가리기</button><label class="memory-unlearned"><input type="checkbox" id="unlearned-only">아직 안 외운 것만</label><p id="memory-progress" role="status"></p></div>
        <div class="era-filters memory-eras" role="group" aria-label="시대와 나라 선택"><button type="button" data-era="all" aria-pressed="true">전체</button>${eras.map(era => `<button type="button" data-era="${esc(era.id)}" aria-pressed="false">${esc(era.label)}</button>`).join('')}</div>
        <label class="concept-search memory-search"><span class="visually-hidden">암기 내용 검색</span><input type="search" id="memory-search" placeholder="내용 검색" autocomplete="off"></label>
        <p id="memory-count" class="memory-count" role="status"></p><div class="memory-grid">${cards.map((card, index) => `<article class="memory-card" data-card="${esc(card.id)}" aria-labelledby="cue-${esc(card.id)}"><div class="memory-card-top"><span>${String(index + 1).padStart(2, '0')} · ${esc(guide.eras.filter(era => card.eras.includes(era.id)).map(era => era.label).join('·'))}</span><label><input type="checkbox" data-learned="${esc(card.id)}" aria-label="${esc(card.cue)} 외웠어요"${learned.has(card.id) ? ' checked' : ''}>외웠어요</label></div><h2 id="cue-${esc(card.id)}">${esc(card.label)}</h2><div class="memory-answer-space"><p class="memory-answer" id="answer-${esc(card.id)}">${esc(card.answer)}</p><button type="button" class="memory-reveal" data-reveal="${esc(card.id)}" aria-controls="answer-${esc(card.id)}" hidden>답 보기</button></div><details class="memory-references"><summary>${card.references.length ? '관련 기출·근거' : '근거'}</summary><div>${card.references.map(ref => `<a href="exam.html?round=${ref.round}&amp;mode=instant#q-${ref.number}">${ref.round}회 ${ref.number}번 ↗</a>`).join('')}${card.sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>`).join('')}</div></details></article>`).join('')}</div><p class="memory-empty" hidden>선택한 조건에 해당하는 내용이 없습니다.</p><span class="visually-hidden" id="memory-save-status" role="status"></span>`;
      const search = document.querySelector('#memory-search');
      const unlearnedOnly = document.querySelector('#unlearned-only');
      function update() {
        const query = normalize(search.value.trim());
        let visible = 0;
        cards.forEach(card => {
          const element = document.querySelector(`[data-card="${card.id}"]`);
          element.hidden = (selectedEra !== 'all' && !card.eras.includes(selectedEra)) || (unlearnedOnly.checked && learned.has(card.id)) || !normalize(card.label + card.cue + card.answer).includes(query);
          if (!element.hidden) visible++;
          element.classList.toggle('is-learned', learned.has(card.id));
          const hidden = hideAnswers && !revealed.has(card.id);
          document.querySelector(`#answer-${card.id}`).hidden = hidden;
          element.querySelector('[data-reveal]').hidden = !hidden;
        });
        document.querySelector('#memory-progress').textContent = `${learned.size} / ${cards.length}개 외웠어요`;
        document.querySelector('#memory-count').textContent = `${visible}개 표시`;
        document.querySelector('.memory-empty').hidden = visible !== 0;
        document.querySelectorAll('[data-era]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.era === selectedEra)));
      }
      document.querySelectorAll('[data-learned]').forEach(input => input.addEventListener('change', () => {
        if (input.checked) learned.add(input.dataset.learned); else learned.delete(input.dataset.learned);
        try { localStorage.setItem(storageKey, JSON.stringify({version: selection.version, learned: [...learned]})); }
        catch { document.querySelector('#memory-save-status').textContent = '현재 브라우저에서는 암기 표시를 저장할 수 없습니다.'; }
        update();
        if (unlearnedOnly.checked && input.checked) document.querySelector('[data-card]:not([hidden]) [data-learned]')?.focus();
      }));
      document.querySelectorAll('[data-era]').forEach(button => button.addEventListener('click', () => { selectedEra = button.dataset.era; update(); }));
      document.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
        revealed.add(button.dataset.reveal);
        update();
        document.querySelector(`[data-learned="${button.dataset.reveal}"]`).focus();
      }));
      document.querySelector('#hide-answers').addEventListener('click', event => {
        hideAnswers = !hideAnswers;
        revealed.clear();
        event.currentTarget.setAttribute('aria-pressed', String(hideAnswers));
        event.currentTarget.textContent = hideAnswers ? '답 모두 보기' : '답 가리기';
        update();
      });
      search.addEventListener('input', update);
      unlearnedOnly.addEventListener('change', update);
      update();
    } catch (error) {
      main.innerHTML = `<div class="error-state"><h1>암기 자료를 불러오지 못했어요.</h1><p>${esc(error.message)}</p><button class="button button-primary" id="memory-retry">다시 불러오기</button></div>`;
      document.querySelector('#memory-retry').addEventListener('click', () => location.reload());
    }
  }
  init();
})();
