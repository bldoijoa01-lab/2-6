// 오늘의 알림장 자동 작성 + 급식(NEIS) 파싱 + 푸시 알림 문구. 서버(index.js)와 Node 테스트가 같이 씀.
const WD = '일월화수목금토';
export const kstISO = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
export const addDaysISO = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const diff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
export const fmtKo = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}(${WD[new Date(iso + 'T00:00:00Z').getUTCDay()]})`;
const DUE = /수행|제출|신청|마감|과제|보고서|발표|퀴즈|확인서/;
const RANK = { pin: -1, time: 0, hw: 1, notice: 2, prep: 3 };
export const pinKey = (e) => e.date + '|' + e.title;

// 내가 알림장에 담은 일정(pins: 'YYYY-MM-DD|제목' 배열): 시작 7일 전부터 당일(기간 일정은 끝날까지) 알려 줌
export function pinnedItems({ data, me, iso, pins }) {
  const set = new Set(pins || []), out = [];
  for (const e of data.events || []) {
    if (!e.date || !set.has(pinKey(e)) || (Array.isArray(e.audience) && !e.audience.includes(me.name)) || (e.dorm && !me.dorm)) continue;
    const s = e.date, end = e.end || e.date, d = diff(s, iso), note = e.note ? ' · ' + e.note : '';
    if (s <= iso && iso <= end) out.push({ k: 'pin', t: `오늘 ${e.title}${note}${end > s ? ` (${fmtKo(s)}~${fmtKo(end)})` : ''}`, s, e: end });
    else if (d === 1) out.push({ k: 'pin', t: `내일 ${e.title}${note}`, s, e: end });
    else if (d >= 2 && d <= 7) out.push({ k: 'pin', t: `${d}일 뒤(${fmtKo(s)}) ${e.title}${note}`, s, e: end });
  }
  return out;
}

// 오늘 날짜(iso) 기준으로 일정·기말고사·원반 이동·특별실을 문장으로 만든다. me: {n, name}, official: 학교 명단 {el2, blocks} 또는 null
export function buildAutoDaily({ data, me, iso, official, pins }) {
  const items = pinnedItems({ data, me, iso, pins });
  const pinSet = new Set(pins || []);
  const events = (data.events || []).filter((e) => (!Array.isArray(e.audience) || e.audience.includes(me.name)) && (!e.dorm || me.dorm));
  for (const e of events) {
    if (!e.date || /기말고사/.test(e.title) || pinSet.has(pinKey(e))) continue;   // 기말고사는 아래 시험 규칙에서 따로, 담은 일정은 위에서 이미
    const s = e.date, end = e.end || e.date, d = diff(s, iso), note = e.note ? ' · ' + e.note : '';
    if (s <= iso && iso <= end) items.push({ k: DUE.test(e.title) ? 'hw' : 'notice', t: `오늘 ${e.title}${note}${end > s ? ` (${fmtKo(s)}~${fmtKo(end)})` : ''}`, s, e: end });
    else if (d === 1) items.push({ k: DUE.test(e.title) ? 'hw' : 'notice', t: `내일 ${e.title}${note}` });
    else if (d >= 2 && d <= 3 && DUE.test(e.title)) items.push({ k: 'hw', t: `${d}일 뒤(${fmtKo(s)}) ${e.title}${note}` });
  }
  const ex = data.exam, days = (ex && ex.days) || [];
  if (days.length) {
    const first = days[0].date, last = days[days.length - 1].date, d0 = diff(first, iso), today = days.find((x) => x.date === iso), tomorrow = days.find((x) => x.date === addDaysISO(iso, 1));
    if (d0 > 0 && [14, 7, 3, 2, 1].includes(d0)) {
      items.push({ k: 'notice', t: `기말고사 D-${d0} (${fmtKo(first)}~${fmtKo(last)})` });
      if (d0 <= 3 && data.cautions && data.cautions[0]) items.push({ k: 'prep', t: `시험 준비물: ${data.cautions[0].t}` });
    }
    const mine = official && Array.isArray(official.el2) ? official.el2.map((x) => String(x).replace(/\s+/g, '')) : null;
    const examLine = (day) => day.cells.map((c, i) => {
      if (!c || c.k === 'self') return null;
      const name = (ex.periods[i] || {}).name || (i + 1) + '교시';
      if (c.k === 'elective') {
        const hit = mine ? c.t.split('/').map((x) => x.trim()).filter((x) => mine.includes(x.replace(/\s+/g, ''))) : [];
        return hit.length ? `${name} ${hit.join('/')}` : mine ? null : `${name} 선택과목`;
      }
      return `${name} ${c.t}`;
    }).filter(Boolean);
    if (today) { const l = examLine(today); if (l.length) items.push({ k: 'time', t: `오늘 시험: ${l.join(' · ')}` }); }
    else if (tomorrow) { const l = examLine(tomorrow); if (l.length) items.push({ k: 'time', t: `내일 시험: ${l.join(' · ')}` }); }
    const mv = data.move;
    if ((today || tomorrow) && mv && me.n) {
      const when = today ? '오늘' : '내일';
      items.push({ k: 'time', t: me.n <= mv.frontCount ? `${when} 원반 이동: ${mv.moveTime}에 ${mv.otherRoom}로 (앞번호 ${mv.frontCount}명)` : `${when} 시험은 우리 교실(${mv.ownRoom})에서 봐요` });
    }
    for (const sp of data.special || []) {
      if (!(sp.members || []).includes(me.name) || !sp.date) continue;
      if (sp.date === iso || sp.date === addDaysISO(iso, 1)) items.push({ k: 'time', t: `${sp.date === iso ? '오늘' : '내일'} 특별실 응시: ${sp.subject} · ${sp.room}` });
    }
  }
  items.sort((a, b) => RANK[a.k] - RANK[b.k]);
  if (!items.length) return { items: [{ k: 'notice', t: '오늘은 특별한 일정이 없어요 ✌️' }], empty: true };
  items.sort((a, b) => RANK[a.k] - RANK[b.k]);
  return { items: items.slice(0, 8), empty: false };
}

// NEIS 급식 JSON → [{name:'중식', dishes:[...], kcal:'994.6'}]
export function parseMeals(j) {
  const rows = j && j.mealServiceDietInfo && j.mealServiceDietInfo[1] && j.mealServiceDietInfo[1].row;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    name: r.MMEAL_SC_NM,
    dishes: String(r.DDISH_NM || '').split(/<br\s*\/?>/i).map((s) => s.replace(/\s*\([\d.]+\)\s*$/, '').replace(/&amp;/g, '&').trim()).filter(Boolean),
    kcal: String(r.CAL_INFO || '').replace(/\s*kcal/i, '').trim(),
  }));
}

// 오늘 일과(주간 시간표) 한 줄 요약. 선택 블록(A~E)은 학교 명단이 있으면 과목으로 바꿔 줌
export function timetableLine(data, iso, official) {
  const w = data.weekly, dow = new Date(iso + 'T00:00:00Z').getUTCDay();
  if (!w || dow < 1 || dow > 5) return '';
  const inv = {}; if (official && official.blocks) for (const [sub, L] of Object.entries(official.blocks)) inv[L] = sub;
  const parts = [];
  for (const r of w.rows || []) {
    const c = (r.cells || [])[dow - 1]; if (!c) continue;
    const name = c.k === 'block' ? (inv[c.b] || c.b + '선택') : c.t;
    if (name) parts.push(`${r.n}${name}`);
  }
  return parts.join(' ');
}

// 푸시 알림 제목/본문. 보낼 내용이 하나도 없으면 null (주말 등)
export function pushText({ iso, daily, meals, tt }) {
  const lines = [];
  if (daily && !daily.empty) lines.push(daily.items.slice(0, 3).map((i) => { const t = i.t.split(' · ')[0]; return t.length > 34 ? t.slice(0, 33) + '…' : t; }).join(' · '));   // 알림에는 제목만 짧게
  if (tt) lines.push('🕘 ' + tt);
  const lunch = (meals || []).find((m) => m.name === '중식');
  if (lunch) lines.push('🍚 점심 ' + lunch.dishes.slice(0, 4).join(', '));
  if (!lines.length) return null;
  const body = lines.join('\n');
  return { title: `📒 오늘의 알림장 · ${fmtKo(iso)}`, body: body.length > 230 ? body.slice(0, 227) + '…' : body, tag: 'daily-' + iso };
}

// 전날 저녁 알림: 내일 일정만 (buildAutoDaily를 내일 날짜로 돌려 '오늘 …' 항목만 골라 '내일'로 바꿈). 없으면 null
export function eveningText({ tomorrow, items }) {
  const mine = (items || []).filter((i) => /^오늘 /.test(i.t) && (!i.s || i.s === tomorrow || i.e === tomorrow)).map((i) => ({ ...i, t: i.t.replace(/^오늘 /, '') }));
  if (!mine.length) return null;
  const body = mine.slice(0, 4).map((i) => { const t = i.t.split(' · ')[0]; return '• ' + (t.length > 40 ? t.slice(0, 39) + '…' : t); }).join('\n');
  return { title: `⏰ 내일 일정 · ${fmtKo(tomorrow)}`, body, tag: 'eve-' + tomorrow };
}
