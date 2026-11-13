# Cloudflare Worker 버전 (이름+번호 로그인)

- 주소: https://class-26.bldoijoa01.workers.dev
- 데이터(`data`)와 명단(`roster`)은 Cloudflare KV에만 있고 저장소에는 없음
- 로그인 성공 시 서명 토큰(30일) 발급 → `/api/data` 는 토큰이 있어야 응답

## 명단 등록 (roster.json, 저장소에 올리지 말 것)
```
[{"n":1,"name":"홍길동"},{"n":2,"name":"김철수"}]
```
```
cd cloudflare
npx wrangler kv key put --namespace-id=3b0183b8c07e4dbea43c84c455d0bc5e --remote roster --path=roster.json
```
## 데이터 수정 / 화면 수정 후 배포
```
npx wrangler kv key put --namespace-id=3b0183b8c07e4dbea43c84c455d0bc5e --remote data --path=data.json
node build-assets.js && npx wrangler deploy
```

## 로그인 방식
- 첫 로그인: 이름 + 번호 + **반 코드**(Worker secret `CLASS_CODE`) → 나만의 비밀번호 설정
- 이후: 이름 + 번호 + 내 비밀번호
- 비밀번호는 솔트+PBKDF2 해시로만 KV(`pw:<번호>`)에 저장 → 원문은 관리자도 볼 수 없음
- 반 코드 변경: `echo 새코드 | npx wrangler secret put CLASS_CODE`
- 비밀번호 초기화(잊어버린 학생): `npx wrangler kv key delete --namespace-id=3b0183b8c07e4dbea43c84c455d0bc5e --remote pw:<번호>` → 반 코드로 다시 설정

## 글꼴
Pretendard(OFL)를 서브셋해서 `src/pretendard.woff2`로 Worker에 내장 (외부 CDN 없음). 새 글자(희귀 한글)가 자주 깨지면 `fonts/chars.txt` 에 추가해 pyftsubset 으로 다시 만들고 `/fonts/pretendard-N.woff2` 번호를 올리세요.

## 등급컷 탭
- 계산 로직은 `public/grade.js` (bldoijoa01-lab/gradecut 의 등급·석차 계산을 그대로 옮김)
- 데이터는 Worker `/api/cuts` 가 gradecut 저장소의 `cuts.json` (GitHub Pages)을 5분 캐시로 직접 가져옴 → gradecut 쪽을 고치면 자동 반영. 못 가져오면 KV `cuts` 에 마지막으로 받은 사본 사용
- 내 점수는 브라우저에서 **내 비밀번호로 만든 키(PBKDF2→AES-GCM)로 암호화**해 KV(`sc:<번호>`)에 저장 → 서버·관리자는 암호문만 보임. 로그인 때 키를 만들어 이 기기에 보관(로그아웃 시 삭제). 비밀번호를 초기화하면 이전 점수는 복호화 불가(다시 입력)
- 기말 목표 계산기(과목별 필요 기말 등수·점수, 점수 슬라이더 확률)도 같은 모듈에 포함. 아직 안 옮긴 것: 수행 감점 보정, 여러 과목 목표 플랜, 성적표 이미지 저장, 정보 제보
- 내 정보 탭: 2학기 택5·1학기 택4·교양 택1 선택과목(교육과정 편성표 기준, `public/electives.js`)을 점수와 같은 암호화 덩어리에 저장

## 교사 계정
- 명단(`roster`)에 `{"n":101,"name":"이천규","role":"teacher"}` 처럼 `role:"teacher"` 항목을 넣으면 교사 계정 (번호는 학생과 안 겹치게 101~)
- 교사 첫 로그인은 **교사 코드**(Worker secret `TEACHER_CODE`)로만 만들 수 있음 (반 코드로는 불가) → 교사가 직접 비밀번호 설정
- 교사 화면: 일정·공지 올리기/삭제, 학생 가입 현황, 학생 비밀번호 초기화 (`/api/teacher/*`, 학생 토큰은 403)
- 교사 추가: `npx wrangler kv key put ... roster` 에 항목 추가 후 업로드

## 선생님 공유 (처음부터 공유, 선생님 전용 열쇠)
- 학생의 점수·내신·선택과목(개인 일정 제외)은 학생 기기에서 **AES-GCM 랜덤 키**로 암호화하고, 그 키를 **교사 공개키(RSA-OAEP)** 로 감싸 `share:<번호>` 에 저장
- 교사 키쌍은 교사 첫 로그인 때 브라우저에서 생성: 공개키는 `tkey:<번호>.pub`, 비밀키는 교사 비밀번호로 만든 키로 잠가서 `tkey:<번호>.priv` (서버·운영자는 풀 수 없음)
- 교사 화면: 학생 현황에서 공유 상태·요약, `화면 보기` 로 학생 화면(성적 포함, 읽기 전용) 미리보기
- 교사가 비밀번호를 초기화하면 새 키쌍이 만들어져 이전 사본은 못 풂 → 학생이 다시 로그인하면 새로 공유됨
- 교사가 처음 로그인하기 전에 학생이 쓴 데이터는 공개키가 없어 공유 안 됨 → 학생이 다음에 로그인/저장할 때 공유됨

## 학생이 선생님보다 먼저 써도 되는 이유 (사전 교사 열쇠)
- `tools/provision-teacher-key.js` 로 교사 열쇠를 미리 만들어 `tkey:<번호>` 에 올려 둠 (비밀키는 **교사 코드**로 잠겨 있음, 스크립트 종료 후 어디에도 남지 않음)
- 학생은 이 공개키로 바로 성적 사본을 공유 → 선생님이 먼저 로그인하지 않아도 됨
- 선생님이 교사 코드로 첫 로그인하면 앱이 사전 열쇠를 열어 **선생님 비밀번호용 새 열쇠로 교체**하고, 학생 사본의 감싼 열쇠를 새 열쇠로 다시 감쌈 → 이후에는 교사 코드만으로는 풀 수 없음
- 교체 전(선생님이 첫 로그인하기 전)에는 교사 코드를 아는 사람이 사본을 열 수 있음

## 교사 비밀번호를 잊었을 때
1. `npx wrangler kv key delete --namespace-id=3b0183b8c07e4dbea43c84c455d0bc5e --remote pw:101`
2. 선생님이 교사 코드로 다시 로그인 → 새 비밀번호 설정 (새 교사 열쇠가 만들어짐)
3. 이전 열쇠로 감싼 학생 사본은 못 풀지만, 학생이 앱을 열거나 점수를 저장할 때 새 열쇠로 다시 공유됨 (학생 데이터는 사라지지 않음)
