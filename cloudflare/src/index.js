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

// 계정별 맞춤 데이터: 특별실 응시는 내 것만, 행사 참여자 명단은 반 공지라 전체 공개 (로그인한 사람만)
async function personalized(env, me) {
  const d = JSON.parse(await env.CLASS_KV.get('data') || '{}');
  d.me = { n: me.n, name: me.name, role: me.role === 'teacher' ? 'teacher' : 'student' };
  d.special = (d.special || []).filter((x) => (x.members || []).includes(me.name)).map((x) => ({ ...x, members: [me.name] }));
  // 대상자가 정해진 일정(audience)은 대상 학생에게만 내려보냄 (다른 학생 이름은 노출하지 않음). 교사는 전체 확인
  if (me.role !== 'teacher') {
    d.events = (d.events || []).filter((e) => !Array.isArray(e.audience) || e.audience.includes(me.name)).map((e) => {
      if (!Array.isArray(e.audience)) return e; const { audience, ...rest } = e; return { ...rest, target: true };
    });
  }
  const off = JSON.parse(await env.CLASS_KV.get('official:' + me.n) || 'null');   // 선생님이 올린 학교 기준 선택과목(암호화 대상 아님)
  if (off) d.official = off;
  return d;
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
        const code = hit.role === 'teacher' ? env.TEACHER_CODE : env.CLASS_CODE;   // 교사 계정은 별도 코드로만 만들 수 있음
        if (!code || !safeEq(secret, code)) return json({ error: 'invalid' }, 401);
        return json({ setup: true, token: await makeToken(env, hit.n, 'setup', 600) });
      }
      if (!await checkPw(rec, secret)) return json({ error: 'invalid' }, 401);
      return json({ token: await makeToken(env, hit.n, 'full', TTL) });
    }
    if (url.pathname === '/api/setpw' && request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
      const p = await verifyToken(env, b.token, 'setup'), pw = String(b.password || '');
      if (!p) return json({ error: 'unauthorized' }, 401);
      if (pw.length < 4 || pw.length > 64) return json({ error: 'weak' }, 400);
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
      const d = await personalized(env, me);
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
    if (url.pathname === '/api/submit' && request.method === 'POST') {
      // 학생이 보내는 선택과목 목록(글 + 파일 아무 형식): 선생님/운영자가 읽어서 반영
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const text = await request.text();
      if (text.length > 7 * 1024 * 1024) return json({ error: 'too_big' }, 413);
      let b; try { b = JSON.parse(text); } catch { return json({ error: 'bad' }, 400); }
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      const me = roster.find((x) => x.n === tok.w); if (!me) return json({ error: 'unauthorized' }, 401);
      const msg = typeof b.text === 'string' ? b.text.trim().slice(0, 4000) : '';
      const f = b.file && typeof b.file.b64 === 'string' ? b.file : null;
      if (!msg && !f) return json({ error: 'empty' }, 400);
      const mine = await env.CLASS_KV.list({ prefix: 'submit:' + me.n + ':' });
      if (mine.keys.length >= 10) return json({ error: 'limit' }, 429);
      const ts = Date.now(), key = 'submit:' + me.n + ':' + ts;
      let file = null;
      if (f) {
        const bin = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
        if (bin.length > 5 * 1024 * 1024) return json({ error: 'file_big' }, 413);
        const fname = String(f.name || 'file').replace(/[^\w.\-가-힣 ()]/g, '_').slice(0, 80);
        await env.CLASS_KV.put('submitfile:' + me.n + ':' + ts, bin, { metadata: { name: fname, type: String(f.type || '').slice(0, 80) } });
        file = { name: fname, type: String(f.type || '').slice(0, 80), size: bin.length };
      }
      await env.CLASS_KV.put(key, JSON.stringify({ n: me.n, name: me.name, text: msg, file, at: ts }));
      return json({ ok: true });
    }
    if (url.pathname === '/api/teacherkeys' && request.method === 'GET') {
      // 교사 공개키 목록 (학생이 성적 사본을 선생님 전용으로 암호화할 때 씀. 공개키라 노출돼도 안전)
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      if (!await verifyToken(env, auth, 'full')) return json({ error: 'unauthorized' }, 401);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]'), keys = [];
      for (const t of roster.filter((x) => x.role === 'teacher')) {
        const rec = JSON.parse(await env.CLASS_KV.get('tkey:' + t.n) || 'null');
        if (rec && rec.pub) keys.push({ n: t.n, pub: rec.pub });
      }
      return json({ keys });
    }
    if (url.pathname === '/api/share' && request.method === 'PUT') {
      // 학생의 점수·내신·선택과목 사본: 학생 기기에서 교사 공개키로 암호화한 것만 저장 (서버는 못 읽음)
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const text = await request.text();
      if (text.length > 40000) return json({ error: 'too_big' }, 413);
      let b; try { b = JSON.parse(text); } catch { return json({ error: 'bad' }, 400); }
      if (typeof b.iv !== 'string' || typeof b.data !== 'string' || !b.keys || typeof b.keys !== 'object') return json({ error: 'bad' }, 400);
      await env.CLASS_KV.put('share:' + tok.w, JSON.stringify({ iv: b.iv, data: b.data, keys: b.keys, at: Date.now() }));
      return json({ ok: true });
    }
    if (url.pathname.startsWith('/api/teacher/')) {
      // 교사 전용: 학생 현황 · 비밀번호 초기화 · 일정/공지 관리
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      const me = roster.find((x) => x.n === tok.w);
      if (!me || me.role !== 'teacher') return json({ error: 'forbidden' }, 403);
      const sub = url.pathname.slice('/api/teacher/'.length);
      if (sub === 'students' && request.method === 'GET') {
        const keys = await env.CLASS_KV.list({ prefix: 'pw:' });
        const active = new Set(keys.keys.map((k) => parseInt(k.name.slice(3), 10)));
        const sh = await env.CLASS_KV.list({ prefix: 'share:' }), shared = new Set(sh.keys.map((k) => parseInt(k.name.slice(6), 10)));
        return json({ students: roster.filter((x) => x.role !== 'teacher').map((x) => ({ n: x.n, name: x.name, active: active.has(x.n), shared: shared.has(x.n) })) });
      }
      if (sub === 'upload' && request.method === 'POST') {   // 아무 형식의 파일이나 보관 (운영자가 읽어서 반영할 수 있게)
        const buf = await request.arrayBuffer();
        if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) return json({ error: 'size' }, 413);
        const name = decodeURIComponent(request.headers.get('x-filename') || 'file').replace(/[^\w.\-가-힣 ()]/g, '_').slice(0, 80);
        const key = 'upload:' + Date.now() + ':' + name;
        await env.CLASS_KV.put(key, buf, { metadata: { name, type: request.headers.get('content-type') || '', size: buf.byteLength, by: me.name, at: Date.now() } });
        return json({ ok: true, key });
      }
      if (sub === 'uploads' && request.method === 'GET') {
        const list = await env.CLASS_KV.list({ prefix: 'upload:' });
        return json({ uploads: list.keys.map((k) => ({ key: k.name, ...(k.metadata || {}) })) });
      }
      let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); } }
      if (sub === 'mykey' && request.method === 'GET') return json(JSON.parse(await env.CLASS_KV.get('tkey:' + me.n) || 'null') || {});
      if (sub === 'keys' && request.method === 'POST') {   // 교사 키쌍: 공개키(JWK) + 교사 비밀번호로 잠근 비밀키
        if (!b.pub || !b.priv || typeof b.priv.iv !== 'string' || typeof b.priv.data !== 'string') return json({ error: 'bad' }, 400);
        await env.CLASS_KV.put('tkey:' + me.n, JSON.stringify({ pub: b.pub, priv: b.priv }));
        return json({ ok: true });
      }
      if (sub === 'official' && request.method === 'POST') {
        // 학교 기준 선택과목 명단: [{n, el2:[과목], blocks:{과목:'A'}}]  (암호화하지 않고 저장: 학생 본인과 교사만 쓰는 학교 명단 정보)
        if (!Array.isArray(b.rows) || b.rows.length > 100) return json({ error: 'bad' }, 400);
        const valid = new Set(roster.filter((x) => x.role !== 'teacher').map((x) => x.n));
        let saved = 0;
        for (const r of b.rows) {
          if (!valid.has(r.n) || !Array.isArray(r.el2) || r.el2.length > 10) continue;
          const el2 = r.el2.map((x) => String(x).slice(0, 40)), blocks = {};
          for (const [k, v] of Object.entries(r.blocks || {})) if (el2.includes(k) && /^[A-E]$/.test(v)) blocks[k] = v;
          await env.CLASS_KV.put('official:' + r.n, JSON.stringify({ el2, blocks, at: Date.now() })); saved++;
        }
        return json({ ok: true, saved });
      }
      if (sub === 'official' && request.method === 'GET') {
        const out = {}; const list = await env.CLASS_KV.list({ prefix: 'official:' });
        for (const k of list.keys) { const v = await env.CLASS_KV.get(k.name); if (v) out[k.name.slice(9)] = JSON.parse(v); }
        return json({ official: out });
      }
      if (sub === 'official-clear' && request.method === 'POST') {
        const list = await env.CLASS_KV.list({ prefix: 'official:' });
        for (const k of list.keys) await env.CLASS_KV.delete(k.name);
        return json({ ok: true });
      }
      if (sub === 'submissions' && request.method === 'GET') {
        const list = await env.CLASS_KV.list({ prefix: 'submit:' }), out = [];
        for (const k of list.keys) { const v = await env.CLASS_KV.get(k.name); if (v) out.push({ key: k.name, ...JSON.parse(v) }); }
        out.sort((x, y) => y.at - x.at);
        return json({ submissions: out });
      }
      if (sub === 'submission-file' && request.method === 'GET') {
        const key = (url.searchParams.get('key') || '').replace(/^submit:/, '');
        const r = await env.CLASS_KV.getWithMetadata('submitfile:' + key, 'arrayBuffer');
        if (!r.value) return json({ error: 'not_found' }, 404);
        const md = r.metadata || {};
        return new Response(r.value, { headers: { 'content-type': md.type || 'application/octet-stream', 'content-disposition': 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(md.name || 'file'), 'cache-control': 'no-store' } });
      }
      if (sub === 'submission-delete' && request.method === 'POST') {
        const key = String(b.key || '').replace(/^submit:/, '');
        await env.CLASS_KV.delete('submit:' + key); await env.CLASS_KV.delete('submitfile:' + key);
        return json({ ok: true });
      }
      if (sub === 'rewrap' && request.method === 'POST') {   // 교사 열쇠 교체 후, 학생 사본의 감싼 열쇠만 새 공개키로 바꿈 (사본 내용은 그대로)
        const st = JSON.parse(await env.CLASS_KV.get('share:' + b.n) || 'null');
        if (!st || typeof b.key !== 'string') return json({ error: 'not_found' }, 404);
        st.keys = st.keys && typeof st.keys === 'object' ? st.keys : {}; st.keys[String(me.n)] = b.key;
        await env.CLASS_KV.put('share:' + b.n, JSON.stringify(st));
        return json({ ok: true });
      }
      if (sub === 'shares' && request.method === 'GET') {
        const out = {};
        const list = await env.CLASS_KV.list({ prefix: 'share:' });
        for (const k of list.keys) { const v = await env.CLASS_KV.get(k.name); if (v) out[k.name.slice(6)] = JSON.parse(v); }
        return json({ shares: out });
      }
      if (sub === 'preview' && request.method === 'GET') {   // 학생 화면 미리보기 (읽기 전용: 그 학생이 보는 공통 데이터만, 암호화된 점수·선택과목은 볼 수 없음)
        const st = roster.find((x) => x.n === parseInt(url.searchParams.get('n'), 10) && x.role !== 'teacher');
        if (!st) return json({ error: 'not_found' }, 404);
        return json(await personalized(env, st));
      }
      if (sub === 'reset' && request.method === 'POST') {
        const st = roster.find((x) => x.n === b.n && x.role !== 'teacher');
        if (!st) return json({ error: 'not_found' }, 404);
        await env.CLASS_KV.delete('pw:' + st.n); await env.CLASS_KV.delete('sc:' + st.n); await env.CLASS_KV.delete('share:' + st.n);   // 비밀번호 초기화(암호화 점수는 키가 바뀌어 복구 불가라 같이 삭제)
        await env.CLASS_KV.delete('rl:n:' + st.n);
        return json({ ok: true });
      }
      if (sub === 'content' && request.method === 'POST') {
        const data = JSON.parse(await env.CLASS_KV.get('data') || '{}');
        const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
        const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
        const goodUrl = (v) => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };
        const kind = b.kind === 'notice' ? 'notices' : 'events';
        data[kind] = Array.isArray(data[kind]) ? data[kind] : [];
        if (b.op === 'add') {
          const e = { title: str(b.title, 80) };
          if (!e.title) return json({ error: 'title' }, 400);
          if (kind === 'events') {
            if (!isDate(b.date)) return json({ error: 'date' }, 400);
            e.date = b.date; if (isDate(b.end) && b.end > b.date) e.end = b.end;
            if (str(b.note, 120)) e.note = str(b.note, 120);
          } else if (str(b.text, 200)) e.text = str(b.text, 200);
          if (b.link && goodUrl(b.link)) e.link = { url: b.link, label: str(b.linkLabel, 20) || '열기' };
          data[kind].push(e);
        } else if (b.op === 'delete') {
          const t = str(b.title, 80);
          data[kind] = data[kind].filter((e) => !(e.title === t && (kind === 'notices' || e.date === b.date)));
        } else return json({ error: 'op' }, 400);
        await env.CLASS_KV.put('data', JSON.stringify(data));
        return json({ ok: true });
      }
      return json({ error: 'not_found' }, 404);
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
