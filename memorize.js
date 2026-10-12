(() => {
  'use strict';
  const main = document.querySelector('#main');
  const storageKey = 'korean-history:must-know:v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => value.replace(/\s+/gu, '').toLowerCase();
  function highlighted(value, terms) {
    const keywords = [...(terms || [])].sort((a, b) => b.length - a.length);
    let html = '', index = 0;
    while (index < value.length) {
      const term = keywords.find(word => value.startsWith(word, index));
      if (term) { html += `<mark class="memory-highlight">${esc(term)}</mark>`; index += term.length; }
      else { html += esc(value[index]); index++; }
    }
    return html;
  }
  async function init() {
    try {
      const [selection, guide] = await Promise.all(['must-know', 'study-guide'].map(async name => {
        const response = await fetch(`assets/data/${name}.json?v=20261013-readable`);
        if (!response.ok) throw new Error('자료를 불러오지 못했습니다.');
        return response.json();
      }));
      const cards = selection.cards;
      const ids = new Set(cards.map(card => card.id));
      let learned = new Set();
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved?.version === selection.version && Array.isArray(saved.learned)) learned = new Set(saved.learned.filter(id => ids.has(id)));
      } catch { /* Storage is optional. */ }
      let selectedEra = 'all';
      let hideAnswers = false;
      const revealed = new Set();
      const eras = guide.eras.filter(era => cards.some(card => card.era === era.id));
      function renderCard(card) {
        return `<article class="memory-card" data-card="${esc(card.id)}" aria-labelledby="cue-${esc(card.id)}">
          <div class="memory-card-heading"><h3 id="cue-${esc(card.id)}">${esc(card.label)}</h3><label class="memory-learned"><input type="checkbox" data-learned="${esc(card.id)}" aria-label="${esc(card.label)} 외웠어요"${learned.has(card.id) ? ' checked' : ''}><span>외웠어요</span></label></div>
          <div class="memory-answer-space"><dl class="memory-answer" id="answer-${esc(card.id)}">${(card.displayRows || [{term:card.label,detail:card.answer}]).map(row => `<div class="memory-fact"><dt>${highlighted(row.term, card.highlights)}</dt><dd>${highlighted(row.detail, card.highlights)}</dd></div>`).join('')}</dl><button type="button" class="memory-reveal" data-reveal="${esc(card.id)}" aria-controls="answer-${esc(card.id)}" hidden>답 보기</button></div></article>`;
      }
      main.innerHTML = `<header class="memory-heading"><p class="eyebrow">70~79회 · 필수 암기 ${cards.length}개</p><h1>이것만은 꼭 외우자!</h1></header>
        <div class="memory-layout"><aside class="memory-navigation" aria-label="시대별 암기 내용"><label class="memory-era-select">시대<select id="memory-era-select"><option value="all">전체 시대</option>${eras.map(era => `<option value="${esc(era.id)}">${esc(era.label)}</option>`).join('')}</select></label><nav class="memory-eras" aria-label="시대 선택"><button type="button" data-era="all" aria-pressed="true">전체 시대<span>${cards.length}</span></button>${eras.map(era => `<button type="button" data-era="${esc(era.id)}" aria-pressed="false">${esc(era.label)}<span>${cards.filter(card => card.era === era.id).length}</span></button>`).join('')}</nav></aside>
        <div class="memory-content"><div class="memory-controls"><label class="memory-search"><span class="visually-hidden">암기 내용 검색</span><input type="search" id="memory-search" placeholder="인물·개념 검색" autocomplete="off"></label><div class="memory-tools"><button type="button" id="hide-answers" aria-pressed="false">답 가리기</button><label class="memory-unlearned"><input type="checkbox" id="unlearned-only">안 외운 것만</label><p id="memory-progress" role="status"></p></div></div>
        <p id="memory-count" class="memory-count" role="status"></p>${eras.map(era => `<section class="memory-era-section" data-section="${esc(era.id)}" aria-labelledby="era-${esc(era.id)}"><h2 id="era-${esc(era.id)}">${esc(era.label)}<span class="memory-section-count"></span></h2><div class="memory-grid">${cards.filter(card => card.era === era.id).map(renderCard).join('')}</div></section>`).join('')}<p class="memory-empty" hidden>해당하는 내용이 없습니다.</p></div></div><span class="visually-hidden" id="memory-save-status" role="status"></span>`;
      const search = document.querySelector('#memory-search');
      const unlearnedOnly = document.querySelector('#unlearned-only');
      function update() {
        const query = normalize(search.value.trim());
        let visible = 0;
        cards.forEach(card => {
          const element = document.querySelector(`[data-card="${card.id}"]`);
          element.hidden = (selectedEra !== 'all' && card.era !== selectedEra) || (unlearnedOnly.checked && learned.has(card.id)) || !normalize(card.label + card.answer).includes(query);
          if (!element.hidden) visible++;
          element.classList.toggle('is-learned', learned.has(card.id));
          const hidden = hideAnswers && !revealed.has(card.id);
          document.querySelector(`#answer-${card.id}`).hidden = hidden;
          element.querySelector('[data-reveal]').hidden = !hidden;
        });
        document.querySelectorAll('[data-section]').forEach(section => {
          const count = section.querySelectorAll('[data-card]:not([hidden])').length;
          section.hidden = count === 0;
          section.querySelector('.memory-section-count').textContent = `${count}개`;
        });
        document.querySelector('#memory-progress').textContent = `${learned.size} / ${cards.length} 암기`;
        document.querySelector('#memory-count').textContent = `${visible}개`;
        document.querySelector('.memory-empty').hidden = visible !== 0;
        document.querySelectorAll('[data-era]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.era === selectedEra)));
        document.querySelector('#memory-era-select').value = selectedEra;
      }
      document.querySelectorAll('[data-learned]').forEach(input => input.addEventListener('change', () => {
        if (input.checked) learned.add(input.dataset.learned); else learned.delete(input.dataset.learned);
        try { localStorage.setItem(storageKey, JSON.stringify({version: selection.version, learned: [...learned]})); }
        catch { document.querySelector('#memory-save-status').textContent = '현재 브라우저에서는 암기 표시를 저장할 수 없습니다.'; }
        update();
        if (unlearnedOnly.checked && input.checked) (document.querySelector('[data-card]:not([hidden]) [data-learned]') || unlearnedOnly).focus();
      }));
      document.querySelectorAll('[data-era]').forEach(button => button.addEventListener('click', () => { selectedEra = button.dataset.era; update(); }));
      document.querySelector('#memory-era-select').addEventListener('change', event => { selectedEra = event.target.value; update(); });
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
