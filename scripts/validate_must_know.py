"""Validate source facts and related exam references for essential memory cards."""
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
question_notes = {(exam['id'], question['number']): set(question['shortExplanations']) for exam in read('assets/data/exams.json') for question in exam['questions']}
questions = set(question_notes)
assert selection['version'] == 3
assert selection['title'] == '이것만은 꼭 외우자!' and selection['basis']
assert selection['rounds'] == list(range(70, 80))
assert selection['selectionCriteria']
assert selection['cards']
card_ids, concepts, answers = set(), set(), set()
for card in selection['cards']:
    assert re.fullmatch(r'must-\d{3}', card['id']) and card['id'] not in card_ids
    card_ids.add(card['id'])
    assert card['conceptId'] not in concepts
    concepts.add(card['conceptId'])
    assert card['era'] in eras
    assert card['label'] and card['cue'] and card['reason']
    assert 3 <= len(card['answer']) <= 90 and '\n' not in card['answer']
    assert 1 <= len(card['displayRows']) <= 5
    for row in card['displayRows']:
        assert 1 <= len(row['term']) <= 24 and 1 <= len(row['detail']) <= 90
    assert card['highlights'] and len(card['highlights']) == len(set(card['highlights']))
    segments = [value for row in card['displayRows'] for value in row.values()]
    assert all(word and any(word in segment for segment in segments) for word in card['highlights'])
    assert card['answer'] not in answers
    answers.add(card['answer'])
    supporting = []
    for key, lookup in [('factIds', facts), ('keywordFactIds', keyword_facts)]:
        assert len(card[key]) == len(set(card[key]))
        assert all(fact_id in lookup for fact_id in card[key])
        supporting.extend(lookup[fact_id] for fact_id in card[key])
    assert all(fact.get('sourceIds') for fact in supporting if fact['id'] in facts)
    assert supporting and card['era'] in {fact['era'] for fact in supporting}
    refs = [(ref['round'], ref['number']) for ref in card['references']]
    assert len(refs) == len(set(refs)), card['id']
    assert set(refs) <= questions
    rounds = {ref[0] for ref in refs}
    assert rounds <= set(selection['rounds'])
    notes = {note for fact in supporting for note in [fact['text'], *fact.get('noteAliases', [])]}
    assert all(notes.intersection(question_notes[ref]) for ref in refs), card['id']
covered = {card['era'] for card in selection['cards']}
assert {'paleolithic', 'neolithic', 'bronze', 'gojoseon', 'goguryeo', 'baekje', 'silla', 'unified-silla', 'balhae', 'goryeo', 'joseon', 'opening', 'empire', 'colonial', 'contemporary'} <= covered
print(f'Validated {len(card_ids)} essential memory cards, source facts and related exam links across {len(covered)} eras.')
