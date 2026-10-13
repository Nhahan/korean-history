(() => {
  'use strict';
  const main = document.querySelector('#main');
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  async function init() {
    try {
      const response = await fetch('assets/data/era-questions.json?v=20261013-era-practice');
      if (!response.ok) throw new Error('시대별 자료를 가져오지 못했습니다.');
      const data = await response.json();
      let mode = new URLSearchParams(location.search).get('mode') === 'exam' ? 'exam' : 'instant';
      const groups = data.groups.map(group => ({...group, questions:data.questions.filter(question => question.group === group.id)}));
      main.innerHTML = `<header class="eras-heading"><p class="eyebrow">70~79회 · ${data.questions.length}문항</p><h1>시대별 기출</h1><p>메인 문제의 시대를 기준으로 모았습니다.</p></header>
        <fieldset class="eras-mode"><legend class="visually-hidden">채점 방식</legend><label><input type="radio" name="era-mode" value="instant"${mode === 'instant' ? ' checked' : ''}><span>바로 채점</span></label><label><input type="radio" name="era-mode" value="exam"${mode === 'exam' ? ' checked' : ''}><span>다 풀고 채점</span></label></fieldset>
        <div class="eras-grid">${groups.map((group,index) => `<article class="era-practice-card" data-era="${esc(group.id)}"><div class="era-card-top"><span>${String(index+1).padStart(2,'0')}</span><strong>${group.questions.length}문항</strong></div><h2>${esc(group.label)}</h2><p class="era-description">${esc(group.description)}</p><a class="era-start" href="exam.html?era=${esc(group.id)}&amp;mode=${mode}" data-start="${esc(group.id)}"><span>${esc(group.label)} 풀기</span><span aria-hidden="true">→</span></a><p class="era-progress" data-progress="${esc(group.id)}"></p></article>`).join('')}</div>`;
      function update() {
        groups.forEach(group => {
          document.querySelector(`[data-start="${group.id}"]`).href = `exam.html?era=${group.id}&mode=${mode}`;
          let saved;
          try { saved = JSON.parse(localStorage.getItem(`korean-history:v1:era:v${data.version}:${group.id}:${mode}`)); } catch { /* Storage is optional. */ }
          const valid = Array.from({length:group.questions.length},(_,index)=>Number(saved?.selections?.[index+1])).filter(choice=>Number.isInteger(choice) && choice>=1 && choice<=5).length;
          document.querySelector(`[data-progress="${group.id}"]`).textContent = valid ? `${saved?.submitted ? '채점 완료' : '이어 풀기'} · ${valid} / ${group.questions.length}문항` : '70~79회';
        });
      }
      document.querySelectorAll('[name="era-mode"]').forEach(input => input.addEventListener('change', () => { mode = input.value; update(); }));
      update();
    } catch(error) {
      main.innerHTML = `<div class="error-state"><h1>시대별 자료를 불러오지 못했어요.</h1><p>${esc(error.message)}</p><button class="button button-primary" id="era-retry">다시 불러오기</button></div>`;
      document.querySelector('#era-retry').addEventListener('click',()=>location.reload());
    }
  }
  init();
})();
