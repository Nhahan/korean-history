(() => {
  'use strict';
  const main = document.querySelector('#main');
  const storageKey = 'korean-history:final-review:v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => value.replace(/\s+/gu, '').toLowerCase();
  function highlight(value, words) {
    const terms = [...words].sort((a,b) => b.length-a.length);
    let result = '', index = 0;
    while (index < value.length) {
      const word = terms.find(term => value.startsWith(term,index));
      if (word) { result += `<mark class="memory-highlight">${esc(word)}</mark>`; index += word.length; }
      else { result += esc(value[index]); index++; }
    }
    return result;
  }
  async function init() {
    try {
      const response = await fetch('assets/data/final-review.json?v=20261016-final-review');
      if (!response.ok) throw new Error('정리 자료를 가져오지 못했습니다.');
      const data = await response.json();
      const {cards, eras} = data;
      const ids = new Set(cards.map(card => card.id));
      let learned = new Set();
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved?.version === data.version && Array.isArray(saved.learned)) learned = new Set(saved.learned.filter(id => ids.has(id)));
      } catch { /* Storage is optional. */ }
      let selectedEra = 'all';
      let hideAnswers = false;
      const revealed = new Set();
      const searchable = new Map(cards.map(card => [card.id, normalize(card.title + card.rows.map(row => row.term + row.detail).join('') + (card.sequence || []).join(''))]));
      function renderCard(card) {
        return `<article class="memory-card review-card" data-card="${esc(card.id)}" data-emphasis="${card.emphasis}" aria-labelledby="title-${esc(card.id)}"><div class="memory-card-heading"><div><h3 id="title-${esc(card.id)}">${card.emphasis ? `<mark class="review-title-highlight">${esc(card.title)}</mark><span class="visually-hidden"> · 집중 암기</span>` : esc(card.title)}</h3></div><label class="memory-learned"><input type="checkbox" data-learned="${esc(card.id)}" aria-label="${esc(card.title)} 외웠어요"${learned.has(card.id) ? ' checked' : ''}><span>외웠어요</span></label></div><div class="review-answer" id="answer-${esc(card.id)}"><dl class="memory-answer">${card.rows.map(row => `<div class="memory-fact"><dt>${highlight(row.term,card.highlights)}</dt><dd>${highlight(row.detail,card.highlights)}</dd></div>`).join('')}</dl>${card.sequence?.length ? `<div class="review-order"><p>순서</p><ol>${card.sequence.map(step => `<li>${highlight(step,card.highlights)}</li>`).join('')}</ol></div>` : ''}</div><button type="button" class="memory-reveal" data-reveal="${esc(card.id)}" aria-controls="answer-${esc(card.id)}" hidden>내용 보기</button></article>`;
      }
      main.innerHTML = `<header class="memory-heading review-heading"><p class="eyebrow">80회 대비 강의 · 스크립트 요약</p><h1><span>시험대비 마지막</span> 중요개념정리</h1><a class="review-source" href="${esc(data.source.url)}" target="_blank" rel="noopener noreferrer">${esc(data.source.author)} · 원본 강의 ↗</a></header><div class="memory-layout"><aside class="memory-navigation" aria-label="시대별 마지막 정리"><label class="memory-era-select">시대<select id="review-era-select"><option value="all">전체 시대</option>${eras.map(era => `<option value="${esc(era.id)}">${esc(era.label)}</option>`).join('')}</select></label><nav class="memory-eras" aria-label="시대 선택"><button type="button" data-era="all" aria-pressed="true">전체 시대<span>${cards.length}</span></button>${eras.map(era => `<button type="button" data-era="${esc(era.id)}" aria-pressed="false">${esc(era.label)}<span>${cards.filter(card => card.era === era.id).length}</span></button>`).join('')}</nav></aside><div class="memory-content"><div class="memory-controls"><label class="memory-search"><span class="visually-hidden">중요개념 검색</span><input type="search" id="review-search" placeholder="인물·제도·사건 검색" autocomplete="off"></label><div class="memory-tools review-tools"><label class="memory-unlearned"><input type="checkbox" id="emphasis-only">집중 암기만</label><label class="memory-unlearned"><input type="checkbox" id="unlearned-only">안 외운 것만</label><button type="button" id="hide-answers" aria-pressed="false">내용 가리기</button></div><p id="review-progress" class="review-progress" role="status"></p></div><p id="review-count" class="memory-count" role="status"></p>${eras.map(era => `<section class="memory-era-section" data-section="${esc(era.id)}" aria-labelledby="era-${esc(era.id)}"><h2 id="era-${esc(era.id)}">${esc(era.label)}<span class="memory-section-count"></span></h2><div class="memory-grid">${cards.filter(card => card.era === era.id).map(renderCard).join('')}</div></section>`).join('')}<p class="memory-empty" hidden>선택한 조건에 해당하는 내용이 없습니다.</p></div></div><span class="visually-hidden" id="review-save-status" role="status"></span>`;
      const search = document.querySelector('#review-search');
      const emphasisOnly = document.querySelector('#emphasis-only');
      const unlearnedOnly = document.querySelector('#unlearned-only');
      const eraSelect = document.querySelector('#review-era-select');
      function update() {
        const query = normalize(search.value.trim());
        let visible = 0;
        cards.forEach(card => {
          const element = document.querySelector(`[data-card="${card.id}"]`);
          element.hidden = (selectedEra !== 'all' && card.era !== selectedEra) || (emphasisOnly.checked && !card.emphasis) || (unlearnedOnly.checked && learned.has(card.id)) || !searchable.get(card.id).includes(query);
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
        document.querySelector('#review-progress').textContent = `${learned.size} / ${cards.length}개 외웠어요`;
        document.querySelector('#review-count').textContent = `${visible}개${emphasisOnly.checked ? ' · 집중 암기' : ''}`;
        document.querySelector('.memory-empty').hidden = visible !== 0;
        document.querySelectorAll('[data-era]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.era === selectedEra)));
        eraSelect.value = selectedEra;
      }
      document.querySelectorAll('[data-era]').forEach(button => button.addEventListener('click', () => { selectedEra = button.dataset.era; update(); }));
      eraSelect.addEventListener('change', () => { selectedEra = eraSelect.value; update(); });
      document.querySelectorAll('[data-learned]').forEach(input => input.addEventListener('change', () => {
        if (input.checked) learned.add(input.dataset.learned); else learned.delete(input.dataset.learned);
        try { localStorage.setItem(storageKey, JSON.stringify({version:data.version,learned:[...learned]})); }
        catch { document.querySelector('#review-save-status').textContent = '현재 브라우저에서는 암기 표시를 저장할 수 없습니다.'; }
        update();
        if (unlearnedOnly.checked && input.checked) (document.querySelector('[data-card]:not([hidden]) [data-learned]') || unlearnedOnly).focus();
      }));
      document.querySelector('#hide-answers').addEventListener('click', event => {
        hideAnswers = !hideAnswers;
        revealed.clear();
        event.currentTarget.setAttribute('aria-pressed', String(hideAnswers));
        event.currentTarget.textContent = hideAnswers ? '내용 모두 보기' : '내용 가리기';
        update();
      });
      document.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
        revealed.add(button.dataset.reveal);
        update();
        document.querySelector(`[data-learned="${button.dataset.reveal}"]`).focus();
      }));
      search.addEventListener('input', update);
      emphasisOnly.addEventListener('change', update);
      unlearnedOnly.addEventListener('change', update);
      update();
    } catch(error) {
      main.innerHTML = `<div class="error-state"><h1>마지막 정리를 불러오지 못했어요.</h1><p>${esc(error.message)}</p><button class="button button-primary" id="review-retry">다시 불러오기</button></div>`;
      document.querySelector('#review-retry').addEventListener('click', () => location.reload());
    }
  }
  init();
})();
