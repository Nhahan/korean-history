"""Check full choice review coverage, attribution provenance and reproducibility."""
import json
from build_king_quiz import ROOT, build, normalize

data = json.loads((ROOT / 'assets/data/king-quiz.json').read_text())
assert data == build(), 'King quiz does not match reviewed manuscripts; rebuild it.'
assert data['rounds'] == list(range(70, 80))
assert data['reviewedChoices'] == 2500
assert data['questions'] and data['includedChoices'] >= len(data['questions'])
ids, source_ids = set(), set()
for question in data['questions']:
    assert question['id'] not in ids
    ids.add(question['id'])
    assert 5 <= len(question['prompt']) <= 160 and '\n' not in question['prompt'], question
    assert question['king'] in question['acceptedAnswers']
    assert all(isinstance(answer, str) and normalize(answer) for answer in question['acceptedAnswers'])
    assert question['sources']
    for source in question['sources']:
        key = (source['round'], source['number'], source['choice'])
        assert key not in source_ids, f'Choice duplicated across questions: {key}'
        source_ids.add(key)
assert len(source_ids) == data['includedChoices']
for round_id in data['rounds']:
    assert any(s['round'] == round_id for q in data['questions'] for s in q['sources'])
# A range includes a deduplicated fact if any of its choice sources is in range.
for start in data['rounds']:
    for end in range(start, 80):
        filtered = [q for q in data['questions'] if any(start <= s['round'] <= end for s in q['sources'])]
        assert filtered, (start, end)
        assert all(any(start <= s['round'] <= end for s in q['sources']) for q in filtered)
print(f"Validated {len(ids)} king questions / {len(source_ids)} source choices / all 2,500 reviews / 55 round ranges.")
