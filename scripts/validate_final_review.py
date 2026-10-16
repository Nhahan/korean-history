"""Validate lecture-based review content and renderable highlights."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'assets/data/final-review.json').read_text())
assert isinstance(data['version'], int) and data['version'] > 0
assert data['source']['url'] == 'https://www.youtube.com/watch?v=L-hgLH4_7YI'
assert data['source']['author'] == '공부돼지'
eras = [era['id'] for era in data['eras']]
assert len(eras) == len(set(eras)) == 10
cards = data['cards']
assert cards and len({c['id'] for c in cards}) == len(cards)
assert set(c['era'] for c in cards) == set(eras)
for card in cards:
    assert re.fullmatch(r'lecture-[a-z0-9-]+', card['id']), card['id']
    assert card['title'] and isinstance(card['emphasis'], bool)
    assert 0 < len(card['sourceCue']) <= 60, card['id']
    assert 1 <= len(card['rows']) <= 5, card['id']
    for row in card['rows']:
        assert 0 < len(row['term']) <= 24, (card['id'], row)
        assert 0 < len(row['detail']) <= 85, (card['id'], row)
    sequence = card.get('sequence', [])
    assert not sequence or (len(sequence) >= 2 and all(isinstance(s, str) and s for s in sequence))
    text = '\n'.join([s for row in card['rows'] for s in row.values()] + sequence)
    assert card['highlights'] and len(card['highlights']) == len(set(card['highlights']))
    for word in card['highlights']:
        assert word and word in text, (card['id'], word)
for correction in data['corrections']:
    assert correction['issue'] and correction['correction']
    if 'sourceUrl' in correction:
        assert correction['sourceUrl'].startswith('https://'), correction
print(f"Lecture review: {len(cards)} cards, {len(eras)} eras, {sum(c['emphasis'] for c in cards)} emphasized; valid.")
