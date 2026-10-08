'use strict';

(() => {
  const params = new URLSearchParams(location.search);
  const page = document.body.dataset.page;
  const main = document.querySelector('#main');
  const symbols = ['', '①', '②', '③', '④', '⑤'];
  const storagePrefix = 'korean-history:v1:';
  let exams = [];
  let currentExam;
  let mode = params.get('mode') === 'exam' ? 'exam' : 'instant';
  let state;
  let timerId;
  let toastId;
  let dialogBusy = false;
  let storageAvailable = true;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const key = (round, practiceMode) => `${storagePrefix}${round}:${practiceMode}`;
  const resultKey = round => `${storagePrefix}${round}:result`;
  const getStored = name => {
    try { return JSON.parse(localStorage.getItem(name)); }
    catch { return null; }
  };
  const setStored = (name, value) => {
    try { localStorage.setItem(name, JSON.stringify(value)); }
    catch { storageAvailable = false; }
  };
  const removeStored = name => {
    try { localStorage.removeItem(name); }
    catch { storageAvailable = false; }
  };
  const dateLabel = date => date ? String(date).replaceAll('-', '.') : '';
  const questionCount = exam => exam.questions.length;
  const selectedCount = (exam, progress) => exam.questions.filter(q => Number(progress?.selections?.[q.number]) >= 1 && Number(progress?.selections?.[q.number]) <= 5).length;
  const gradeLabel = score => score >= 80 ? '1급' : score >= 70 ? '2급' : score >= 60 ? '3급' : '미취득';
  function calculateScore(exam, progress) {
    const correct = exam.questions.filter(q => Number(progress?.selections?.[q.number]) === Number(q.answer));
    return { score: correct.reduce((sum, q) => sum + Number(q.points), 0), correct: correct.length, answered: selectedCount(exam, progress) };
  }
  function freshState() {
    return { selections: {}, bookmarks: [], startedAt: Date.now(), submitted: false, submittedAt: null, mode };
  }
  function normalizeState(saved) {
    const fresh = freshState();
    if (!saved || typeof saved !== 'object') return fresh;
    const selections = {};
    currentExam.questions.forEach(q => {
      const choice = Number(saved.selections?.[q.number]);
      if (Number.isInteger(choice) && choice >= 1 && choice <= 5) selections[q.number] = choice;
    });
    const numbers = new Set(currentExam.questions.map(q => q.number));
    return { ...fresh, ...saved, mode, selections, bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks.filter(number => numbers.has(number)) : [], startedAt: Number.isFinite(saved.startedAt) ? saved.startedAt : Date.now(), submitted: saved.submitted === true };
  }
  function saveState() {
    setStored(key(currentExam.id, mode), state);
    const note = document.querySelector('#save-message');
    if (note) note.textContent = storageAvailable ? '현재 브라우저에 자동 저장됨' : '브라우저 저장 불가 · 이 창에서 계속 풀 수 있어요';
  }
  function toast(message) {
    document.querySelector('.toast')?.remove();
    clearTimeout(toastId);
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.append(el);
    toastId = setTimeout(() => el.remove(), 3000);
  }
  function showError(message) {
    main.innerHTML = `<div class="error-state"><p class="eyebrow">한국사 기출연습</p><h1>시험지를 불러오지 못했어요.</h1><p>${escapeHTML(message)}</p><button class="button button-primary" id="retry-load">다시 불러오기</button> <a class="button button-ghost" href="index.html">회차 선택</a></div>`;
    document.querySelector('#retry-load').addEventListener('click', () => location.reload());
  }

  async function init() {
    try {
      const response = await fetch('assets/data/exams.json?v=20261008-explanations');
      if (!response.ok) throw new Error('자료 파일을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const data = await response.json();
      exams = (Array.isArray(data) ? data : data.exams).slice().sort((a, b) => b.id - a.id);
      if (!exams.length || exams.some(exam => !Array.isArray(exam.questions) || !exam.questions.length)) throw new Error('기출문제 자료가 비어 있습니다.');
      const requestedRound = params.get('round');
      currentExam = requestedRound === null ? exams[0] : exams.find(exam => exam.id === Number(requestedRound));
      if (!currentExam) throw new Error('해당 회차를 찾을 수 없습니다. 회차 선택 페이지에서 다시 선택해 주세요.');
      if (page === 'home') renderHome();
      else if (page === 'exam') initExam();
      else if (page === 'answers') renderAnswers();
    } catch (error) { showError(error.message || '인터넷 연결을 확인하고 다시 시도해 주세요.'); }
  }

  function renderHome() {
    let selectedMode = getStored(`${storagePrefix}preferred-mode`);
    if (!['instant', 'exam'].includes(selectedMode)) selectedMode = 'instant';
    document.querySelectorAll('input[name="practice-mode"]').forEach(input => {
      input.checked = input.value === selectedMode;
      input.closest('.mode-card').classList.toggle('selected', input.checked);
      input.addEventListener('change', () => {
        selectedMode = input.value;
        setStored(`${storagePrefix}preferred-mode`, selectedMode);
        document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('selected', card.querySelector('input').checked));
        updateRoundLinks();
      });
    });
    document.querySelector('#round-list').innerHTML = exams.map((exam, index) => `<article class="round-card"><div class="round-card-top"><span class="round-level">심화 1·2·3급</span>${index === 0 ? '<span class="latest-badge">최신 회차</span>' : ''}</div><h3>제${exam.id}회</h3><p class="round-date">${escapeHTML(dateLabel(exam.date))} 시행</p><div class="round-divider"></div><div class="round-meta"><span>${questionCount(exam)}문항</span><span>${exam.duration || 80}분 · 100점</span></div><a class="round-start" data-round="${exam.id}" href="exam.html?round=${exam.id}&mode=${selectedMode}"><span>문제 풀기</span><span aria-hidden="true">→</span></a><p class="round-progress" data-progress-round="${exam.id}" hidden></p><a class="round-answer" href="answers.html?round=${exam.id}">정답표 보기</a></article>`).join('');
    function updateRoundLinks() {
      document.querySelectorAll('.round-start').forEach(link => {
        const exam = exams.find(item => item.id === Number(link.dataset.round));
        const saved = getStored(key(exam.id, selectedMode));
        const answered = selectedCount(exam, saved);
        link.href = `exam.html?round=${exam.id}&mode=${selectedMode}`;
        const answerLink = link.closest('.round-card').querySelector('.round-answer');
        answerLink.hidden = selectedMode === 'instant';
        answerLink.style.display = selectedMode === 'instant' ? 'none' : '';
        link.querySelector('span').textContent = saved?.submitted ? '풀이 결과 보기' : answered ? '이어서 풀기' : '문제 풀기';
        const progress = document.querySelector(`[data-progress-round="${exam.id}"]`);
        progress.hidden = !answered && !saved?.submitted;
        progress.textContent = saved?.submitted ? `${calculateScore(exam, saved).score}점 · ${gradeLabel(calculateScore(exam, saved).score)}` : `${answered} / ${questionCount(exam)}문항 풀이 중`;
      });
    }
    updateRoundLinks();
  }

  function imageHTML(question, overlay = false) {
    const image = `<img class="question-image" src="${escapeHTML(question.image)}" alt="${escapeHTML(question.text || `제${currentExam.id}회 심화 ${question.number}번 원문 문제와 다섯 개 보기`)}" loading="lazy" decoding="async">`;
    const regions = question.choiceRegions;
    if (!overlay || !Array.isArray(regions) || regions.length !== 5) return image;
    const valid = regions.every(region => ['x', 'y', 'w', 'h'].every(axis => Number.isFinite(region[axis])) && region.w > 0 && region.h > 0);
    if (!valid) return image;
    return `<div class="question-image-wrap">${image}<div class="image-choice-overlays" role="radiogroup" aria-label="${question.number}번 문제 답 선택">${regions.map((region, index) => `<button type="button" class="image-choice" role="radio" data-question="${question.number}" data-choice="${index + 1}" aria-label="${index + 1}번 보기${question.options?.[index] ? `: ${escapeHTML(question.options[index])}` : ''}" aria-checked="false" tabindex="${index === 0 ? '0' : '-1'}" style="left:${Math.max(0,region.x) * 100}%;top:${Math.max(0,region.y) * 100}%;width:${Math.min(region.w,1-region.x) * 100}%;height:${Math.min(region.h,1-region.y) * 100}%"></button>`).join('')}</div></div>`;
  }
  function compactOptions(question) {
    return !question.options || question.options.every(option => !option || /^[①②③④⑤1-5]?\s*번?\s*보기$/.test(option));
  }
  function questionHTML(question) {
    return `<section class="question" id="q-${question.number}" aria-labelledby="question-title-${question.number}"><div class="question-head"><h2 id="question-title-${question.number}">${question.number}번 <small>[${question.points}점]</small></h2><button class="bookmark-button" data-bookmark="${question.number}" aria-pressed="false" aria-label="${question.number}번 문제 다시 볼 문제로 표시"><span aria-hidden="true">☆</span> 다시 보기</button></div>${imageHTML(question, true)}<div class="answer-feedback" id="feedback-${question.number}" hidden></div></section>`;
  }
  function initExam() {
    state = normalizeState(getStored(key(currentExam.id, mode)));
    document.title = `제${currentExam.id}회 심화 · ${mode === 'exam' ? '실전 시험' : '바로 채점'} · 한국사 기출연습`;
    document.querySelector('#header-answer-link').href = `answers.html?round=${currentExam.id}&mode=${mode}`;
    document.querySelector('#header-answer-link').hidden = mode === 'instant';
    main.innerHTML = `<div class="exam-breadcrumb"><a href="index.html">기출문제</a><span aria-hidden="true">/</span><span>제${currentExam.id}회 심화</span></div><div id="exam-result"></div><div class="exam-layout"><div class="exam-paper-column"><article class="exam-sheet"><div class="sheet-heading"><p class="sheet-overline">제${currentExam.id}회 · 심화 1·2·3급</p><h1>한국사능력검정시험</h1><div class="sheet-subtitle"><span>심화 문제지</span><span aria-hidden="true">│</span><span>${questionCount(currentExam)}문항 · 100점</span></div></div><div class="sheet-information"><span>시험일 ${escapeHTML(dateLabel(currentExam.date))}</span><span class="mode-tag">${mode === 'exam' ? '실전 시험 모드' : '바로 채점 모드'}</span><span>시험 시간 ${currentExam.duration || 80}분</span></div><p class="exam-help">${mode === 'instant' ? '선지를 클릭하면 모든 보기의 해설을 확인할 수 있어요.' : '모든 문제를 푼 뒤 답안 제출을 누르세요. 정답과 점수는 제출 후에 공개됩니다. 제한 시간이 끝나면 자동으로 제출됩니다.'} 풀이 기록은 자동 저장됩니다.</p><div class="mobile-status"><span id="mobile-progress"></span>${mode === 'exam' ? '<span id="mobile-timer" class="mobile-time"></span>' : ''}<button class="mobile-omr-link" id="jump-omr">답안지 ↑</button></div><div id="questions">${currentExam.questions.map(questionHTML).join('')}</div><div class="sheet-end"><p>— 제${currentExam.id}회 심화 문제 끝 —</p><button class="button button-primary" id="end-submit">${mode === 'exam' ? '답안 제출하고 점수 보기' : '채점하고 점수 보기'}</button></div></article></div><aside class="exam-sidebar" aria-label="답안지와 풀이 현황"><div class="control-panel" id="omr-panel"><div class="panel-head"><strong>나의 답안지</strong><span class="mode-small">${mode === 'exam' ? '실전 시험' : '바로 채점'}</span></div>${mode === 'exam' ? '<div class="timer-area"><span class="timer-caption">남은 시험 시간</span><div class="timer-value" id="timer" role="timer" aria-live="off">80:00</div></div>' : ''}<div class="progress-line"><span>풀이 진행</span><strong id="progress-text"></strong></div><div class="progress-track" role="progressbar" aria-label="풀이 진행률" aria-valuemin="0" aria-valuemax="${questionCount(currentExam)}" aria-valuenow="0"><div class="progress-fill"></div></div><div class="omr-grid">${currentExam.questions.map(q => `<button class="omr-button" data-jump="${q.number}" aria-label="${q.number}번 문제로 이동">${q.number}</button>`).join('')}</div><div class="omr-legend"><span><i class="legend-dot"></i>선택한 답</span><span><i class="legend-dot empty"></i>미선택</span><span><i class="legend-dot flag"></i>다시 보기</span></div><div class="panel-actions"><button class="button button-primary panel-submit" id="submit-exam">${mode === 'exam' ? '답안 제출' : '채점하기'}</button><div class="panel-tools">${mode === 'exam' ? `<a class="text-button" href="answers.html?round=${currentExam.id}&mode=${mode}">정답표</a>` : ''}<button class="text-button" id="reset-exam">처음부터</button></div></div><p class="save-note"><span class="save-dot" aria-hidden="true"></span><span id="save-message">현재 브라우저에 자동 저장됨</span></p></div><p class="sidebar-note">문항 번호를 누르면 해당 문제로 이동합니다.<br>별표를 눌러 다시 볼 문제를 표시하세요.<br><a href="${escapeHTML(currentExam.source?.paper || 'https://www.historyexam.go.kr')}" target="_blank" rel="noopener noreferrer">원본 문제지 보기 ↗</a></p></aside></div>`;
    document.querySelectorAll('.image-choice').forEach(button => {
      button.addEventListener('click', () => selectAnswer(Number(button.dataset.question), Number(button.dataset.choice)));
      button.addEventListener('keydown', event => {
        const directions = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(event.key in directions) && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...button.parentElement.querySelectorAll('.image-choice')];
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 4 : (buttons.indexOf(button) + directions[event.key] + 5) % 5;
        if (buttons[next].disabled) return;
        buttons[next].focus();
        selectAnswer(Number(button.dataset.question), next + 1);
      });
    });
    document.querySelectorAll('[data-bookmark]').forEach(button => button.addEventListener('click', () => {
      const number = Number(button.dataset.bookmark);
      state.bookmarks = state.bookmarks.includes(number) ? state.bookmarks.filter(n => n !== number) : [...state.bookmarks, number];
      saveState();
      updateQuestion(currentExam.questions.find(q => q.number === number));
      updateProgress();
    }));
    document.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => {
      const q = document.querySelector(`#q-${button.dataset.jump}`);
      q.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const heading = q.querySelector('h2');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }));
    document.querySelector('#jump-omr').addEventListener('click', () => {
      document.querySelector('#omr-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelector('.omr-button').focus({ preventScroll: true });
    });
    document.querySelector('#submit-exam').addEventListener('click', () => requestSubmit());
    document.querySelector('#end-submit').addEventListener('click', () => requestSubmit());
    document.querySelector('#reset-exam').addEventListener('click', requestReset);
    initImageErrors();
    currentExam.questions.forEach(updateQuestion);
    updateProgress();
    saveState();
    if (state.submitted) showResult();
    if (mode === 'exam') {
      updateTimer();
      if (!state.submitted) timerId = setInterval(updateTimer, 1000);
    }
  }
  function selectAnswer(number, choice) {
    if (state.submitted && mode === 'exam') return;
    state.selections[number] = choice;
    saveState();
    updateQuestion(currentExam.questions.find(q => q.number === number));
    updateProgress();
    if (state.submitted) {
      setStored(resultKey(currentExam.id), { ...state, mode });
      showResult();
    }
  }
  function explanationsHTML(question, selected) {
    const explanations = Array.isArray(question.explanations) ? question.explanations : [];
    const sources = Array.isArray(question.explanationSources) ? question.explanationSources : [];
    return `<div class="choice-explanations"><h3>보기별 해설</h3>${question.keyExplanation ? `<p class="key-explanation">${escapeHTML(question.keyExplanation)}</p>` : ''}<ol>${Array.from({ length: 5 }, (_, index) => {
      const correct = index + 1 === Number(question.answer);
      const chosen = index + 1 === selected;
      const option = question.options?.[index];
      return `<li class="explanation-item${correct ? ' is-correct' : ''}${chosen ? ' is-selected' : ''}"><div class="explanation-item-head"><span class="explanation-number" aria-hidden="true">${symbols[index + 1]}</span><strong>${correct ? '정답' : '오답'}${chosen ? ' · 내가 선택한 보기' : ''}</strong></div>${option && !compactOptions(question) ? `<p class="explanation-option">${escapeHTML(option)}</p>` : ''}<p>${escapeHTML(explanations[index] || '이 보기의 해설을 준비하고 있습니다.')}</p></li>`;
    }).join('')}</ol>${sources.length ? `<details class="explanation-sources"><summary>해설 참고 자료</summary><ul>${sources.map(source => `<li><a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title)} ↗</a></li>`).join('')}</ul></details>` : ''}</div>`;
  }
  function updateQuestion(question) {
    const section = document.querySelector(`#q-${question.number}`);
    const selected = Number(state.selections[question.number]);
    const reveal = state.submitted || (mode === 'instant' && selected >= 1);
    section.querySelectorAll('.image-choice').forEach(button => {
      const option = Number(button.dataset.choice);
      button.disabled = state.submitted && mode === 'exam';
      button.setAttribute('aria-checked', option === selected ? 'true' : 'false');
      button.tabIndex = option === (selected || 1) ? 0 : -1;
      button.classList.toggle('selected', option === selected);
      button.classList.toggle('correct', reveal && option === Number(question.answer));
      button.classList.toggle('incorrect', reveal && option === selected && option !== Number(question.answer));
    });
    const feedback = section.querySelector('.answer-feedback');
    feedback.hidden = !reveal;
    if (reveal) {
      const correct = selected === Number(question.answer);
      feedback.classList.toggle('wrong', !correct);
      feedback.innerHTML = `<div class="feedback-status" role="status"><strong>${correct ? '정답입니다.' : selected ? '다시 확인해 보세요.' : '선택하지 않은 문항입니다.'}</strong><span>공식 정답 ${symbols[question.answer]}${correct ? ` · ${question.points}점` : ''}</span></div>${explanationsHTML(question, selected)}`;
    }
    const bookmarked = state.bookmarks.includes(question.number);
    const bookmark = section.querySelector('.bookmark-button');
    bookmark.setAttribute('aria-pressed', String(bookmarked));
    bookmark.querySelector('span').textContent = bookmarked ? '★' : '☆';
    bookmark.setAttribute('aria-label', `${question.number}번 문제 다시 보기 ${bookmarked ? '표시 해제' : '표시'}`);
  }
  function updateProgress() {
    const count = selectedCount(currentExam, state);
    const total = questionCount(currentExam);
    document.querySelector('#progress-text').textContent = `${count} / ${total}문항`;
    document.querySelector('#mobile-progress').textContent = `${state.submitted ? '채점 완료' : '풀이 중'} · ${count} / ${total}`;
    const progressbar = document.querySelector('.progress-track');
    progressbar.setAttribute('aria-valuenow', String(count));
    progressbar.setAttribute('aria-valuetext', `${total}문항 중 ${count}문항 선택`);
    document.querySelector('.progress-fill').style.width = `${count / total * 100}%`;
    currentExam.questions.forEach(question => {
      const button = document.querySelector(`[data-jump="${question.number}"]`);
      const selected = Number(state.selections[question.number]);
      const reveal = state.submitted || (mode === 'instant' && selected >= 1);
      button.classList.toggle('answered', selected >= 1);
      button.classList.toggle('correct', reveal && selected === Number(question.answer));
      button.classList.toggle('incorrect', reveal && selected !== Number(question.answer));
      button.classList.toggle('bookmarked', state.bookmarks.includes(question.number));
      button.setAttribute('aria-label', `${question.number}번 문제로 이동, ${selected ? `${selected}번 선택` : '미선택'}${reveal ? selected === Number(question.answer) ? ', 정답' : ', 오답' : ''}${state.bookmarks.includes(question.number) ? ', 다시 보기 표시' : ''}`);
    });
    document.querySelector('#submit-exam').textContent = state.submitted ? mode === 'exam' ? '정답표 보기' : '처음부터 다시 풀기' : mode === 'exam' ? '답안 제출' : '채점하기';
    document.querySelector('#end-submit').textContent = state.submitted ? mode === 'exam' ? '정답표와 내 답안 보기' : '처음부터 다시 풀기' : mode === 'exam' ? '답안 제출하고 점수 보기' : '채점하고 점수 보기';
  }
  function updateTimer() {
    if (mode !== 'exam') return;
    const end = state.startedAt + (currentExam.duration || 80) * 60000;
    const remaining = state.submitted ? Math.max(0, end - (state.submittedAt || Date.now())) : Math.max(0, end - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    const label = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    document.querySelector('#timer').textContent = label;
    document.querySelector('#mobile-timer').textContent = label;
    document.querySelector('.timer-caption').textContent = state.submitted ? '제출 시 남은 시간' : '남은 시험 시간';
    document.querySelector('.timer-area').classList.toggle('urgent', !state.submitted && seconds <= 300);
    if (!state.submitted && seconds <= 0) {
      document.querySelector('#action-dialog')?.close('cancel');
      submitExam(true);
    }
  }
  function confirmAction(title, message, confirmText) {
    const dialog = document.querySelector('#action-dialog');
    if (dialogBusy) return Promise.resolve(false);
    dialogBusy = true;
    document.querySelector('#dialog-title').textContent = title;
    document.querySelector('#dialog-message').textContent = message;
    document.querySelector('#dialog-confirm').textContent = confirmText;
    return new Promise(resolve => {
      dialog.addEventListener('close', () => { dialogBusy = false; resolve(dialog.returnValue === 'confirm'); }, { once: true });
      dialog.returnValue = '';
      dialog.showModal();
      dialog.querySelector('[value="cancel"]').focus();
    });
  }
  async function requestSubmit() {
    if (state.submitted) {
      if (mode === 'instant') requestReset();
      else location.href = `answers.html?round=${currentExam.id}&mode=${mode}`;
      return;
    }
    const unanswered = questionCount(currentExam) - selectedCount(currentExam, state);
    const confirmed = await confirmAction('답안을 제출할까요?', `${unanswered ? `아직 선택하지 않은 ${unanswered}문항은 0점으로 처리됩니다.\n` : `${questionCount(currentExam)}문항의 답을 모두 선택했습니다.\n`}제출하면 최종 점수와 등급을 확인할 수 있어요.${mode === 'instant' ? ' 제출 후에도 선지를 클릭하며 복습할 수 있습니다.' : ' 다시 풀려면 처음부터 시작하세요.'}`, '제출하고 채점하기');
    if (confirmed && !state.submitted) submitExam(false);
  }
  function submitExam(timedOut) {
    if (state.submitted) return;
    state.submitted = true;
    state.submittedAt = Date.now();
    state.timedOut = timedOut;
    saveState();
    setStored(resultKey(currentExam.id), { ...state, mode });
    clearInterval(timerId);
    currentExam.questions.forEach(updateQuestion);
    updateProgress();
    updateTimer();
    showResult();
    document.querySelector('#exam-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const resultHeading = document.querySelector('#result-heading');
    resultHeading.tabIndex = -1;
    resultHeading.focus({ preventScroll: true });
    if (timedOut) toast('시험 시간이 끝나 답안이 자동 제출되었습니다.');
  }
  function resultHTML(progress, withReset) {
    const { score, correct, answered } = calculateScore(currentExam, progress);
    return `<section class="result-banner" aria-labelledby="result-heading"><div><span class="result-label">제${currentExam.id}회 심화 · ${progress.mode === 'exam' ? '실전 시험' : '바로 채점'} 결과</span><h2 id="result-heading">${score >= 60 ? `${gradeLabel(score)} 기준을 달성했어요.` : '다음 도전을 준비해 보세요.'}</h2><p>${questionCount(currentExam)}문항 중 ${correct}문항 정답${answered < questionCount(currentExam) ? ` · ${questionCount(currentExam) - answered}문항 미선택` : ''}${progress.timedOut ? ' · 시간 종료로 자동 제출' : ''}</p>${withReset ? `<div class="result-actions">${mode === 'exam' ? `<a class="button button-secondary" href="answers.html?round=${currentExam.id}&mode=${mode}">정답표와 내 답안 보기 →</a>` : ''}<button class="button button-ghost" id="result-reset">다시 풀기</button></div>` : ''}</div><div class="result-score">${score}<small>/ 100</small></div></section>`;
  }
  function showResult() {
    document.querySelector('#exam-result').innerHTML = resultHTML(state, true);
    document.querySelector('#result-reset').addEventListener('click', requestReset);
  }
  async function requestReset() {
    if (!await confirmAction('처음부터 다시 풀까요?', `제${currentExam.id}회 ${mode === 'exam' ? '실전 시험' : '바로 채점'}의 선택한 답, 다시 보기 표시, 점수가 초기화됩니다.${mode === 'exam' ? '\n시험 시간도 80분부터 다시 시작합니다.' : ''}`, '초기화하고 다시 풀기')) return;
    clearInterval(timerId);
    removeStored(key(currentExam.id, mode));
    if (getStored(resultKey(currentExam.id))?.mode === mode) removeStored(resultKey(currentExam.id));
    initExam();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('새 시험지를 준비했어요.');
  }
  function initImageErrors() {
    document.querySelectorAll('.question-image').forEach(image => image.addEventListener('error', () => {
      const wrap = image.closest('.question-image-wrap');
      const fallback = document.createElement('div');
      fallback.className = 'image-missing';
      fallback.innerHTML = `문제 이미지를 불러오지 못했습니다.<br><a class="question-source-link" href="${escapeHTML(currentExam.source?.paper || 'https://www.historyexam.go.kr')}" target="_blank" rel="noopener noreferrer">원본 문제지에서 확인하기 ↗</a>`;
      (wrap || image).replaceWith(fallback);
    }, { once: true }));
  }

  function submittedResult() {
    if (params.has('mode')) {
      const saved = getStored(key(currentExam.id, mode));
      if (saved?.submitted) return { ...saved, mode };
      return null;
    }
    const latest = getStored(resultKey(currentExam.id));
    if (latest?.submitted) return latest;
    const alternatives = ['instant', 'exam'].map(practiceMode => {
      const saved = getStored(key(currentExam.id, practiceMode));
      return saved?.submitted ? { ...saved, mode: practiceMode } : null;
    }).filter(Boolean).sort((a, b) => b.submittedAt - a.submittedAt);
    return alternatives[0] || null;
  }
  function renderAnswers() {
    document.title = `제${currentExam.id}회 심화 정답표 · 한국사 기출연습`;
    const result = submittedResult();
    main.innerHTML = `<div class="answers-heading"><div><p class="eyebrow">OFFICIAL ANSWER SHEET</p><h1>제${currentExam.id}회 심화 정답표</h1><p>${escapeHTML(dateLabel(currentExam.date))} 시행 · 공식 정답과 나의 답안을 함께 확인하세요.</p></div><div class="answers-heading-actions"><button class="button button-ghost" id="print-answers">정답표 인쇄</button> <a class="button button-primary" href="exam.html?round=${currentExam.id}&mode=${result?.mode || mode}">문제 풀기 →</a></div></div><div class="answers-toolbar"><label class="round-select-label" for="answer-round">회차 선택<select id="answer-round">${exams.map(exam => `<option value="${exam.id}"${exam.id === currentExam.id ? ' selected' : ''}>제${exam.id}회 심화</option>`).join('')}</select></label><div class="answer-filter" aria-label="정답표 필터"><button class="filter-button" id="filter-all" aria-pressed="true">전체 문항</button><button class="filter-button" id="filter-wrong" aria-pressed="false"${!result ? ' disabled' : ''}>오답·미선택${result ? ` ${questionCount(currentExam) - calculateScore(currentExam,result).correct}` : ''}</button></div></div>${result ? resultHTML(result, false) : '<p class="no-result-note">아직 제출한 답안이 없습니다. 공식 정답을 먼저 확인하거나, 문제를 풀고 제출하면 나의 답안과 점수가 함께 표시됩니다.</p>'}<section aria-label="공식 정답 한눈에 보기" class="answer-summary">${Array.from({ length: Math.ceil(questionCount(currentExam) / 10) }, (_, group) => { const questions = currentExam.questions.slice(group * 10, group * 10 + 10); return `<div class="answer-mini-group"><h2>${questions[0].number}–${questions.at(-1).number}번</h2><div class="answer-mini-rows">${questions.map(q => `<a class="answer-mini-row${result && Number(result.selections?.[q.number]) !== Number(q.answer) ? ' wrong' : ''}" href="#answer-${q.number}" data-open-answer="${q.number}" aria-label="${q.number}번 공식 정답 ${q.answer}번, 문제 펼치기"><span>${String(q.number).padStart(2,'0')}</span><strong>${symbols[q.answer]}</strong></a>`).join('')}</div></div>`; }).join('')}</section><h2 class="answer-section-heading">문항별 정답 확인</h2><div id="answer-list" class="answer-list">${currentExam.questions.map(q => answerRowHTML(q, result)).join('')}</div><p class="answer-source"><span>공식 정답 기준 · 문항을 누르면 원문 문제를 볼 수 있습니다.</span><span class="source-links">${currentExam.source?.paper ? `<a href="${escapeHTML(currentExam.source.paper)}" target="_blank" rel="noopener noreferrer">원본 문제지 ↗</a>` : ''}${currentExam.source?.answers ? `<a href="${escapeHTML(currentExam.source.answers)}" target="_blank" rel="noopener noreferrer">공식 정답표 ↗</a>` : ''}</span></p>`;
    document.querySelector('#answer-round').addEventListener('change', event => { location.href = `answers.html?round=${event.target.value}`; });
    document.querySelector('#print-answers').addEventListener('click', () => window.print());
    document.querySelector('#filter-all').addEventListener('click', () => filterAnswers(false, result));
    document.querySelector('#filter-wrong').addEventListener('click', () => filterAnswers(true, result));
    document.querySelectorAll('[data-open-answer]').forEach(link => link.addEventListener('click', () => {
      filterAnswers(false, result);
      document.querySelector(`#answer-${link.dataset.openAnswer}`).open = true;
    }));
    initImageErrors();
    const hashNumber = location.hash.match(/^#answer-(\d+)$/)?.[1];
    if (hashNumber) {
      const detail = document.querySelector(`#answer-${hashNumber}`);
      if (detail) { detail.open = true; requestAnimationFrame(() => detail.scrollIntoView({ block: 'start' })); }
    }
  }
  function answerRowHTML(question, result) {
    const selected = Number(result?.selections?.[question.number]);
    const correct = selected === Number(question.answer);
    return `<details class="answer-row" id="answer-${question.number}" data-answer-number="${question.number}"><summary><span class="answer-question-number">${question.number}번<small>${question.points}점</small></span><span><span class="answer-item-label">공식 정답</span><strong class="answer-choice-number">${symbols[question.answer]}</strong></span><span><span class="answer-item-label">내가 선택한 답</span><span class="answer-choice-number">${selected ? symbols[selected] : '—'}</span></span><span class="answer-status${result ? correct ? ' correct' : ' wrong' : ''}">${!result ? '답안 없음' : correct ? '정답' : selected ? '오답' : '미선택'}</span></summary><div class="answer-detail">${imageHTML(question)}<p class="answer-detail-note"><span>공식 정답 <strong>${symbols[question.answer]}</strong></span><span>배점 ${question.points}점</span>${result ? `<span>내 점수 ${correct ? question.points : 0}점</span>` : ''}</p>${explanationsHTML(question, selected)}</div></details>`;
  }
  function filterAnswers(wrongOnly, result) {
    document.querySelector('#filter-all').setAttribute('aria-pressed', String(!wrongOnly));
    document.querySelector('#filter-wrong').setAttribute('aria-pressed', String(wrongOnly));
    document.querySelector('.answer-empty')?.remove();
    let shown = 0;
    currentExam.questions.forEach(question => {
      const detail = document.querySelector(`#answer-${question.number}`);
      const wrong = result && Number(result.selections?.[question.number]) !== Number(question.answer);
      detail.hidden = wrongOnly && !wrong;
      if (!detail.hidden) shown++;
    });
    if (!shown) {
      const empty = document.createElement('p');
      empty.className = 'answer-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = '모든 문항을 맞혔어요. 확인할 오답이 없습니다.';
      document.querySelector('#answer-list').append(empty);
    }
  }
  init();
})();
