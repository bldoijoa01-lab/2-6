// 교사 열쇠를 미리 만들어 두는 스크립트 (학생이 선생님보다 먼저 써도 성적이 공유되도록)
// 비밀키는 '교사 코드'로 만든 키로 잠가서 저장하고, 이 스크립트가 끝나면 어디에도 남지 않음.
// 선생님이 처음 로그인(교사 코드 입력)하면 앱이 이 열쇠를 열어서 선생님 비밀번호용 새 열쇠로 교체하고 학생 사본의 열쇠도 다시 감쌈.
// 사용: TEACHER_CODE='교사코드' TEACHER_N=101 node tools/provision-teacher-key.js out.json
//       npx wrangler kv key put --namespace-id=<KV> --remote tkey:101 --path=out.json
const { webcrypto: c } = require('crypto'), fs = require('fs');
const code = process.env.TEACHER_CODE, n = process.env.TEACHER_N || '101', out = process.argv[2] || 'tkey.json';
if (!code) { console.error('TEACHER_CODE 환경변수가 필요해요'); process.exit(1); }
const b64 = (b) => Buffer.from(b).toString('base64'), enc = new TextEncoder();
(async () => {
  const kp = await c.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  const pub = await c.subtle.exportKey('jwk', kp.publicKey), pk = await c.subtle.exportKey('pkcs8', kp.privateKey);
  const km = await c.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  const wk = await c.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('class26-tkey-code|' + n), iterations: 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = c.getRandomValues(new Uint8Array(12)), ct = await c.subtle.encrypt({ name: 'AES-GCM', iv }, wk, pk);
  fs.writeFileSync(out, JSON.stringify({ pub, priv: { iv: b64(iv), data: b64(ct) }, provisional: true }));
  if (process.env.DEBUG_PRIV) fs.writeFileSync(process.env.DEBUG_PRIV, b64(pk));   // 테스트 전용
  console.log('written', out);
})();
