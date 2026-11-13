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
