// 2-6 알림장 서버: 이름+번호 로그인 -> 서명 토큰 -> 데이터 제공
// KV: "roster" = [{"n":1,"name":"홍길동"}, ...], "data" = data.json 내용
// Secret: SESSION_SECRET
import ASSETS from './assets.js';
const enc = new TextEncoder();
const TTL = 60 * 60 * 24 * 30;

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function makeToken(env, who) {
  const body = b64u(enc.encode(JSON.stringify({ w: who, exp: Math.floor(Date.now() / 1000) + TTL })));
  return body + '.' + await hmac(env.SESSION_SECRET, body);
}
async function verifyToken(env, token) {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig || !safeEq(sig, await hmac(env.SESSION_SECRET, body))) return null;
  try {
    const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

// 로그인 시도 제한: IP당 10분에 8회
async function tooMany(env, ip) {
  const key = 'rl:' + ip, n = parseInt(await env.CLASS_KV.get(key) || '0', 10);
  if (n >= 8) return true;
  await env.CLASS_KV.put(key, String(n + 1), { expirationTtl: 600 });
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') || 'x';
      if (await tooMany(env, ip)) return json({ error: 'too_many' }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
      const name = String(b.name || '').trim().replace(/\s+/g, ''), num = parseInt(b.number, 10);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      const hit = roster.find((s) => s.n === num && s.name.replace(/\s+/g, '') === name);
      if (!hit) return json({ error: 'invalid' }, 401);
      return json({ token: await makeToken(env, hit.n) });
    }
    if (url.pathname === '/api/data' && request.method === 'GET') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      if (!await verifyToken(env, auth)) return json({ error: 'unauthorized' }, 401);
      return new Response(await env.CLASS_KV.get('data') || '{}', { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    const a = ASSETS[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!a) return new Response('Not found', { status: 404 });
    return new Response(a.body, { headers: { 'content-type': a.type, 'cache-control': 'no-cache' } });
  },
};
