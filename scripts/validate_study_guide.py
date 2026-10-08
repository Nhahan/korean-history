"""Validate the curated study curriculum, sources and exact exam-note links."""
import json
import re
from collections import Counter
from pathlib import Path

from validate_data import primary_source_url

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ERAS = [
    'paleolithic', 'neolithic', 'bronze', 'iron', 'gojoseon', 'buyeo',
    'goguryeo', 'okjeo', 'dongye', 'samhan', 'baekje', 'silla', 'gaya',
    'unified-silla', 'balhae', 'later-three-kingdoms', 'goryeo', 'joseon',
    'opening', 'empire', 'colonial', 'contemporary',
]


def validate():
    guide = json.loads((ROOT / 'assets/data/study-guide.json').read_text())
    exams = json.loads((ROOT / 'assets/data/exams.json').read_text())
    notes = {note for exam in exams for q in exam['questions'] for note in q['shortExplanations']}
    assert [era['id'] for era in guide['eras']] == EXPECTED_ERAS
    sources = {source['id']: source for source in guide['sources']}
    assert len(sources) == len(guide['sources'])
    for source in sources.values():
        assert source['title'].strip() and primary_source_url(source['url']), source
    ids, sentences = set(), set()
    counts = Counter()
    categories = {}
    linked = 0
    for fact in guide['facts']:
        assert fact['id'] not in ids, fact['id']
        ids.add(fact['id'])
        assert fact['era'] in EXPECTED_ERAS, fact
        assert fact['category'].strip(), fact
        text = fact['text']
        assert 4 <= len(text) <= 32 and not re.search(r'[\r\n\u2028\u2029]', text), fact
        normalized = re.sub(r'[\s.,:·]', '', text)
        assert normalized not in sentences, f'Duplicate fact: {text}'
        sentences.add(normalized)
        assert fact['sourceIds'] and set(fact['sourceIds']) <= sources.keys(), fact
        assert set(fact['noteAliases']) <= notes, f'Unknown note alias: {fact}'
        counts[fact['era']] += 1
        categories.setdefault(fact['era'], set()).add(fact['category'])
        linked += bool(fact['noteAliases'] or text in notes)
    for era in EXPECTED_ERAS:
        assert counts[era] > 0, f'Missing period: {era}'
    # Retain the few basic distinctions needed to tell prehistoric periods apart.
    for era, terms in {
        'paleolithic': ['뗀석기', '사냥', '채집', '동굴', '막집', '이동', '주먹도끼'],
        'neolithic': ['간석기', '빗살무늬', '농경', '목축', '움집', '정착', '가락바퀴', '뼈바늘'],
        'bronze': ['벼농사', '반달돌칼', '비파형동검', '고인돌', '계급'],
        'iron': ['철제', '세형동검', '명도전'],
    }.items():
        text = re.sub(r'\s', '', ' '.join(f['text'] for f in guide['facts'] if f['era'] == era))
        for term in terms:
            assert term in text, f'Missing basic topic: {era} / {term}'
    print(f"Validated {len(guide['facts'])} study facts / {len(counts)} periods / {len(sources)} primary sources / {linked} facts linked to exam notes.")
    print(' / '.join(f"{era['label']} {counts[era['id']]}" for era in guide['eras']))


if __name__ == '__main__':
    validate()
