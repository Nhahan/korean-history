"""Build full selectable regions for the five original options in every question.
OCR positions are reviewed against original pixels; diagram layouts use explicit overrides.
"""
import json,re
from pathlib import Path
CIRCLES='①②③④⑤'
# Three illustrations above two, with reviewed label row positions.
ILLUSTRATIONS={
 (75,3):(.559,.784),(75,18):(.589,.797),
 (76,4):(.583,.799),(76,17):(.672,.837),(76,27):(.613,.781),
 (77,4):(.589,.792),(77,13):(.579,.796),
 (78,9):(.635,.826),(78,14):(.596,.800),
 (79,6):(.604,.811),(79,11):(.647,.833),
}
HORIZONTAL={(76,34):.947,(77,18):.940,(78,23):.917,(79,17):.940,(79,33):.905}

def region(x,y,w,h):
 x=max(0,x);y=max(0,y)
 return {'x':round(x,6),'y':round(y,6),'w':round(min(w,1-x),6),'h':round(min(h,1-y),6)}

def build(n,q):
 identity=(n,q)
 if identity in ILLUSTRATIONS:
  top,bottom=ILLUSTRATIONS[identity];ys=[top-.009,bottom-.009]
  regions=[]
  for k in range(5):
   row=0 if k<3 else 1;col=k if k<3 else k-3
   x=[.035,.347,.660][col];right=[.335,.648,.989][col]
   regions.append(region(x,ys[row],right-x,(ys[1]-.005 if row==0 else .993)-ys[row]))
  return regions
 if identity==(78,26):
  ys=[.533,.696,.857];rs=[]
  for k in range(5):
   row=k//2;x=.035 if k%2==0 else .516;right=.488 if k%2==0 and k<4 else .990
   rs.append(region(x,ys[row],right-x,(ys[row+1]-.009 if row<2 else .993)-ys[row]))
  return rs
 if identity in HORIZONTAL:
  y=HORIZONTAL[identity]-.01
  return [region(x,y,right-x,.993-y) for x,right in zip([.035,.223,.412,.600,.788],[.212,.400,.588,.776,.990])]
 if identity==(75,38):
  ys=[.882,.918,.954]
  return [region(.035 if k%2==0 else .510,ys[k//2],.469 if k%2==0 else .480,(ys[k//2+1]-.002 if k<4 else .994)-ys[k//2]) for k in range(5)]
 lines=json.loads(Path(f'tmp/question-ocr/{n}-{q:02}.png.json').read_text())
 markers={}
 for l in lines:
  m=re.match('^([①②③④⑤])',l['text'])
  if m: markers[CIRCLES.index(m[1])]=l
 assert len(markers)==5,(n,q,'review required')
 ls=[markers[k] for k in range(5)];rs=[]
 # A horizontal timeline or combination row.
 if max(l['y'] for l in ls)-min(l['y'] for l in ls)<.025:
  ys=min(l['y'] for l in ls)-.01
  for k,l in enumerate(ls):
   x=max(.025,l['x']-.009);right=ls[k+1]['x']-.014 if k<4 else .993
   rs.append(region(x,ys,right-x,.994-ys))
 # All options start in a single column; include wrapped continuation lines.
 elif max(l['x'] for l in ls)-min(l['x'] for l in ls)<.05:
  x=max(.02,min(l['x'] for l in ls)-.010)
  for k,l in enumerate(ls):
   y=l['y']-.008;end=ls[k+1]['y']-.009 if k<4 else .994
   assert end>y,(n,q,'nonsequential options')
   rs.append(region(x,y,.992-x,end-y))
 else:
  # Multiple-column options: each row expands to the next row, each cell to the next option in its row.
  for k,l in enumerate(ls):
   row=[a for a in ls if abs(a['y']-l['y'])<.03]
   nextrows=[a['y'] for a in ls if a['y']>l['y']+.03]
   nextcols=[a['x'] for a in row if a['x']>l['x']+.05]
   x=max(.025,l['x']-.01);y=l['y']-.01
   end=min(nextrows)-.011 if nextrows else .994
   right=min(nextcols)-.014 if nextcols else .992
   rs.append(region(x,y,right-x,end-y))
 return rs

if __name__=='__main__':
 path=Path('assets/data/exams.json');exams=json.loads(path.read_text())
 for e in exams:
  for q in e['questions']:
   q['choiceRegions']=build(e['id'],q['number'])
   assert all(r['w']>0 and r['h']>0 for r in q['choiceRegions'])
 path.write_text(json.dumps(exams,ensure_ascii=False,indent=2)+'\n')
 print('Built five directly selectable original options for all 250 questions.')
