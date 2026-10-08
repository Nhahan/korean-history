from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,re,requests,pymupdf as fitz
from bs4 import BeautifulSoup
BASE='https://www.historyexam.go.kr'
IDS={79:('1000030131','2026-08-09'),78:('1000030119','2026-05-23'),77:('1000030110','2026-02-07'),76:('1000030098','2025-10-18'),75:('1000030080','2025-08-09'),74:('1000030069','2025-05-24'),73:('1000030052','2025-02-16'),72:('1000030043','2024-10-20'),71:('1000030032','2024-08-10'),70:('1000030012','2024-05-25')}
def download(item):
    n,(post,date)=item
    detail=f'{BASE}/pst/view.do?bbs=dat&pst_sno={post}'
    html=requests.get(detail,timeout=45);html.raise_for_status()
    soup=BeautifulSoup(html.content,'html.parser')
    links=[]
    for a in soup.find_all('a',onclick=True):
        m=re.search(r"fnFileDownload\('([^']+)'\)",a['onclick'])
        if m: links.append((a.get_text(strip=True),f'{BASE}/atchFile/FileDown.do?atch_file_id={m[1]}'))
    for label,url in links:
        kind='answers' if '답' in label else 'paper'
        path=Path(f'tmp/pdfs/{n}-{kind}.pdf')
        if not path.exists():
            r=requests.get(url,timeout=60);r.raise_for_status();assert r.content.startswith(b'%PDF'),(n,label);path.write_bytes(r.content)
    return {'id':n,'date':date,'title':f'제{n}회 한국사능력검정시험','duration':80,'source':{'listing':detail,'paper':next(u for l,u in links if '문제' in l),'answers':next(u for l,u in links if '답' in l)}}
if __name__=='__main__':
    Path('tmp/pdfs').mkdir(parents=True,exist_ok=True)
    exams=list(ThreadPoolExecutor(5).map(download,IDS.items()))
    Path('tmp/sources.json').write_text(json.dumps(exams,ensure_ascii=False,indent=2))
    for exam in exams:
        n=exam['id']
        for kind in ['paper','answers']:
            doc=fitz.open(f'tmp/pdfs/{n}-{kind}.pdf')
            Path(f'tmp/pdfs/{n}-{kind}.txt').write_text('\n'.join(p.get_text() for p in doc))
            if kind=='paper':
                for i,page in enumerate(doc,1):
                    target=Path(f'tmp/pdfs/{n}-{i:02}.png')
                    if not target.exists():
                        page.get_pixmap(matrix=fitz.Matrix(1.8,1.8)).save(str(target))
            print(n,kind,len(doc),doc[0].rect)
    doc=fitz.open('tmp/pdfs/79-paper.pdf');doc[0].get_pixmap(matrix=fitz.Matrix(1,1)).save('tmp/pdfs/79-preview.png')
