// Web Push (RFC 8030 + VAPID RFC 8292 + aes128gcm 암호화 RFC 8291). WebCrypto만 사용 → Cloudflare Worker·Node 둘 다 동작
const enc = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64d = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

// payload(Uint8Array)를 구독자(uaPublic 65바이트, authSecret 16바이트)용으로 암호화. opts.asKeys/salt 는 테스트 벡터 검증용
export async function encryptPayload(payload, uaPublicB64, authB64, opts = {}) {
  const uaPub = b64d(uaPublicB64), auth = b64d(authB64);
  const asKeys = opts.asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, ecdh, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(payload, new Uint8Array([2]))));   // 마지막 레코드 구분자 0x02
  const rs = new Uint8Array([0, 0, 0x10, 0]);   // 레코드 크기 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// VAPID JWT: 공개키(vapidPublic, 65바이트 b64u) + 비밀 스칼라 d (b64u)
async function vapidAuth(endpoint, vapidPublic, vapidPrivate, subject) {
  const pub = b64d(vapidPublic);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: vapidPrivate }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body)));   // WebCrypto는 r||s 64바이트(JWS 형식) 그대로
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapidPublic}`;
}

// 푸시 1건 전송. 성공 true / 구독 만료(404·410) 'gone' / 그 외 실패 false
export async function sendPush(sub, message, env) {
  try {
    const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.keys.p256dh, sub.keys.auth);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { authorization: await vapidAuth(sub.endpoint, env.VAPID_PUBLIC, env.VAPID_PRIVATE, env.VAPID_SUBJECT || 'https://class-26.bldoijoa01.workers.dev'), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '43200', urgency: 'normal' },
      body,
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.status >= 200 && res.status < 300;
  } catch { return false; }
}
