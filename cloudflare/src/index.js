// 2-6 알림장 서버: 이름+번호 로그인 -> 서명 토큰 -> 데이터 제공
// KV: "roster" = [{"n":1,"name":"홍길동"}, ...], "data" = data.json 내용
// Secret: SESSION_SECRET
import ASSETS from './assets.js';
import FONT from './pretendard.woff2';
import OG from './og.jpg';
import ICON from './icon.png';
const enc = new TextEncoder();
const TTL = 60 * 60 * 24 * 30;
const CUTS_URL = 'https://bldoijoa01-lab.github.io/gradecut/cuts.json'; // 등급컷 아카이브 저장소가 원본 (여기서 직접 가져옴)

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function makeToken(env, who, scope, ttl) {
  const body = b64u(enc.encode(JSON.stringify({ w: who, s: scope, exp: Math.floor(Date.now() / 1000) + ttl })));
  return body + '.' + await hmac(env.SESSION_SECRET, body);
}
async function verifyToken(env, token, scope) {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig || !safeEq(sig, await hmac(env.SESSION_SECRET, body))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
    return p.exp > Date.now() / 1000 && p.s === scope ? p : null;
  } catch { return null; }
}

// 비밀번호는 솔트 + PBKDF2 해시로만 저장 (원문은 아무도 볼 수 없음, 관리자 포함)
async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, k, 256));
}
async function savePw(env, n, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await env.CLASS_KV.put('pw:' + n, JSON.stringify({ salt: b64u(salt), h: await hashPw(pw, salt) }));
}
async function checkPw(rec, pw) {
  const salt = Uint8Array.from(atob(rec.salt.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  return safeEq(await hashPw(pw, salt), rec.h);
}

// 시도 제한: IP당 10분 8회, 학생(번호)당 10분 10회
async function limited(env, key, max) {
  const n = parseInt(await env.CLASS_KV.get(key) || '0', 10);
  if (n >= max) return true;
  await env.CLASS_KV.put(key, String(n + 1), { expirationTtl: 600 });
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') || 'x';
      if (await limited(env, 'rl:ip:' + ip, 8)) return json({ error: 'too_many' }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
      const name = String(b.name || '').trim().replace(/\s+/g, ''), num = parseInt(b.number, 10), secret = String(b.secret || '');
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      const hit = roster.find((s) => s.n === num && s.name.replace(/\s+/g, '') === name);
      if (!hit || !secret) return json({ error: 'invalid' }, 401);
      if (await limited(env, 'rl:n:' + hit.n, 10)) return json({ error: 'too_many' }, 429);
      const rec = JSON.parse(await env.CLASS_KV.get('pw:' + hit.n) || 'null');
      if (!rec) { // 첫 로그인: 반 코드 -> 비밀번호 설정 단계
        if (!safeEq(secret, env.CLASS_CODE)) return json({ error: 'invalid' }, 401);
        return json({ setup: true, token: await makeToken(env, hit.n, 'setup', 600) });
      }
      if (!await checkPw(rec, secret)) return json({ error: 'invalid' }, 401);
      return json({ token: await makeToken(env, hit.n, 'full', TTL) });
    }
    if (url.pathname === '/api/setpw' && request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
      const p = await verifyToken(env, b.token, 'setup'), pw = String(b.password || '');
      if (!p) return json({ error: 'unauthorized' }, 401);
      if (pw.length < 6 || pw.length > 64) return json({ error: 'weak' }, 400);
      if (await env.CLASS_KV.get('pw:' + p.w)) return json({ error: 'exists' }, 409);
      await savePw(env, p.w, pw);
      return json({ token: await makeToken(env, p.w, 'full', TTL) });
    }
    if (url.pathname === '/api/data' && request.method === 'GET') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      const me = roster.find((s) => s.n === tok.w);
      if (!me) return json({ error: 'unauthorized' }, 401);
      // 계정별 맞춤 데이터: 특별실 응시는 내 것만, 행사 참여자 명단은 반 공지라 전체 공개 (로그인한 학생만)
      const d = JSON.parse(await env.CLASS_KV.get('data') || '{}');
      d.me = { n: me.n, name: me.name };
      d.special = (d.special || []).filter((s) => (s.members || []).includes(me.name)).map((s) => ({ ...s, members: [me.name] }));
      return json(d);
    }
    if (url.pathname === '/api/scores') {
      // 내 점수: 브라우저에서 내 비밀번호로 암호화한 덩어리만 저장 (서버·관리자는 내용을 읽을 수 없음)
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const key = 'sc:' + tok.w;
      if (request.method === 'GET') { const v = await env.CLASS_KV.get(key); return json({ blob: v ? JSON.parse(v) : null }); }
      if (request.method === 'PUT') {
        const text = await request.text();
        if (text.length > 16000) return json({ error: 'too_big' }, 413);
        let b; try { b = JSON.parse(text); } catch { return json({ error: 'bad' }, 400); }
        if (typeof b.iv !== 'string' || typeof b.data !== 'string') return json({ error: 'bad' }, 400);
        await env.CLASS_KV.put(key, JSON.stringify({ iv: b.iv, data: b.data }));
        return json({ ok: true });
      }
      return json({ error: 'method' }, 405);
    }
    if (url.pathname === '/api/cuts' && request.method === 'GET') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      if (!await verifyToken(env, auth, 'full')) return json({ error: 'unauthorized' }, 401);
      let body = null;
      try {
        const r = await fetch(env.CUTS_URL || CUTS_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
        if (r.ok) { body = await r.text(); JSON.parse(body); await env.CLASS_KV.put('cuts', body); }
      } catch { body = null; }
      if (!body) body = await env.CLASS_KV.get('cuts'); // 원본에 못 닿으면 마지막으로 가져온 사본
      if (!body) return json({ error: 'unavailable' }, 503);
      return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    // 카카오톡·메신저 링크 미리보기용 이미지/아이콘 (로그인 없이 공개)
    if (url.pathname === '/og.jpg')
      return new Response(OG, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
    if (url.pathname === '/icon.png' || url.pathname === '/apple-touch-icon.png' || url.pathname === '/favicon.ico')
      return new Response(ICON, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
    if (url.pathname === '/fonts/pretendard-1.woff2')
      return new Response(FONT, { headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' } });
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    const a = ASSETS[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!a) return new Response('Not found', { status: 404 });
    return new Response(a.body, { headers: { 'content-type': a.type, 'cache-control': 'no-cache' } });
  },
};
