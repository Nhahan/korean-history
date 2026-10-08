"""Ensure the full keyword library covers all reviewed choices and stays reproducible."""
import json
import re
from collections import Counter
from pathlib import Path
from build_keyword_guide import build

ROOT = Path(__file__).resolve().parent.parent


def validate():
    guide = json.loads((ROOT / 'assets/data/keyword-guide.json').read_text())
    assert guide == build(), 'Rebuild keyword-guide.json after editing keyword notes.'
    exams = json.loads((ROOT / 'assets/data/exams.json').read_text())
    notes = {note for exam in exams for q in exam['questions'] for note in q['shortExplanations']}
    aliases = json.loads((ROOT / 'scripts/data/keyword-aliases.json').read_text())
    for mapping in aliases.values():
        assert all(old != target and target not in mapping for old, target in mapping.items()), 'Unresolved keyword alias.'
    assert guide['roundIds'] == sorted(exam['id'] for exam in exams)
    era_ids = {era['id'] for era in guide['eras']}
    core_eras = json.loads((ROOT / 'assets/data/study-guide.json').read_text())['eras']
    assert guide['eras'][:-1] == core_eras
    covered, ids, distinct = set(), set(), set()
    counts = Counter()
    for fact in guide['facts']:
        assert fact['id'] not in ids
        ids.add(fact['id'])
        assert fact['era'] in era_ids
        counts[fact['era']] += 1
        assert 1 <= len(fact['keyword']) <= 32 and '\n' not in fact['keyword']
        assert 4 <= len(fact['text']) <= 40 and '\n' not in fact['text'], fact
        key = (fact['era'], re.sub(r'\s+', '', fact['text']).rstrip('.'))
        assert key not in distinct, f'Duplicate fact: {fact}'
        distinct.add(key)
        assert fact['noteAliases'] and len(set(fact['noteAliases'])) == len(fact['noteAliases'])
        assert set(fact['noteAliases']) <= notes, fact
        covered.update(fact['noteAliases'])
    excluded = {item['note'] for item in guide['excludedNotes']}
    assert not covered & excluded
    assert covered | excluded == notes, 'Missing choice notes.'
    assert all(any(note in covered for note in q['shortExplanations']) for exam in exams for q in exam['questions']), 'Question lost all keyword references.'
    assert all(counts[era['id']] > 0 for era in core_eras), 'Missing period.'
    for note in ['대한 자강회는 고종 퇴위에 반대.', '철제 농기구는 철기 시대 도구.', '가락바퀴·뼈바늘은 신석기 옷 제작 도구.']:
        assert note in covered, f'Missing representative keyword: {note}'
    assert (ROOT / 'keywords.html').exists()
    print(f"Validated {len(guide['facts'])} facts / {len({(f['era'], f['keyword']) for f in guide['facts']})} keywords / {len(covered)} reviewed notes / {len(excluded)} question-specific notes excluded.")


if __name__ == '__main__':
    validate()
