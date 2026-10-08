"""Build the complete keyword library from reviewed, canonical choice notes."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(path):
    return json.loads((ROOT / path).read_text())


def build():
    exams = read('assets/data/exams.json')
    mapping = read('scripts/data/keyword-notes.json')
    aliases = read('scripts/data/keyword-aliases.json')
    notes = {note for exam in exams for q in exam['questions'] for note in q['shortExplanations']}
    assert set(mapping) == notes, 'Keyword review must cover every current choice note.'
    eras = read('assets/data/study-guide.json')['eras'] + [{'id': 'shared', 'label': '시대 공통'}]
    era_order = {era['id']: index for index, era in enumerate(eras)}
    normalized = lambda value: re.sub(r'\s+', '', value).rstrip('.')
    facts = {}
    excluded = []
    for note, review in sorted(mapping.items()):
        if 'skip' in review:
            assert review['skip']
            excluded.append({'note': note, 'reason': review['skip']})
            continue
        assert review['facts'], f'No facts for {note}'
        for fact in review['facts']:
            fact = {**fact, 'text': aliases['textAliases'].get(fact['text'], fact['text']),
                    'keyword': aliases['keywordAliases'].get(fact['keyword'], fact['keyword'])}
            assert fact['era'] in era_order, fact
            key = (fact['era'], normalized(fact['text']))
            if key not in facts:
                facts[key] = {**fact, 'noteAliases': set(), 'keywords': {}}
            entry = facts[key]
            entry['noteAliases'].add(note)
            keyword_key = normalized(fact['keyword'])
            entry['keywords'].setdefault(keyword_key, fact['keyword'])
    # Headwords with different spacing still form a single keyword group.
    labels = {}
    for entry in facts.values():
        keyword = next(iter(entry['keywords'].values()))
        labels.setdefault((entry['era'], normalized(keyword)), keyword)
    result = []
    for entry in facts.values():
        keyword = next(iter(entry['keywords'].values()))
        result.append({'era': entry['era'], 'keyword': labels[(entry['era'], normalized(keyword))],
                       'text': entry['text'], 'noteAliases': sorted(entry['noteAliases'])})
    result.sort(key=lambda fact: (era_order[fact['era']], normalized(fact['keyword']), fact['text']))
    for index, fact in enumerate(result, 1):
        fact['id'] = f'keyword-fact-{index:04}'
    return {'version': '2026-10-09-all-keywords', 'roundIds': sorted(exam['id'] for exam in exams),
            'eras': eras, 'facts': result, 'excludedNotes': excluded}


if __name__ == '__main__':
    guide = build()
    (ROOT / 'assets/data/keyword-guide.json').write_text(json.dumps(guide, ensure_ascii=False, indent=2) + '\n')
    print(f"Built {len(guide['facts'])} keyword facts from all choice notes.")
