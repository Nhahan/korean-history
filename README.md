# 한국사 기출연습

한국사능력검정시험 **심화(1·2·3급) 제79·78·77·76·75회**를 실제 시험지 이미지로 풀어보는 정적 웹사이트입니다. 회차별 50문항, 총 250문항을 제공합니다.

## 사용 방법

1. 첫 화면에서 풀이 방식을 선택합니다.
2. 원하는 회차를 열고 문항 아래의 ①–⑤ 버튼을 클릭합니다.
3. **바로 채점**은 답을 선택하면 즉시 정답을 확인합니다. **실전 시험**은 80분 동안 풀고 제출한 뒤 배점에 따른 점수를 확인합니다.
4. 별도 **정답표** 페이지에서 회차별 공식 정답을 확인합니다.

풀이 기록은 현재 브라우저의 로컬 저장소에 보관됩니다. 다른 기기나 브라우저와 동기화되지 않습니다. 심화 합격 기준은 1급 80점 이상, 2급 70점 이상, 3급 60점 이상입니다.

## 자료 출처

문제지와 정답은 [국사편찬위원회 한국사능력검정시험 공식 홈페이지](https://www.historyexam.go.kr)의 공개 기출자료를 사용합니다. 각 회차의 공식 자료 링크는 사이트와 `assets/data/exams.json`에 수록되어 있습니다. 정답표에는 공식 정답을 제공하며 별도의 해설은 포함하지 않습니다.

문제지에 포함된 문항, 사진, 사료 및 도판의 권리는 국사편찬위원회와 각 원권리자에게 있습니다. 이 사이트는 해당 자료를 출처와 함께 개인 학습용으로 제공합니다. 본 저장소는 기출자료에 별도의 재이용 허락이나 라이선스를 부여하지 않습니다. 공식 시험 접수와 성적 확인은 공식 홈페이지에서 진행하세요.

## 로컬 실행

별도의 프레임워크나 설치 과정 없이 정적 파일로 동작합니다. JSON 자료를 가져오기 위해 파일을 직접 여는 대신 HTTP 서버를 실행합니다.

```sh
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.

## 검증과 배포

```sh
python3 scripts/validate_data.py
```

검증 스크립트는 5개 회차, 회차별 50문항과 100점 배점, 1–5 범위 정답, 중복 문항, 선택지 5개, 공식 HTTPS 출처, 250개 문제 이미지 존재 여부를 확인합니다.

브라우저 점검 항목:

- 모든 회차의 문제 50개와 정답표 50개가 표시되는지 확인합니다.
- 바로 채점 모드에서 답 선택 직후 정답 표시와 배점 계산을 확인합니다.
- 실전 시험 모드에서 제출 전 정답이 표시되지 않고, 제출 후 총점과 정답이 표시되는지 확인합니다.
- 새로고침 후 풀이 기록이 복구되는지, 회차와 모드별로 기록이 구분되는지 확인합니다.
- 모바일 화면에서 문제 이미지와 선택지 버튼을 확인하고 키보드로 선택 및 제출을 점검합니다.

`main` 브랜치에 push하면 `.github/workflows/pages.yml`이 자료를 검증한 뒤 GitHub Pages에 배포합니다. 배포에는 HTML, CSS, JavaScript와 `assets/`만 포함되며 임시 원본 처리 파일이나 가상환경은 포함되지 않습니다. 저장소의 **Settings → Pages → Source**는 **GitHub Actions**로 설정합니다. 워크플로 구성은 [GitHub 공식 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)를 따릅니다.

## 원본에서 자료 다시 만들기

현재 저장소에는 생성된 250문항 이미지와 정답 데이터가 포함되어 있어 이 단계 없이 바로 실행할 수 있습니다. 자료를 다시 만드는 경우 macOS의 Swift/Vision과 Python을 사용합니다. OCR은 문항 위치와 선택 영역을 찾는 용도로만 사용하며, 표시되는 지문과 보기는 원본 이미지입니다.

```sh
uv venv .venv
uv pip install --python .venv/bin/python pymupdf pillow beautifulsoup4 requests
.venv/bin/python scripts/import_exams.py
swiftc scripts/ocr.swift -o tmp/ocr
tmp/ocr tmp/pdfs/7[5-9]-[0-9][0-9].png
.venv/bin/python scripts/build_questions.py
python3 scripts/validate_data.py
```

회차별 날짜와 공식 게시물 ID는 `scripts/import_exams.py`에 기록되어 있습니다. 새로운 회차를 추가할 때는 문항 경계와 정답표를 원본과 대조해야 합니다.
