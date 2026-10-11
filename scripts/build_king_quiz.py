"""Build king-name questions from the reviewed 70–79 exam choices."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KINGDOMS = ['고조선', '고구려', '백제', '신라', '가야', '발해', '후백제', '태봉', '고려', '조선', '대한제국']
NAME_ALIASES = {
    ('고구려', '광개토 대왕'): ['광개토왕', '광개토태왕', '광개토'],
    ('신라', '무열왕'): ['태종 무열왕', '김춘추', '태종무열'],
    ('신라', '선덕 여왕'): ['선덕왕', '선덕'],
    ('신라', '진덕 여왕'): ['진덕왕', '진덕'],
    ('신라', '진성 여왕'): ['진성왕', '진성'],
    ('발해', '고왕'): ['대조영'],
    ('고려', '태조'): ['왕건', '태조 왕건'],
    ('고려', '광종'): ['왕소'],
    ('조선', '태조'): ['이성계', '이단'],
    ('조선', '태종'): ['이방원'],
    ('조선', '정종'): ['이방과'],
    ('조선', '세종'): ['세종대왕', '이도'],
    ('조선', '세조'): ['수양대군', '이유'],
    ('조선', '정조'): ['이산'],
    ('조선', '고종'): ['고종황제'],
    ('대한제국', '고종'): ['고종황제', '광무황제'],
    ('대한제국', '순종'): ['순종황제', '융희황제'],
}


def read(path):
    return json.loads((ROOT / path).read_text())


def normalize(value):
    return re.sub(r'[\s·.,!?。]', '', value)


def answers(kingdom, king):
    names = [king, *NAME_ALIASES.get((kingdom, king), [])]
    if king.endswith('왕') and len(king) > 2:
        names.append(re.sub(r'\s*(대왕|여왕|왕)$', '', king))
    names += [f'{kingdom} {name}' for name in list(names)]
    return list(dict.fromkeys(names))


def build():
    exams = read('assets/data/exams.json')
    reviews = read('scripts/data/king-reviews.json')
    aliases = read('scripts/data/king-prompt-aliases.json')
    choices = {(e['id'], q['number'], i + 1): option
               for e in exams for q in e['questions'] for i, option in enumerate(q['options'])}
    seen = set()
    questions = {}
    used_aliases = set()
    for review in reviews:
        source = (review['round'], review['number'], review['choice'])
        assert source in choices and source not in seen, f'Invalid/duplicate source: {source}'
        seen.add(source)
        if 'reason' in review:
            assert review['reason'] and 'prompt' not in review, review
            continue
        kingdom, king, prompt = (review[key] for key in ('kingdom', 'king', 'prompt'))
        assert kingdom in KINGDOMS and king and prompt, review
        alias_key = '|'.join((kingdom, king, prompt))
        if alias_key in aliases:
            used_aliases.add(alias_key)
            prompt = aliases[alias_key]
        identity = '|'.join((kingdom, king, normalize(prompt)))
        if identity not in questions:
            questions[identity] = {
                'id': 'king-' + hashlib.sha256(identity.encode()).hexdigest()[:12],
                'prompt': prompt, 'king': king, 'kingdom': kingdom,
                'acceptedAnswers': answers(kingdom, king), 'sources': [],
            }
        questions[identity]['sources'].append({'round': source[0], 'number': source[1], 'choice': source[2]})
    assert seen == set(choices), f'Missing choice reviews: {set(choices) - seen}'
    assert used_aliases == set(aliases), f'Unused prompt aliases: {set(aliases) - used_aliases}'
    result = sorted(questions.values(), key=lambda q: (KINGDOMS.index(q['kingdom']), q['king'], q['prompt']))
    for question in result:
        question['sources'].sort(key=lambda source: (source['round'], source['number'], source['choice']))
    fingerprint = hashlib.sha256(json.dumps(result, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    return {'version': 1, 'revision': fingerprint, 'rounds': sorted(e['id'] for e in exams),
            'reviewedChoices': len(seen), 'includedChoices': sum(len(q['sources']) for q in result),
            'questions': result}


if __name__ == '__main__':
    data = build()
    (ROOT / 'assets/data/king-quiz.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f"Built {len(data['questions'])} king questions from {data['includedChoices']} choices; {data['reviewedChoices']} reviewed.")
