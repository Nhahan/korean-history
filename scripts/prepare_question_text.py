"""Generate per-question OCR packets for review, without changing authoritative answers."""
from pathlib import Path
import json,sys
from PIL import Image
exams=json.loads(Path('assets/data/exams.json').read_text())
Path('tmp/question-ocr').mkdir(parents=True,exist_ok=True)
Path('tmp/explanations').mkdir(parents=True,exist_ok=True)
if '--render' in sys.argv:
 for e in exams:
  for q in e['questions']:
   Image.open(q['image']).save(f'tmp/question-ocr/{e["id"]}-{q["number"]:02}.png')
 print('Rendered 250 question images for OCR.')
 sys.exit(0)
for exam in exams:
 for start,end in [(1,25),(26,50)]:
  rows=[]
  for q in exam['questions'][start-1:end]:
   path=Path(f'tmp/question-ocr/{exam["id"]}-{q["number"]:02}.png.json')
   lines=json.loads(path.read_text()) if path.exists() else []
   lines=sorted(lines,key=lambda l:(round(l['y']/0.012),l['x']))
   rows.append({'number':q['number'],'answer':q['answer'],'points':q['points'],'image':q['image'],'ocr':lines})
  Path(f'tmp/explanations/input-{exam["id"]}-{start}-{end}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
