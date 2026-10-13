"""Validate complete, non-overlapping main-stem era classification."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
read = lambda name: json.loads((ROOT / 'assets/data' / name).read_text())
exams, data = read('exams.json'), read('era-questions.json')
expected = {(exam['id'], q['number']) for exam in exams for q in exam['questions']}
assert data['version'] >= 1 and data['basis']
groups = {g['id'] for g in data['groups']}
assert len(groups) == len(data['groups'])
assert groups == {'prehistory','early-states','three-kingdoms','north-south','goryeo','joseon','opening','colonial','contemporary','cross-era'}
assert all(g['label'] and g['description'] for g in data['groups'])
seen = {}
for q in data['questions']:
    key = (q['round'], q['number'])
    assert key in expected and key not in seen, key
    assert q['group'] in groups and q['reason'].strip(), key
    seen[key] = q['group']
assert set(seen) == expected and len(seen) == 500
assert all(any(q['group'] == group for q in data['questions']) for group in groups)
# Hand-reviewed boundaries guard against classifying by a correct/distractor option.
assert all(seen[(r,1)] == 'prehistory' for r in range(70,80))
assert seen[(76,34)] == 'opening'  # 1926 film is a distractor, stem is opening-era facilities.
assert seen[(79,28)] == 'opening'  # Stem: 1886 treaty, answer option mentions 1866.
assert seen[(79,46)] == 'colonial'  # Stem: Kim Gu's colonial-era activities, answer: 1948 talks.
assert seen[(74,50)] == 'cross-era'  # Actual question compares selection systems across eras.
assert seen[(75,29)] == 'opening'  # Trial in 1894–1898, not Donghak's 1860 foundation.
print(f'Validated {len(seen)} unique questions in {len(groups)} main-stem era groups.')
