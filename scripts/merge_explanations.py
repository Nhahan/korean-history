"""Merge reviewed, independently written study explanations into official exam data."""
import json
from pathlib import Path
from PIL import Image
path=Path('assets/data/exams.json');exams=json.loads(path.read_text())
for exam in exams:
 annotations={}
 shorts_path=Path(f'assets/explanations/{exam["id"]}-short.json')
 shorts=json.loads(shorts_path.read_text())
 assert int(shorts['round'])==exam['id']
 short_notes={q['number']:q['shortExplanations'] for q in shorts['questions']}
 assert sorted(short_notes)==list(range(1,51))
 for start,end in [(1,25),(26,50)]:
  p=Path(f'assets/explanations/{exam["id"]}-{start}-{end}.json')
  data=json.loads(p.read_text());assert int(data['round'])==exam['id']
  assert sorted(q['number'] for q in data['questions'])==list(range(start,end+1)),p
  annotations.update({q['number']:q for q in data['questions']})
 for q in exam['questions']:
  item=annotations[q['number']]
  assert len(item['explanations'])==len(item['optionTexts'])==5
  q['shortExplanations']=short_notes[q['number']]
  q['imageWidth'],q['imageHeight']=Image.open(q['image']).size
  q.update(topic=item['topic'],keyExplanation=item['keyExplanation'],options=item['optionTexts'],explanations=item['explanations'],explanationSources=item['explanationSources'])
path.write_text(json.dumps(exams,ensure_ascii=False,indent=2)+'\n')
print('Merged 250 questions / 1,250 concise choice notes; official answers and weights unchanged.')
