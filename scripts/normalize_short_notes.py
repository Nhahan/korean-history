"""Apply reviewed aliases so equivalent study facts always use the same sentence."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES_PATH = ROOT / 'scripts/data/short-note-aliases.json'


def load_aliases():
    aliases = json.loads(ALIASES_PATH.read_text())
    for old, canonical in aliases.items():
        assert isinstance(old, str) and isinstance(canonical, str)
        assert 4 <= len(canonical) <= 26 and '\n' not in canonical
        assert canonical not in aliases, f'Alias must point directly to a final sentence: {old}'
    return aliases


def apply(aliases):
    updates = []
    for path in (ROOT / 'assets/explanations').glob('*-short.json'):
        data = json.loads(path.read_text())
        for question in data['questions']:
            question['shortExplanations'] = [aliases.get(note, note) for note in question['shortExplanations']]
        updates.append((path, data))
    path = ROOT / 'assets/data/exams.json'
    data = json.loads(path.read_text())
    for exam in data:
        for question in exam['questions']:
            question['shortExplanations'] = [aliases.get(note, note) for note in question['shortExplanations']]
    updates.append((path, data))
    path = ROOT / 'assets/data/concept-eras.json'
    taxonomy = json.loads(path.read_text())
    resolved = {}
    for key, era in taxonomy['noteEras'].items():
        concept, note = key.split('|', 1)
        canonical_key = f'{concept}|{aliases.get(note, note)}'
        assert canonical_key not in resolved or resolved[canonical_key] == era, f'Conflicting era for {canonical_key}'
        resolved[canonical_key] = era
    taxonomy['noteEras'] = resolved
    taxonomy['notePeriods'] = {aliases.get(note, note): era for note, era in taxonomy.get('notePeriods', {}).items()}
    updates.append((path, taxonomy))
    for path, data in updates:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    aliases = load_aliases()
    apply(aliases)
    print(f'Applied {len(aliases)} reviewed aliases to the source notes, exam data and era classifications.')
