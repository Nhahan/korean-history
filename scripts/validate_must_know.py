"""Validate the deliberately limited, source-linked memory selection."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda path: json.loads((ROOT / path).read_text())
selection = read('assets/data/must-know.json')
guide = read('assets/data/study-guide.json')
facts = {fact['id']: fact for fact in guide['facts']}
eras = {era['id'] for era in guide['eras']}
source_ids = {source['id'] for source in guide['sources']}
assert selection['version'] == 1
assert selection['title'] == '이것만은 꼭 외우자!' and selection['basis']
assert len(selection['cards']) == 40
card_ids, used_facts, pairs = set(), set(), set()
for card in selection['cards']:
    assert re.fullmatch(r'must-\d{2}', card['id']) and card['id'] not in card_ids
    card_ids.add(card['id'])
    assert card['era'] in eras
    assert 4 <= len(card['cue']) <= 60 and 3 <= len(card['answer']) <= 80
    assert '\n' not in card['answer'] and card['reason']
    pair = (re.sub(r'\s+', '', card['cue']), re.sub(r'\s+', '', card['answer']))
    assert pair not in pairs
    pairs.add(pair)
    assert 1 <= len(card['factIds']) <= 3
    assert len(set(card['factIds'])) == len(card['factIds'])
    assert not used_facts.intersection(card['factIds']), f'Repeated memory fact: {card["id"]}'
    used_facts.update(card['factIds'])
    assert all(fact_id in facts for fact_id in card['factIds'])
    assert card['era'] in {facts[fact_id]['era'] for fact_id in card['factIds']}
    assert all(facts[fact_id]['sourceIds'] and set(facts[fact_id]['sourceIds']) <= source_ids for fact_id in card['factIds'])
covered = {facts[fact_id]['era'] for fact_id in used_facts}
assert {'paleolithic', 'neolithic', 'goguryeo', 'baekje', 'silla', 'goryeo', 'joseon', 'opening', 'empire', 'colonial', 'contemporary'} <= covered
print(f'Validated 40 memory cards / {len(used_facts)} non-repeated source facts / {len(covered)} eras.')
