// 2-6 알림장 서버: 이름+번호 로그인 -> 서명 토큰 -> 데이터 제공
// KV: "roster" = [{"n":1,"name":"홍길동"}, ...], "data" = data.json 내용
// Secret: SESSION_SECRET
import ASSETS from './assets.js';
import FONT from './pretendard.woff2';
import OG from './og.jpg';
import ICON from './icon.png';
import { kstISO, addDaysISO, buildAutoDaily, pinnedItems, calOnlyItems, parseMeals, timetableLine, pushText, eveningText } from './daily.js';
import { sendPush } from './webpush.js';
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

// 시험 대비 정보(범위·팁) 저장: 관리자/교사가 과목별로 올림. 학생은 /api/data 로 읽기만 함
async function savePrep(env, b, who) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const subject = str(b.subject, 40);
  if (!subject) return json({ error: 'subject' }, 400);
  const data = JSON.parse(await env.CLASS_KV.get('data') || '{}');
  data.prep = data.prep && typeof data.prep === 'object' ? data.prep : {};
  if (b.op === 'delete') delete data.prep[subject];
  else {
    const tips = (Array.isArray(b.tips) ? b.tips : String(b.tips || '').split('\n')).map((t) => str(t, 160)).filter(Boolean).slice(0, 12);
    const range = str(b.range, 400);
    if (!range && !tips.length) delete data.prep[subject];
    else data.prep[subject] = { range, tips, by: who, at: new Date().toISOString().slice(0, 10) };
  }
  await env.CLASS_KV.put('data', JSON.stringify(data));
  return json({ ok: true });
}

// 오송고 급식(NEIS 오픈API). 하루치를 KV에 캐시해서 외부 호출을 최소화
async function getMeals(env, iso) {
  const ymd = iso.replace(/-/g, ''), key = 'meal:' + ymd, c = await env.CLASS_KV.get(key);
  if (c) return JSON.parse(c);
  let meals = [];
  try {
    const r = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=M10&SD_SCHUL_CODE=8000283&MLSV_YMD=${ymd}`);
    if (r.ok) meals = parseMeals(await r.json());
  } catch { /* 급식 서버 장애면 빈 값 (1시간 뒤 재시도) */ }
  await env.CLASS_KV.put(key, JSON.stringify(meals), { expirationTtl: meals.length ? 172800 : 3600 });
  return meals;
}
// 오늘의 알림장 묶음: 직접 쓴 알림장이 있으면 그것, 없으면 자동 작성. 조식은 기숙사생에게만
async function dailyBundle(env, data, me, iso, official, isDorm, pins) {
  const manual = data.daily && data.daily[iso];
  let daily;
  if (manual) {   // 직접 쓴 알림장 앞에 내가 담은 일정을 붙임
    const pi = pinnedItems({ data, me, iso, pins }), have = new Set(manual.items.map((i) => i.t)), co = calOnlyItems({ data, me, iso }).filter((i) => !have.has(i.t));   // 퇴사·입사는 직접 쓴 알림장에도 기본으로
    daily = { ...manual, items: [...pi, ...manual.items, ...co] };
  } else daily = { ...buildAutoDaily({ data, me, iso, official, pins }), by: '자동', auto: true };
  let meals = await getMeals(env, iso);
  if (!isDorm) meals = meals.filter((m) => m.name !== '조식');
  return { date: iso, daily, meals, tt: timetableLine(data, iso, official) };
}
// 알림 시각 기본값/선택 범위 (30분 단위)
const PUSH_DEFAULT = { dailyAt: '07:30', eveAt: '20:00' };
const PUSH_RANGE = { dailyAt: ['05:00', '10:00'], eveAt: ['16:00', '23:30'] };
const hm = (s) => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3, 5), 10);
const validAt = (kind, s) => typeof s === 'string' && /^\d\d:(00|30)$/.test(s) && hm(s) >= hm(PUSH_RANGE[kind][0]) && hm(s) <= hm(PUSH_RANGE[kind][1]);
// 한 사람에게 한 종류(daily|eve)를 만들어 보냄. 보낼 내용이 없으면 null
async function pushOne(env, ctx, n, me, rec, kind, iso) {
  me = { ...me, dorm: !!ctx.dorm[n] };
  const { data, dorm } = ctx, official = JSON.parse(await env.CLASS_KV.get('official:' + n) || 'null'), pins = JSON.parse(await env.CLASS_KV.get('pins:' + n) || '[]');
  let msg;
  if (kind === 'eve') { const tm = addDaysISO(iso, 1); msg = eveningText({ tomorrow: tm, items: buildAutoDaily({ data, me, iso: tm, official, pins }).items }); }
  else { const b = await dailyBundle(env, data, me, iso, official, !!dorm[n], pins); msg = pushText({ iso, daily: b.daily, meals: b.meals, tt: b.tt }); }
  if (!msg) return null;
  msg.url = '/#home';
  const res = { sent: 0, gone: 0, failed: 0, subs: 0 }, keep = [];
  for (const s of rec.subs) { res.subs++; const r = await sendPush(s, msg, env); if (r === 'gone') res.gone++; else { keep.push(s); if (r) res.sent++; else res.failed++; } }
  if (keep.length !== rec.subs.length) rec.subs = keep;
  return res;
}
// force=true: 관리자 수동 발송(시각·중복 무시) / false: 30분마다 도는 Cron — 각자 정한 시각이 된 사람에게만, 하루 한 번
async function dailyPush(env, kind, force) {
  const nowMs = Date.now(), iso = env.TODAY_OVERRIDE || kstISO(nowMs), kst = new Date(nowMs + 9 * 3600e3), nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const ctx = { data: JSON.parse(await env.CLASS_KV.get('data') || '{}'), dorm: JSON.parse(await env.CLASS_KV.get('dorm') || '{}') };
  const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]'), out = { sent: 0, gone: 0, failed: 0, skipped: 0, subs: 0 };
  for (const k of (await env.CLASS_KV.list({ prefix: 'push:' })).keys) {
    const n = parseInt(k.name.slice(5), 10), me = roster.find((x) => x.n === n && x.role !== 'teacher'); if (!me) continue;
    const rec = JSON.parse(await env.CLASS_KV.get(k.name) || '{}'); if (!rec.subs || !rec.subs.length || rec.off) continue;
    const kinds = kind ? [kind] : ['daily', 'eve'];
    let dirty = false;
    for (const kd of kinds) {
      const o = { daily: true, eve: true, ...PUSH_DEFAULT, ...(rec.opts || {}) };
      if (o[kd] === false) { out.skipped++; continue; }
      if (!force) {   // 정한 시각 이후 90분 안이고 오늘 아직 안 보냈을 때만
        const at = hm(o[kd + 'At']); rec.last = rec.last || {};
        if (nowMin < at || nowMin - at > 90 || rec.last[kd] === iso) continue;
        rec.last[kd] = iso; dirty = true;
      }
      const r = await pushOne(env, ctx, n, me, rec, kd, iso);
      if (!r) { out.skipped++; continue; }
      for (const f of ['sent', 'gone', 'failed', 'subs']) out[f] += r[f];
      if (r.gone) dirty = true;
    }
    if (dirty) await env.CLASS_KV.put(k.name, JSON.stringify(rec));
  }
  return out;
}

// 오늘의 알림장: 날짜별 전달사항·준비물·숙제 (관리자/교사가 씀, 학생은 읽기만). 최근 30일만 보관
async function saveDaily(env, b, who) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return json({ error: 'date' }, 400);
  const data = JSON.parse(await env.CLASS_KV.get('data') || '{}');
  data.daily = data.daily && typeof data.daily === 'object' ? data.daily : {};
  const kinds = ['notice', 'prep', 'hw', 'time'];
  const items = (Array.isArray(b.items) ? b.items : []).map((i) => ({ k: kinds.includes(i && i.k) ? i.k : 'notice', t: str(i && i.t, 160) })).filter((i) => i.t).slice(0, 14);
  if (b.op === 'delete' || !items.length) delete data.daily[b.date];
  else data.daily[b.date] = { items, by: who, at: new Date().toISOString().slice(0, 16) };
  Object.keys(data.daily).sort().reverse().slice(30).forEach((k) => delete data.daily[k]);
  await env.CLASS_KV.put('data', JSON.stringify(data));
  return json({ ok: true });
}

async function personalized(env, me) {
  const d = JSON.parse(await env.CLASS_KV.get('data') || '{}');
  d.me = { n: me.n, name: me.name, role: me.role === 'teacher' ? 'teacher' : 'student', admin: !!me.admin };
  d.special = (d.special || []).filter((x) => (x.members || []).includes(me.name)).map((x) => ({ ...x, members: [me.name] }));
  // 대상자가 정해진 일정(audience)은 대상 학생에게만 내려보냄 (다른 학생 이름은 노출하지 않음). 교사는 전체 확인
  const dormMap = me.role === 'teacher' ? {} : JSON.parse(await env.CLASS_KV.get('dorm') || '{}'), isDormMe = !!dormMap[me.n];
  if (me.role !== 'teacher') {
    d.events = (d.events || []).filter((e) => (!Array.isArray(e.audience) || e.audience.includes(me.name)) && (!e.dorm || isDormMe)).map((e) => {
      if (e.dorm) return { ...e, target: true, targetLabel: '기숙사' };   // 퇴사·입사 등 기숙사생 전용
      if (!Array.isArray(e.audience)) return e; const { audience, ...rest } = e; return { ...rest, target: true };
    });
  }
  if (me.role !== 'teacher' && await env.CLASS_KV.get('tut:' + me.n)) d.tutorial = true;   // 다음 로그인 때 가이드를 보여 달라고 표시된 학생
  if (me.role !== 'teacher') {   // 오늘의 알림장(자동 작성) + 급식(조식은 기숙사생만) + 내 기숙사 호실
    const iso = env.TODAY_OVERRIDE || kstISO(), dorm = dormMap, official0 = JSON.parse(await env.CLASS_KV.get('official:' + me.n) || 'null');
    d.me.dorm = dorm[me.n] || null;
    const pins = JSON.parse(await env.CLASS_KV.get('pins:' + me.n) || '[]'), b = await dailyBundle(env, d, { ...me, dorm: isDormMe }, iso, official0, !!dorm[me.n], pins);
    d.pins = pins; d.daily = d.daily || {}; d.daily[iso] = b.daily;   // 담은 일정이 있으면 직접 쓴 알림장에도 붙여서 내려줌
    d.today = { date: iso, meals: b.meals };
  }
  if (me.role !== 'teacher') { const ms = JSON.parse(await env.CLASS_KV.get('msg:' + me.n) || '[]'); if (ms.length) d.messages = ms.slice(-20).reverse(); }   // 관리자가 보낸 쪽지(받는 사람 본인 것만)
  const off = JSON.parse(await env.CLASS_KV.get('official:' + me.n) || 'null');   // 선생님이 올린 학교 기준 선택과목(암호화 대상 아님)
  if (off) d.official = off;
  return d;
}

async function saveOfficial(env, roster, rows) {
  const valid = new Set(roster.filter((x) => x.role !== 'teacher').map((x) => x.n));
  let saved = 0;
  for (const r of rows) {
    if (!valid.has(r.n) || !Array.isArray(r.el2) || r.el2.length > 10) continue;
    const el2 = r.el2.map((x) => String(x).slice(0, 40)), blocks = {};
    for (const [k, v] of Object.entries(r.blocks || {})) if (el2.includes(k) && /^[A-E]$/.test(v)) blocks[k] = v;
    await env.CLASS_KV.put('official:' + r.n, JSON.stringify({ el2, blocks, at: Date.now() })); saved++;
  }
  return saved;
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(dailyPush(env, null, false)); },   // 30분마다: 각자 정한 시각이 된 사람에게 아침 알림장/저녁 일정 알림
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
    if (url.pathname === '/api/classmates' && request.method === 'GET') {   // 쪽지 받는 사람 고르기용 (이름·번호만)
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      return json({ students: roster.filter((x) => x.role !== 'teacher').map((x) => ({ n: x.n, name: x.name })) });
    }
    if (url.pathname === '/api/msg' && request.method === 'POST') {   // 쪽지 보내기: 학생·관리자·선생님 누구나 (학생→학생). 받는 사람에게만 보임
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      const me = roster.find((x) => x.n === tok.w); if (!me) return json({ error: 'unauthorized' }, 401);
      const b = await request.json().catch(() => ({}));
      const text = typeof b.text === 'string' ? b.text.trim().slice(0, 300) : '';
      if (!text) return json({ error: 'text' }, 400);
      const power = me.admin || me.role === 'teacher';
      const students = roster.filter((x) => x.role !== 'teacher' && x.n !== me.n);
      const want = b.to === 'all' && power ? students.map((x) => x.n) : (Array.isArray(b.to) ? b.to : []);
      const targets = students.filter((x) => want.includes(x.n));
      if (!targets.length || targets.length > (power ? 40 : 5)) return json({ error: 'to' }, 400);
      if (!power) {   // 하루 쪽지 수 제한 (도배 방지)
        const key = 'rl:msg:' + me.n + ':' + new Date().toISOString().slice(0, 10), used = parseInt(await env.CLASS_KV.get(key) || '0', 10);
        if (used + targets.length > 30) return json({ error: 'too_many' }, 429);
        await env.CLASS_KV.put(key, String(used + targets.length), { expirationTtl: 172800 });
      }
      const at = new Date().toISOString().slice(0, 16);
      for (const t of targets) {
        const ms = JSON.parse(await env.CLASS_KV.get('msg:' + t.n) || '[]');
        ms.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), from: me.role === 'teacher' ? me.name + ' 선생님' : me.name, fromN: me.n, text, at, read: false });
        await env.CLASS_KV.put('msg:' + t.n, JSON.stringify(ms.slice(-20)));
      }
      return json({ ok: true, sent: targets.length });
    }
    if (url.pathname === '/api/msgs-sent' && request.method === 'GET') {   // 내가 보낸 쪽지 (읽음 여부 포함) — 본인이 보낸 것만
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]'), out = [];
      for (const k of (await env.CLASS_KV.list({ prefix: 'msg:' })).keys) {
        const n = parseInt(k.name.slice(4), 10), st = roster.find((x) => x.n === n);
        for (const m of JSON.parse(await env.CLASS_KV.get(k.name) || '[]')) if (m.fromN === tok.w) out.push({ id: m.id, n, name: st ? st.name : String(n), text: m.text, at: m.at, read: !!m.read });
      }
      out.sort((x, y) => (x.at < y.at ? 1 : -1));
      return json({ msgs: out.slice(0, 40) });
    }
    if (url.pathname === '/api/msg-del' && request.method === 'POST') {   // 내가 보낸 쪽지 지우기
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const b = await request.json().catch(() => ({}));
      const ms = JSON.parse(await env.CLASS_KV.get('msg:' + b.n) || '[]');
      await env.CLASS_KV.put('msg:' + b.n, JSON.stringify(ms.filter((m) => !(m.id === b.id && m.fromN === tok.w))));
      return json({ ok: true });
    }
    if (url.pathname === '/api/pins' && request.method === 'POST') {   // 일정을 내 알림장에 담기/빼기
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const b = await request.json().catch(() => ({})), data = JSON.parse(await env.CLASS_KV.get('data') || '{}');
      const ok = typeof b.key === 'string' && (data.events || []).some((e) => e.date && e.date + '|' + e.title === b.key);
      if (!ok) return json({ error: 'bad' }, 400);
      let pins = JSON.parse(await env.CLASS_KV.get('pins:' + tok.w) || '[]').filter((x) => x !== b.key);
      if (b.on) pins.push(b.key);
      pins = pins.slice(-40);
      await env.CLASS_KV.put('pins:' + tok.w, JSON.stringify(pins));
      return json({ ok: true, pins });
    }
    if (url.pathname === '/api/push/key' && request.method === 'GET') return json({ key: env.VAPID_PUBLIC || '' });
    if (url.pathname.startsWith('/api/push/') && request.method === 'POST') {   // 푸시 알림 구독 관리 (로그인한 학생만)
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const b = await request.json().catch(() => ({})), key = 'push:' + tok.w, rec = JSON.parse(await env.CLASS_KV.get(key) || '{"subs":[]}'), act = url.pathname.slice('/api/push/'.length);
      if (act === 'subscribe') {
        const s = b.sub;
        if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 600 || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') return json({ error: 'bad' }, 400);
        rec.subs = (rec.subs || []).filter((x) => x.endpoint !== s.endpoint);
        rec.subs.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, at: Date.now() });
        rec.subs = rec.subs.slice(-3); delete rec.off;
        await env.CLASS_KV.put(key, JSON.stringify(rec));
        return json({ ok: true });
      }
      if (act === 'status') return json({ ok: true, subs: (rec.subs || []).length, opts: { daily: true, eve: true, ...PUSH_DEFAULT, ...(rec.opts || {}) } });
      if (act === 'opts') {
        rec.opts = { daily: true, eve: true, ...PUSH_DEFAULT, ...(rec.opts || {}) };
        for (const k of ['daily', 'eve']) if (typeof b[k] === 'boolean') rec.opts[k] = b[k];
        for (const k of ['dailyAt', 'eveAt']) if (validAt(k, b[k])) { rec.opts[k] = b[k]; if (rec.last) delete rec.last[k.replace('At', '')]; }   // 시각을 바꾸면 오늘 분을 다시 받을 수 있게
        await env.CLASS_KV.put(key, JSON.stringify(rec));
        return json({ ok: true, opts: rec.opts });
      }
      if (act === 'unsubscribe') { rec.subs = (rec.subs || []).filter((x) => x.endpoint !== b.endpoint); await env.CLASS_KV.put(key, JSON.stringify(rec)); return json({ ok: true }); }
      if (act === 'test') {
        let ok = 0;
        for (const s of rec.subs || []) if ((await sendPush(s, { title: '🔔 알림 테스트', body: '이렇게 알림이 와요! 매일 아침 오늘의 알림장을 보내 드릴게요.', tag: 'test', url: '/#home' }, env)) === true) ok++;
        return json({ ok: true, delivered: ok, subs: (rec.subs || []).length });
      }
      return json({ error: 'not_found' }, 404);
    }
    if (url.pathname === '/api/msg-read' && request.method === 'POST') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const b = await request.json().catch(() => ({}));
      const ms = JSON.parse(await env.CLASS_KV.get('msg:' + tok.w) || '[]');
      for (const m of ms) if (b.all || m.id === b.id) m.read = true;
      await env.CLASS_KV.put('msg:' + tok.w, JSON.stringify(ms));
      return json({ ok: true });
    }
    if (url.pathname === '/api/tutorial-done' && request.method === 'POST') {
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      await env.CLASS_KV.delete('tut:' + tok.w);
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
    if (url.pathname.startsWith('/api/admin/')) {
      // 관리자(운영자 학생 계정) 전용: 가입 현황 · 학생이 보낸 선택과목 · 업로드 파일. 암호화된 성적·내신은 볼 수 없음
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const tok = await verifyToken(env, auth, 'full');
      if (!tok) return json({ error: 'unauthorized' }, 401);
      const roster = JSON.parse(await env.CLASS_KV.get('roster') || '[]');
      const me = roster.find((x) => x.n === tok.w);
      if (!me || !me.admin) return json({ error: 'forbidden' }, 403);
      const sub = url.pathname.slice('/api/admin/'.length);
      if (sub === 'prep' && request.method === 'POST') return savePrep(env, await request.json().catch(() => ({})), me.name);
      if (sub === 'daily' && request.method === 'POST') return saveDaily(env, await request.json().catch(() => ({})), me.name);
      if (sub === 'setting' && request.method === 'POST') {   // 알림 필수 켜기/끄기
        const b1 = await request.json().catch(() => ({})), dd = JSON.parse(await env.CLASS_KV.get('data') || '{}');
        if (typeof b1.pushRequired === 'boolean') dd.pushRequired = b1.pushRequired;
        await env.CLASS_KV.put('data', JSON.stringify(dd));
        return json({ ok: true, pushRequired: dd.pushRequired !== false });
      }
      if (sub === 'push-now' && request.method === 'POST') { const b0 = await request.json().catch(() => ({})); return json({ ok: true, ...(await dailyPush(env, b0.kind === 'eve' ? 'eve' : 'daily', true)) }); }   // 지금 알림장 푸시 보내기(테스트·재발송)
      if (sub === 'overview' && request.method === 'GET') {
        const names = async (prefix) => (await env.CLASS_KV.list({ prefix })).keys;
        const [pw, sh, off, subs, ups] = await Promise.all([names('pw:'), names('share:'), names('official:'), names('submit:'), names('upload:')]);
        const num = (k, pre) => parseInt(k.name.slice(pre.length), 10);
        const active = new Set(pw.map((k) => num(k, 'pw:'))), shared = new Set(sh.map((k) => num(k, 'share:'))), official = new Set(off.map((k) => num(k, 'official:')));
        const subCount = {}; subs.forEach((k) => { const n = parseInt(k.name.split(':')[1], 10); subCount[n] = (subCount[n] || 0) + 1; });
        const students = roster.filter((x) => x.role !== 'teacher').map((x) => ({ n: x.n, name: x.name, active: active.has(x.n), shared: shared.has(x.n), official: official.has(x.n), subs: subCount[x.n] || 0 }));
        const teachers = roster.filter((x) => x.role === 'teacher').map((x) => ({ name: x.name, loggedIn: active.has(x.n) }));
        const submissions = [];
        for (const k of subs) { const v = await env.CLASS_KV.get(k.name); if (v) submissions.push({ key: k.name, ...JSON.parse(v) }); }
        submissions.sort((a, b) => b.at - a.at);
        return json({ students, teachers, submissions, uploads: ups.map((k) => ({ key: k.name, ...(k.metadata || {}) })), at: Date.now() });
      }
      if (sub === 'file' && request.method === 'GET') {
        const key = url.searchParams.get('key') || '';
        const isUp = key.startsWith('upload:'), kvKey = isUp ? key : 'submitfile:' + key.replace(/^submit:/, '');
        if (!isUp && !key.startsWith('submit:')) return json({ error: 'bad' }, 400);
        const r = await env.CLASS_KV.getWithMetadata(kvKey, 'arrayBuffer');
        if (!r.value) return json({ error: 'not_found' }, 404);
        const md = r.metadata || {};
        return new Response(r.value, { headers: { 'content-type': md.type || 'application/octet-stream', 'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(md.name || 'file'), 'cache-control': 'no-store' } });
      }
      let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); } }
      if (sub === 'official' && request.method === 'POST') {
        if (!Array.isArray(b.rows) || b.rows.length > 100) return json({ error: 'bad' }, 400);
        return json({ ok: true, saved: await saveOfficial(env, roster, b.rows) });
      }
      if (sub === 'submission-delete' && request.method === 'POST') {
        const key = String(b.key || '').replace(/^submit:/, '');
        await env.CLASS_KV.delete('submit:' + key); await env.CLASS_KV.delete('submitfile:' + key);
        return json({ ok: true });
      }
      return json({ error: 'not_found' }, 404);
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
      if (sub === 'prep' && request.method === 'POST') return savePrep(env, b, '선생님');
      if (sub === 'daily' && request.method === 'POST') return saveDaily(env, b, '선생님');
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
