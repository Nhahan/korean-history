"""Preserve original image-only exam pages as individual question WebP assets."""
from pathlib import Path
import json,re
import pymupdf as fitz
CIRCLES='①②③④⑤'
EXAMS=json.loads(Path('tmp/sources.json').read_text())
DATA_PATH=Path('assets/data/exams.json')
existing={exam['id']:exam for exam in json.loads(DATA_PATH.read_text())} if DATA_PATH.exists() else {}
for exam in EXAMS:
 n=exam['id'];anchors={};lines_by_page={}
 if n in existing and all(Path(question['image']).is_file() for question in existing[n]['questions']):
  exam.update(existing[n])
  print(n,'preserved existing reviewed questions')
  continue
 page_count=len(fitz.open(f'tmp/pdfs/{n}-paper.pdf'))
 for i in range(1,page_count+1):
  lines=json.loads(Path(f'tmp/pdfs/{n}-{i:02}.png.json').read_text());lines_by_page[i]=lines
  for l in lines:
   m=re.match(r'^(\d{1,2})[.．]',l['text'])
   if m and (l['x']<.07 or .50<l['x']<.53):
    anchors[int(m[1])]={'page':i,'column':0 if l['x']<.5 else 1,'y':l['y']}
   if l['y']<.11:
    for m in re.finditer(r'(?:^|\s)(\d{1,2})[.．]\s',l['text']):
     number=int(m[1]);column=0 if m.start()==0 and l['x']<.1 else 1
     anchors[number]={'page':i,'column':column,'y':l['y']}
 if n in (71,76): anchors[5]={'page':2,'column':0,'y':.07104413335854332} # Vision reads '5.' as 'S.'
 assert set(anchors)==set(range(1,51)),(n,set(range(1,51))-set(anchors))
 # Official answer tables have repeating triples: question, circled answer, weight.
 answertext=Path(f'tmp/pdfs/{n}-answers.txt').read_text()
 answers={int(q):(CIRCLES.index(a)+1,int(w)) for q,a,w in re.findall(r'(\d+)\s*([①②③④⑤])\s*([123])(?:\s|$)',answertext)}
 if not answers:
  # Round 73's official table uses ordinary digits instead of circled answers.
  cells=[int(value) for value in re.findall(r'^\s*(\d+)\s*$',answertext.rsplit('배점',1)[-1].split('제')[0],re.M)]
  assert len(cells)==150,(n,'numeric answer table',len(cells))
  answers={cells[i]:(cells[i+1],cells[i+2]) for i in range(0,len(cells),3)}
  assert all(1<=a<=5 and 1<=w<=3 for a,w in answers.values())
 assert set(answers)==set(range(1,51)),(n,'answer extraction',answers)
 assert sum(w for a,w in answers.values())==100
 doc=fitz.open(f'tmp/pdfs/{n}-paper.pdf');questions=[]
 out=Path(f'assets/questions/{n}');out.mkdir(parents=True,exist_ok=True)
 for q in range(1,51):
  anchor=anchors[q];i=anchor['page'];col=anchor['column'];y0=anchor['y']-.008
  later=[a['y'] for a in anchors.values() if a['page']==i and a['column']==col and a['y']>anchor['y']+.01]
  y1=min(later)-.008 if later else .940
  x0,x1=(.052,.490) if col==0 else (.507,.947)
  page=doc[i-1];rect=page.rect;clip=fitz.Rect(x0*rect.width,y0*rect.height,x1*rect.width,y1*rect.height)
  path=out/f'{q:02}.webp'
  image=page.get_pixmap(matrix=fitz.Matrix(2.2,2.2),clip=clip).pil_image()
  content=image.convert('L').point(lambda pixel:255 if pixel<235 else 0).getbbox()
  old_height=image.height
  end=min(image.height,content[3]+18)
  image=image.crop((0,0,image.width,end))
  image.save(str(path),format='WEBP',quality=90)
  y1=y0+(y1-y0)*end/old_height
  choices={}
  for line in lines_by_page[i]:
   if not(x0<=line['x']<x1 and y0<=line['y']<y1):continue
   m=re.match(r'^([①②③④⑤])(?:\s|$)',line['text'])
   if m:
    v=CIRCLES.index(m[1])+1
    # Keep exact source pixels; OCR is used only to locate optional click targets.
    choices[v]={'x':(line['x']-x0)/(x1-x0),'y':(line['y']-y0)/(y1-y0),'w':min(line['w']/(x1-x0),1-(line['x']-x0)/(x1-x0)),'h':min(max(line['h'],.023)/(y1-y0),1-(line['y']-y0)/(y1-y0))}
  question={'number':q,'points':answers[q][1],'answer':answers[q][0],'image':str(path),'text':f'제{n}회 심화 {q}번 원본 문제. 지문과 다섯 보기는 이미지에 표시되어 있습니다.','options':[f'{v}번 보기' for v in CIRCLES],'sourcePage':i}
  if set(choices)==set(range(1,6)):question['choiceRegions']=[choices[v] for v in range(1,6)]
  questions.append(question)
 exam['questions']=questions
 print(n,len(questions),'questions; overlay regions',sum('choiceRegions' in q for q in questions))
Path('assets/data/exams.json').write_text(json.dumps(EXAMS,ensure_ascii=False,indent=2)+'\n')
