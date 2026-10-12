"""Validate source facts and reviewed primary-topic exam references."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
read = lambda path: json.loads((ROOT / path).read_text())
selection = read('assets/data/must-know.json')
guide = read('assets/data/study-guide.json')
keywords = read('assets/data/keyword-guide.json')
facts = {fact['id']: fact for fact in guide['facts']}
keyword_facts = {fact['id']: fact for fact in keywords['facts']}
eras = {era['id'] for era in guide['eras']}
questions = {(exam['id'], question['number']) for exam in read('assets/data/exams.json') for question in exam['questions']}
assert selection['version'] == 2
assert selection['title'] == '이것만은 꼭 외우자!' and selection['basis']
assert selection['rounds'] == list(range(70, 80))
assert selection['minimumRounds'] == 6
assert 1 <= len(selection['cards']) <= 20
card_ids, concepts, answers = set(), set(), set()
for card in selection['cards']:
    assert re.fullmatch(r'must-\d{2}', card['id']) and card['id'] not in card_ids
    card_ids.add(card['id'])
    assert card['conceptId'] not in concepts
    concepts.add(card['conceptId'])
    assert card['era'] in eras
    assert card['label'] and card['cue'] and card['reason']
    assert 3 <= len(card['answer']) <= 80 and '\n' not in card['answer']
    assert card['answer'] not in answers
    answers.add(card['answer'])
    supporting = []
    for key, lookup in [('factIds', facts), ('keywordFactIds', keyword_facts)]:
        assert len(card[key]) == len(set(card[key]))
        assert all(fact_id in lookup for fact_id in card[key])
        supporting.extend(lookup[fact_id] for fact_id in card[key])
    assert supporting and card['era'] in {fact['era'] for fact in supporting}
    refs = [(ref['round'], ref['number']) for ref in card['references']]
    assert len(refs) == len(set(refs)), card['id']
    assert set(refs) <= questions
    rounds = {ref[0] for ref in refs}
    assert rounds <= set(selection['rounds'])
    assert len(rounds) >= selection['minimumRounds'], card['id']
print(f'Validated {len(card_ids)} selected themes: each directly examined in at least 6 of rounds 70–79.')
