// Exercise the app's actual concept matcher against every reviewed study note.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace('  init();\n})();',
  `globalThis.qa = { prepare(value) { exams = value; prepareFrequentConcepts(); }, render: highlightedNoteHTML, matcher() { return conceptMatcher; }, frequent: frequentConcepts, frequency: conceptFrequency };\n})();`);
const context = { URLSearchParams, location: { search: '' }, document: { body: { dataset: { page: 'concepts' } }, querySelector() { return null; } } };
vm.runInNewContext(source, context);
// Repetition within one question is not a second appearance. Two different
// questions qualify even when both belong to the same round.
const repeatedQuestion = { text: '간석기 간석기', shortKeyExplanation: '간석기', options: ['간석기'], shortExplanations: ['간석기'] };
context.qa.prepare([{ id: 79, questions: [repeatedQuestion] }]);
assert.equal(context.qa.frequency.get('간석기').questions, 1);
assert(!context.qa.render('간석기').includes('<mark'));
context.qa.prepare([{ id: 79, questions: [repeatedQuestion, repeatedQuestion] }]);
assert.equal(context.qa.frequency.get('간석기').questions, 2);
assert(context.qa.render('간석기').includes('data-question-count="2"'));
assert(context.qa.render('간석기').includes('data-round-count="1"'));
const data = readJSON('assets/data/exams.json');
context.qa.prepare(data);
const taxonomy = readJSON('assets/data/concept-eras.json');
const aliases = readJSON('scripts/data/short-note-aliases.json');
const eraIDs = new Set(taxonomy.eras.map(era => era.id));
// The historical note taxonomy is independent of the current highlight cutoff.
// The complete keyword library has its own exhaustive period validator.
for (const era of Object.values(taxonomy.noteEras || {})) assert(eraIDs.has(era));
for (const era of Object.values(taxonomy.notePeriods || {})) assert(eraIDs.has(era));
const marked = new Set();
const facts = new Set();
let classified = 0;
for (const [old, canonical] of Object.entries(aliases)) {
  assert.notEqual(old, canonical);
  assert(!Object.hasOwn(aliases, canonical), `Unresolved alias: ${old}`);
  assert(canonical.length >= 4 && canonical.length <= 26);
}
for (const exam of data) {
  const manuscript = readJSON(`assets/explanations/${exam.id}-short.json`);
  for (const question of exam.questions) {
    assert.deepEqual(question.shortExplanations, manuscript.questions.find(q => q.number === question.number).shortExplanations);
    assert.equal(question.shortKeyExplanation, manuscript.questions.find(q => q.number === question.number).shortKeyExplanation);
    for (const note of question.shortExplanations) {
      assert(!Object.hasOwn(aliases, note), `Noncanonical note: ${note}`);
      for (const match of note.matchAll(context.qa.matcher())) {
        const concept = match[0].replace(/\s/g, '');
        if (!context.qa.frequent.has(concept)) continue;
        marked.add(concept);
        facts.add(note);
        assert(context.qa.frequency.get(concept).questions >= 2, `Highlighted singleton: ${concept}`);
        classified++;
      }
    }
  }
}
assert(!context.qa.render('천태종').includes('<mark'));
assert(!context.qa.render('의천의 천태종 개창은 숙종 때.').includes('data-concept="태종"'));
assert(!context.qa.render('정조의 상업').includes('data-concept="의상"'));
assert(context.qa.render('태조 왕건').includes('data-concept="왕건"'));
const expected = '대한 자강회는 고종 퇴위에 반대.';
assert.equal(aliases['고종 퇴위 반대는 대한자강회.'], expected);
console.log(`Validated two-question threshold / ${marked.size} highlighted concepts / ${classified} occurrences / ${facts.size} distinct highlighted note sentences / ${Object.keys(aliases).length} reviewed aliases.`);
