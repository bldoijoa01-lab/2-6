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
