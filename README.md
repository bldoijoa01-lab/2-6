# 2-6 알림장 웹앱 (v1)

정적 사이트(HTML/CSS/JS, 빌드 없음). GitHub Pages로 바로 배포됨.

## 기능
- **오늘**: 일정 D-day 자동 계산 (한국 시간 기준). 7일 이내 = 🔥중요, 그 외 = 📌좀중요. 지난 일정은 자동으로 숨김.
- **기말 시간표**: 2학년 시간표 (공통/선택/자습 색 구분, 시험 주간엔 오늘 칸 강조).
- **이동교실**: 번호 입력 → 원반 이동 여부, 이름 입력 → 특별실 응시 과목/시간/시험실.
- **유의사항**: 시험 유의사항.

## 로컬 실행
```
python3 -m http.server 8000   # 후 http://localhost:8000
```
(`file://`로 열면 data.json fetch가 막혀서 안내 문구가 뜸)

## GitHub Pages 배포
1. 이 폴더(`poster-tools/` 제외해도 됨)를 레포 루트에 올림
2. Settings → Pages → Source: `main` / root
3. 주소: `https://<id>.github.io/<repo>/`

## 데이터 수정
`data.json` 만 고치면 됨 (events, exam, move, special, cautions). 코드 수정 불필요.
- `events[].date` / `end` : `YYYY-MM-DD`
- `special[].members` : 이름 배열 (이름 검색에 사용)

## 로그인 (비밀번호 잠금)
공개 저장소에는 평문 `data.json`이 올라가지 않고, 암호화된 `data.enc.json`만 올라갑니다 (`data.json`은 .gitignore).
접속하면 반 비밀번호를 입력해야 복호화되어 내용이 보입니다.

데이터 수정 후 다시 암호화:
```
PASSWORD='반비밀번호' node tools/encrypt.js
```
비밀번호를 바꾸면 같은 명령을 새 비밀번호로 실행 → 커밋. (AES-256-GCM + PBKDF2 60만회)
※ 공유 비밀번호 방식이라 비밀번호가 약하면 뚫릴 수 있으니 길고 무작위로 쓰세요. 이미 올라간 옛 `data.enc.json`은 git 기록에 남습니다.
