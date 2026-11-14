// 푸시 알림용 VAPID 키 생성: node tools/gen-vapid.mjs
// 공개키는 wrangler.toml [vars] VAPID_PUBLIC 에, 비공개 d 는 `npx wrangler secret put VAPID_PRIVATE` 로만 넣으세요 (저장소에 올리지 마세요)
import { webcrypto as c } from 'node:crypto';
const k = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const jwk = await c.subtle.exportKey('jwk', k.privateKey);
const raw = new Uint8Array(await c.subtle.exportKey('raw', k.publicKey));
const b64u = (u) => Buffer.from(u).toString('base64url');
console.log(JSON.stringify({ VAPID_PUBLIC: b64u(raw), VAPID_PRIVATE: jwk.d }));
