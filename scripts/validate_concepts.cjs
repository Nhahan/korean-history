// Exercise the app's actual concept matcher against every reviewed study note.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace('  init();\n})();',
  `globalThis.qa = { prepare(value) { exams = value; prepareFrequentConcepts(); }, render: highlightedNoteHTML, matcher() { return conceptMatcher; }, frequent: frequentConcepts };\n})();`);
const context = { URLSearchParams, location: { search: '' }, document: { body: { dataset: { page: 'concepts' } }, querySelector() { return null; } } };
vm.runInNewContext(source, context);
const data = readJSON('assets/data/exams.json');
context.qa.prepare(data);
const taxonomy = readJSON('assets/data/concept-eras.json');
const aliases = readJSON('scripts/data/short-note-aliases.json');
const defaults = new Map(taxonomy.eras.flatMap(era => era.terms.map(term => [term, era.id])));
const eraIDs = new Set(taxonomy.eras.map(era => era.id));
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
    for (const note of question.shortExplanations) {
      assert(!Object.hasOwn(aliases, note), `Noncanonical note: ${note}`);
      const eras = new Set();
      for (const match of note.matchAll(context.qa.matcher())) {
        const concept = match[0].replace(/\s/g, '');
        if (!context.qa.frequent.has(concept)) continue;
        marked.add(concept);
        facts.add(note);
        assert(defaults.has(concept), `Missing era: ${concept}`);
        const era = taxonomy.noteEras?.[`${concept}|${note}`] || defaults.get(concept);
        assert(eraIDs.has(era), `Invalid era: ${era}`);
        if (taxonomy.ambiguous[concept]) assert(taxonomy.noteEras[`${concept}|${note}`], `Unclassified ambiguous note: ${concept}|${note}`);
        eras.add(era);
        classified++;
      }
      if (taxonomy.notePeriods?.[note]) {
        assert(eraIDs.has(taxonomy.notePeriods[note]));
      } else {
        assert(eras.size <= 1, `Fact would be repeated across eras: ${note}`);
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
console.log(`Validated ${marked.size} highlighted concepts / ${classified} occurrences / ${facts.size} distinct study facts / ${taxonomy.eras.length} periods / ${Object.keys(aliases).length} reviewed aliases.`);
