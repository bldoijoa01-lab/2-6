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
