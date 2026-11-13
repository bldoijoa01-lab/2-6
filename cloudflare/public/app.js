// 2-6 알림장 웹앱 v1 — 정적 사이트 (GitHub Pages). 데이터는 data.json 만 고치면 됨.
(function () {
  'use strict';

  // ---------- 첫 진입 스플래시 ----------
  (function () {
    var sp = document.getElementById('splash'); if (!sp) return;
    var seen = false; try { seen = !!sessionStorage.getItem('splash26'); sessionStorage.setItem('splash26', '1'); } catch (e) {}
    if (seen || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { sp.remove(); return; }
    sp.addEventListener('animationend', function (e) { if (e.animationName === 'splashOut') sp.remove(); });
    setTimeout(function () { if (sp.parentNode) sp.remove(); }, 2500);
  })();

  // ---------- helpers ----------
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function head(eyebrow, title) { return h('div', { class: 'card-h' }, [h('div', { class: 'eyebrow', text: eyebrow }), h('h2', { text: title })]); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  // "오늘"은 항상 한국 날짜 기준 (자정 00:00 KST)
  function todayKST() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-');
    return Date.UTC(+parts[0], +parts[1] - 1, +parts[2]);
  }
  function toUTC(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function diffDays(iso, base) { return Math.round((toUTC(iso) - base) / 86400000); }
  function fmt(iso) { var d = new Date(toUTC(iso)); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + DOW[d.getUTCDay()] + ')'; }

  var TODAY = todayKST();
  var DATA = null;

  // ---------- tabs ----------
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var nsSub = 'main';
  function applyNsSub() {
    var g = document.getElementById('panel-grade'), m = document.getElementById('ns-main');
    if (g) g.hidden = nsSub !== 'grade'; if (m) m.hidden = nsSub !== 'main';
    Array.prototype.forEach.call(document.querySelectorAll('#ns-seg .seg-b'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-sub') === nsSub ? 'true' : 'false'); });
  }
  function selectTab(name) {
    if (name === 'grade') { nsSub = 'grade'; name = 'naesin'; }   // 등급컷은 내신 탭 안의 하위 페이지
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById('panel-' + t.getAttribute('data-tab')).hidden = !on;
    });
    if (name === 'naesin') { applyNsSub(); if (nsSub === 'grade') loadGrade(); else renderNaesin(); }
    if (name === 'me') renderMe();
    try { history.replaceState(null, '', '#' + (name === 'naesin' && nsSub === 'grade' ? 'grade' : name)); } catch (e) {}
  }
  Array.prototype.forEach.call(document.querySelectorAll('#ns-seg .seg-b'), function (b) {
    b.addEventListener('click', function () { nsSub = b.getAttribute('data-sub'); applyNsSub(); if (nsSub === 'grade') loadGrade(); else renderNaesin(); });
  });
  tabs.forEach(function (t) { t.addEventListener('click', function () { selectTab(t.getAttribute('data-tab')); }); });

  document.getElementById('logoutBtn').addEventListener('click', function () { store('tok26', null); store('gk26', null); store('pwlen26', null); store('gcscore26', null); store('pref26', null); location.hash = ''; location.reload(); });

  // ---------- 테마 ----------
  (function () {
    var btn = document.getElementById('themeBtn'), root = document.documentElement;
    function apply(t) { if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme'); }
    try { apply(localStorage.getItem('theme26')); } catch (e) {}
    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      var t = dark ? 'light' : 'dark', reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      var commit = function () { apply(t); try { localStorage.setItem('theme26', t); } catch (e) {} };
      if (document.startViewTransition && !reduce) document.startViewTransition(commit);
      else { root.classList.add('theme-fade'); commit(); setTimeout(function () { root.classList.remove('theme-fade'); }, 500); }
    });
  })();

  // ---------- 행사: 내 분야 / 참여자 보기 / 링크 / 공고 ----------
  function trackRow(t, meName) {
    var cls = { '물리': 'phys', '의생명': 'bio', '화학': 'chem' }[t.name] || 'phys';
    return h('div', { class: 'track' }, [h('span', { class: 'chip ' + cls, text: t.name }),
      h('div', null, [h('div', { text: t.topic || '' }),
        h('div', { class: 'names' }, t.members.map(function (m, i) { return h('span', { class: m === meName ? 'hl' : '' }, [m + (i < t.members.length - 1 ? ' ' : '')]); }))])]);
  }
  function participantsBlock(e) {
    var me = DATA.me.name, mine = e.tracks.filter(function (t) { return t.members.indexOf(me) >= 0; });
    var total = e.tracks.reduce(function (s, t) { return s + t.members.length; }, 0);
    var wrap = h('div', { class: 'part' });
    var mineBox = h('div', { class: 'tracks' });
    if (mine.length) { mineBox.appendChild(h('div', { class: 'part-l', text: '내 분야' })); mine.forEach(function (t) { mineBox.appendChild(trackRow(t, me)); }); }
    else mineBox.appendChild(h('div', { class: 'note-sm', text: '이 행사는 내가 참여하는 행사가 아니에요.' }));
    var all = h('div', { class: 'tracks' }); all.hidden = true;
    e.tracks.forEach(function (t) { all.appendChild(trackRow(t, me)); });
    var btn = h('button', { class: 'linkbtn part-btn', type: 'button', text: '참여자 보기 (' + total + '명) ▾' });
    btn.addEventListener('click', function () {
      all.hidden = !all.hidden; mineBox.hidden = !all.hidden;
      btn.textContent = all.hidden ? '참여자 보기 (' + total + '명) ▾' : '참여자 접기 ▴';
    });
    wrap.appendChild(mineBox); wrap.appendChild(btn); wrap.appendChild(all);
    return wrap;
  }
  function infoBlock(info) {
    return h('details', { class: 'gc-more evinfo' }, [h('summary', { text: '공고 자세히 보기' }),
      h('div', { class: 'evinfo-t', text: info.title || '' })].concat(info.sections.map(function (s) {
      return h('div', { class: 'evinfo-s' }, [h('b', { text: s.t }), h('ul', null, s.items.map(function (x) { return h('li', { text: x }); }))]);
    })));
  }
  function evExtras(e) {
    var out = [];
    if (e.tracks) out.push(participantsBlock(e));
    if (e.link) out.push(h('a', { class: 'btn evlink', href: e.link.url, target: '_blank', rel: 'noopener', text: (e.link.label || '열기') + ' ↗' }));
    if (e.info) out.push(infoBlock(e.info));
    return out;
  }

  function noticesCard() {
    var ns = DATA.notices || []; if (!ns.length) return null;
    return h('div', { class: 'card notice-card' }, [head('NOTICE', '공지'), h('div', { class: 'card-b' }, ns.map(function (n) {
      return h('div', { class: 'ev' }, [h('div', { class: 'ev-main' }, [h('div', { class: 'ev-title', text: n.title }), n.text ? h('div', { class: 'ev-sub', text: n.text }) : null].concat(evExtras(n)))]);
    }))]);
  }

  // ---------- 주간 시간표 · 선택과목 반(A~E) ----------
  var weeklyBox = null;
  function myBlocks() { var b = prefLoad().blocks || {}, mine = myElectives(), out = {}; Object.keys(b).forEach(function (n) { if (mine.indexOf(n) >= 0) out[b[n]] = n; }); return out; }   // 글자 → 과목
  function blocksAssigned() { return Object.keys(myBlocks()).length; }
  function wCell(c) {
    if (!c) return { cls: 'k-self', kids: [] };
    if (c.k === 'block') {
      var sub = myBlocks()[c.b];
      return sub ? { cls: 'k-elective', kids: [h('b', { text: sub }), h('small', { text: c.b + '반' })] }
                 : { cls: 'k-block', kids: [h('b', { text: c.b }), h('small', { text: '선택' })] };
    }
    return { cls: 'k-' + c.k, kids: [h('b', { text: c.t })].concat(c.who ? [h('small', { text: c.who })] : []) };
  }
  function nowPeriod() {   // 지금 몇 교시인지 (KST)
    var t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':');
    var m = (+t[0]) * 60 + (+t[1]), W = DATA.weekly, cur = -1;
    W.rows.forEach(function (r, i) { var s = r.time.split(':'); if (m >= (+s[0]) * 60 + (+s[1])) cur = i; });
    return m >= 16 * 60 + 10 ? -1 : cur;
  }
  function todayDow() { var d = new Date(TODAY).getUTCDay(); return d >= 1 && d <= 5 ? d - 1 : -1; }   // 월0..금4
  function fillWeekly(box) {
    clear(box); var W = DATA.weekly; if (!W) return;
    var dow = todayDow(), np = dow >= 0 ? nowPeriod() : -1, unset = blocksAssigned() < 5;
    var thead = h('tr', null, [h('th', { text: '' })].concat(W.days.map(function (d, i) { return h('th', { class: i === dow ? 'today' : '', text: d }); })));
    var rows = W.rows.map(function (r, ri) {
      var tr = h('tr', null, [h('th', null, [r.n + '교시', h('small', { text: r.time })])]);
      r.cells.forEach(function (c, di) { var x = wCell(c); tr.appendChild(h('td', { class: x.cls + (di === dow ? ' today' : '') + (di === dow && ri === np ? ' now' : '') }, x.kids)); });
      return tr;
    });
    var body = [];
    if (unset) {
      var go = h('button', { class: 'nudge notice-b', type: 'button' }, [h('b', { text: '🅰 내 선택과목 반(A~E)을 정해 주세요' }), h('small', { text: (myElectives().length < 5 ? '선택과목을 고른 뒤 ' : '') + '정하면 A~E 칸이 내 과목으로 바뀌어요 →' })]);
      go.addEventListener('click', function () { goTab('me'); });
      body.push(go);
    }
    body.push(h('div', { class: 'tt-wrap' }, [h('table', { class: 'tt wk' }, [h('thead', null, [thead]), h('tbody', null, rows)])]));
    body.push(h('div', { class: 'legend' }, [
      h('span', { class: 'lg' }, [h('i', { style: 'background:var(--blue-t)' }), '공통 수업']),
      h('span', { class: 'lg' }, [h('i', { style: 'background:var(--green-t)' }), '내 선택과목']),
      h('span', { class: 'lg' }, [h('i', { style: 'border:1.5px dashed var(--mute)' }), '선택(반 미정)'])]));
    if (W.note) body.push(h('div', { class: 'note-sm', text: W.note }));
    box.appendChild(h('div', { class: 'card-b' }, body));
  }
  function buildWeeklyCard() {
    var card = h('div', { class: 'card' }, [head('WEEKLY', '주간 시간표')]);
    var box = h('div'); card.appendChild(box); weeklyBox = box; fillWeekly(box); return card;
  }
  function refreshWeekly() { if (weeklyBox && weeklyBox.parentNode) fillWeekly(weeklyBox); }
  // 일과표(주간 시간표)를 사진으로 저장/공유
  function saveWeeklyImage() {
    var W = DATA.weekly, me = DATA.me, dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var Wd = 1080, pad = 44, labW = 118, gap = 8, nd = W.days.length, np = W.rows.length;
    var cw = (Wd - pad * 2 - labW - gap * nd) / nd, ch = 118, headH = 56, top = 190, H = top + headH + np * (ch + gap) + 100;
    var cv = document.createElement('canvas'); cv.width = Wd; cv.height = H; var x = cv.getContext('2d');
    var C = dark ? { ink: '#EAEEFB', sub: '#A6B0CB', head: '#262C3A', lab: '#222735', common: '#1D2A4A', commonT: '#9DB8FF', el: '#173326', self: '#222735', selfT: '#7C8496', dash: '#7C8496' }
                 : { ink: '#1A2040', sub: '#566078', head: '#1A2040', lab: '#E7EAF3', common: '#DCE6FE', commonT: '#2E58D6', el: '#DDF2E8', self: '#ECEEF4', selfT: '#8590A8', dash: '#8590A8' };
    var F = 'PretendardL, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif', blocks = myBlocks();
    function rr(px, py, w, h2, r, fill, stroke) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h2, r); x.arcTo(px + w, py + h2, px, py + h2, r); x.arcTo(px, py + h2, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.setLineDash([8, 6]); x.lineWidth = 2.5; x.strokeStyle = stroke; x.stroke(); x.setLineDash([]); } }
    function cellInfo(c) {
      if (!c) return null;
      if (c.k === 'block') return blocks[c.b] ? { t: blocks[c.b], sub: c.b + '반', k: 'elective' } : { t: c.b, sub: '선택', k: 'block' };
      return { t: c.t, sub: c.who || '', k: c.k };
    }
    (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 40px PretendardL'), document.fonts.load('500 28px PretendardL')]) : Promise.resolve()).catch(function () {}).then(function () {
      var g = x.createLinearGradient(0, 0, Wd, H);
      if (dark) { g.addColorStop(0, '#0A0F22'); g.addColorStop(1, '#190F26'); } else { g.addColorStop(0, '#DCE8FF'); g.addColorStop(0.55, '#F0E4FF'); g.addColorStop(1, '#FFE6EE'); }
      x.fillStyle = g; x.fillRect(0, 0, Wd, H); x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillStyle = C.sub; x.font = '700 26px ' + F; x.fillText('2-6 알림장  ·  ' + DATA.className, pad, 70);
      x.fillStyle = C.ink; x.font = '800 58px ' + F; x.fillText('내 일과표', pad, 128);
      x.textAlign = 'right'; x.fillStyle = C.commonT; x.font = '800 32px ' + F; x.fillText(me.name + ' · ' + me.n + '번', Wd - pad, 128);
      x.textAlign = 'center';
      W.days.forEach(function (d, i) { var px = pad + labW + gap + i * (cw + gap); rr(px, top, cw, headH, 16, C.head); x.fillStyle = dark ? '#EAEEFB' : '#FFFFFF'; x.font = '800 27px ' + F; x.fillText(d, px + cw / 2, top + headH / 2); });
      W.rows.forEach(function (r, ri) {
        var py = top + headH + gap + ri * (ch + gap);
        rr(pad, py, labW, ch, 16, C.lab); x.fillStyle = C.ink; x.font = '800 26px ' + F; x.fillText(r.n + '교시', pad + labW / 2, py + ch / 2 - 14);
        x.fillStyle = C.sub; x.font = '500 19px ' + F; x.fillText(r.time, pad + labW / 2, py + ch / 2 + 18);
        r.cells.forEach(function (c, di) {
          var ci = cellInfo(c), px = pad + labW + gap + di * (cw + gap);
          if (!ci) { rr(px, py, cw, ch, 16, C.self); return; }
          if (ci.k === 'block') rr(px, py, cw, ch, 16, null, C.dash); else rr(px, py, cw, ch, 16, ci.k === 'common' ? C.common : ci.k === 'elective' ? C.el : C.self);
          x.fillStyle = ci.k === 'common' ? C.commonT : ci.k === 'block' || ci.k === 'self' ? C.selfT : C.ink;
          var big = ci.t.length > 6 ? 21 : ci.t.length > 4 ? 24 : 28;
          x.font = '800 ' + big + 'px ' + F; x.fillText(ci.t, px + cw / 2, py + ch / 2 - (ci.sub ? 13 : 0), cw - 12);
          if (ci.sub) { x.fillStyle = C.sub; x.font = '600 18px ' + F; x.fillText(ci.sub, px + cw / 2, py + ch / 2 + 22, cw - 12); }
        });
      });
      x.textAlign = 'right'; x.fillStyle = C.sub; x.font = '500 22px ' + F; x.fillText('class-26.bldoijoa01.workers.dev', Wd - pad, H - 44);
      cv.toBlob(function (blob) {
        if (!blob) return;
        var name = '내-일과표-' + me.name + '.png', file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: '내 일과표' }).catch(function () {});
        else { var u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
      }, 'image/png');
    });
  }
  function showWeekly() { goTab('today'); setTimeout(function () { var b = document.querySelectorAll('#panel-today .seg-b'); if (b[2]) b[2].click(); }, 60); }

  // 홈: 오늘 시간표
  function todayTimetableCard() {
    var W = DATA.weekly, dow = todayDow(); if (!W) return null;
    var np = nowPeriod(), dn = W.days[dow];
    if (dow < 0) return null;
    var rows = W.rows.map(function (r, ri) {
      var x = wCell(r.cells[dow]); if (!r.cells[dow]) return null;
      return h('div', { class: 'tday' + (ri === np ? ' now' : '') }, [h('span', { class: 'tday-p', text: r.n + '교시' }), h('span', { class: 'tday-t', text: r.time }),
        h('span', { class: 'tday-s' + (x.cls === 'k-block' ? ' unset' : '') }, x.kids.map(function (k) { return k.cloneNode(true); }))]);
    });
    var more = h('button', { class: 'linkbtn', type: 'button', text: '주간 시간표 보기 →' });
    more.addEventListener('click', function () { goTab('today'); setTimeout(function () { var b = document.querySelectorAll('#panel-today .seg-b'); if (b[2]) b[2].click(); }, 60); });
    return h('div', { class: 'card' }, [head('TODAY', dn + '요일 시간표'), h('div', { class: 'card-b' }, rows.concat([more]))]);
  }

  // ---------- 내 일정 (개인 일정: 내 비밀번호로 암호화되어 저장·동기화) ----------
  var todayView = 'list', calState = null;
  function myEvents() { var v = prefLoad().myEvents; return Array.isArray(v) ? v : []; }
  function saveMyEvents(list) { var p2 = prefLoad(); p2.myEvents = list; prefSave(p2); }
  function allEvents() { return DATA.events.concat(myEvents().map(function (e) { return Object.assign({}, e, { mine: true }); })); }
  function delMyEvent(id) { saveMyEvents(myEvents().filter(function (e) { return e.id !== id; })); renderToday(); renderHome(); }
  function myBadge(e) { return e.mine ? h('span', { class: 'chip mine', text: '내 일정' }) : null; }
  function myDelBtn(e) {
    if (!e.mine) return null;
    var b = h('button', { class: 'linkbtn del-b', type: 'button', text: '삭제' });
    b.addEventListener('click', function () { if (confirm('"' + e.title + '" 일정을 지울까요?')) delMyEvent(e.id); });
    return b;
  }
  function addEventForm(preset) {
    var title = h('input', { class: 'field', type: 'text', placeholder: '일정 이름 (예: 수행 제출, 병원)', maxlength: '40', 'aria-label': '일정 이름' });
    var date = h('input', { class: 'field', type: 'date', 'aria-label': '날짜' });
    var end = h('input', { class: 'field', type: 'date', 'aria-label': '끝나는 날(선택)' });
    var note = h('input', { class: 'field', type: 'text', placeholder: '메모 (선택)', maxlength: '60', 'aria-label': '메모' });
    date.value = preset || ''; var err = h('div', { class: 'badmsg' });
    var save = h('button', { class: 'btn', type: 'button', text: '저장' }), cancel = h('button', { class: 'btn out', type: 'button', text: '취소' });
    var form = h('div', { class: 'card addform' }, [h('div', { class: 'card-b' }, [
      h('div', { class: 'ev-title', text: '내 일정 추가' }),
      title, h('label', { class: 'af-l' }, ['날짜', date]), h('label', { class: 'af-l' }, ['끝나는 날 (여러 날일 때만)', end]), note, err,
      h('div', { class: 'af-btns' }, [save, cancel]),
      h('div', { class: 'note-sm', text: '🔒 내 일정은 나만 볼 수 있어요. 내 비밀번호로 암호화되어 저장돼요.' })])]);
    save.addEventListener('click', function () {
      var t = title.value.trim();
      if (!t) { err.textContent = '일정 이름을 넣어 주세요.'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { err.textContent = '날짜를 골라 주세요.'; return; }
      if (end.value && end.value < date.value) { err.textContent = '끝나는 날이 시작보다 빠를 수 없어요.'; return; }
      var list = myEvents();
      if (list.length >= 100) { err.textContent = '내 일정은 100개까지 저장할 수 있어요.'; return; }
      var ev = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: t, date: date.value };
      if (end.value && end.value !== date.value) ev.end = end.value;
      if (note.value.trim()) ev.note = note.value.trim();
      list.push(ev); saveMyEvents(list);
      if (calState) { var d0 = new Date(toUTC(ev.date)); calState.year = d0.getUTCFullYear(); calState.month = d0.getUTCMonth(); calState.sel = null; }
      renderToday(); renderHome();
    });
    cancel.addEventListener('click', function () { form.remove(); });
    return form;
  }

  // ---------- 홈 ----------
  function goTab(name) { selectTab(name); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function renderHome() {
    var p = document.getElementById('panel-home'); clear(p);
    var me = DATA.me, mv = DATA.move;
    var upcoming = allEvents().filter(function (e) { return diffDays(e.end || e.date, TODAY) >= 0; })
      .sort(function (a, b) { return toUTC(a.date) - toUTC(b.date); });
    var exam = upcoming.filter(function (e) { return /기말/.test(e.title); })[0];
    var others = upcoming.filter(function (e) { return e !== exam; });

    function stat(label, big, sub, onClick, cls) {
      var el = h('button', { class: 'stat ' + (cls || ''), type: 'button' }, [
        h('div', { class: 'stat-l', text: label }), h('div', { class: 'stat-big', text: big }), h('div', { class: 'stat-s', text: sub })]);
      el.addEventListener('click', onClick); return el;
    }
    // 인사
    p.appendChild(h('div', { class: 'greet' }, [h('div', { class: 'greet-hi', text: me.name + '님, 안녕 👋' }),
      h('div', { class: 'greet-s', text: me.n + '번 · ' + DATA.className })]));

    var grid = [];
    if (exam) {
      var dd = diffDays(exam.date, TODAY), end = diffDays(exam.end || exam.date, TODAY);
      var big = dd > 0 ? 'D-' + dd : (end >= 0 ? (dd === 0 ? 'D-DAY' : '진행 중') : '');
      grid.push(stat('기말고사', big, fmt(exam.date) + (exam.end ? ' ~ ' + fmt(exam.end) : ''), function () { goTab('exam'); }, 'hot'));
    }
    (DATA.ddays || []).forEach(function (x) {
      var n = diffDays(x.date, TODAY); if (n < 0) return;
      var d3 = new Date(toUTC(x.date));
      grid.push(stat(x.title, n === 0 ? 'D-DAY' : 'D-' + n, d3.getUTCFullYear() + '/' + (d3.getUTCMonth() + 1) + '/' + d3.getUTCDate() + '(' + DOW[d3.getUTCDay()] + ')', function () { goTab('today'); setTimeout(function () { var b = document.querySelectorAll('#panel-today .seg-b'); if (b[1]) b[1].click(); }, 60); }));
    });
    var ns = nsStat();
    if (ns) grid.push(stat('내신 평균', nsFmt(ns.avg), ns.sems + '개 학기 · 반영 ' + ns.credits + '단위', function () { goTab('naesin'); }));
    var moveTxt = me.n <= mv.frontCount ? mv.otherRoom + '로 이동' : '우리 교실 그대로';
    grid.push(stat('내 원반', moveTxt, me.n + '번 · ' + (me.n <= mv.frontCount ? '앞번호 ' + mv.frontCount + '명 이동' : mv.ownRoom + ' 응시'), function () { goTab('exam'); setTimeout(function () { jumpTo('sec-move'); }, 60); }));
    grid.push(stat('특별실 응시', DATA.special.length ? DATA.special.length + '과목' : '없음',
      DATA.special.length ? DATA.special[0].label.split(' ')[0] + ' 시작' : '원반에서 응시', function () { goTab('exam'); setTimeout(function () { jumpTo('sec-special'); }, 60); }));
    grid.push(stat('예정 일정', upcoming.length + '개', others[0] ? '다음: ' + others[0].title : '예정 없음', function () { goTab('today'); }));
    grid.push(stat('등급컷 아카이브', '등급컷 보기', '과목별 컷 · 내 예상 등급', function () { goTab('grade'); }));
    (DATA.notices || []).forEach(function (n) {
      var nb = h('button', { class: 'nudge notice-b', type: 'button' }, [h('b', { text: '📢 ' + n.title }), h('small', { text: (n.text || '') + ' →' })]);
      nb.addEventListener('click', function () { goTab('today'); });
      p.appendChild(nb);
    });
    if (myElectives().length < 5) {
      var nudge = h('button', { class: 'nudge', type: 'button' }, [h('b', { text: '📝 선택과목을 먼저 골라 주세요' }), h('small', { text: '고르면 등급컷과 기말 목표 계산기가 열려요 →' })]);
      nudge.addEventListener('click', function () { goTab('me'); });
      p.appendChild(nudge);
    }
    var myEv = upcoming.filter(function (e) { return e.tracks && e.tracks.some(function (t) { return t.members.indexOf(me.name) >= 0; }); })[0];
    if (myEv) {
      var mt = myEv.tracks.filter(function (t) { return t.members.indexOf(me.name) >= 0; })[0], dd2 = diffDays(myEv.date, TODAY);
      var mc = h('button', { class: 'myev', type: 'button' }, [h('div', { class: 'stat-l', text: '내 행사 · ' + fmt(myEv.date) + (dd2 >= 0 ? ' · D' + (dd2 ? '-' + dd2 : '-DAY') : '') }),
        h('div', { class: 'stat-big', text: myEv.title }), h('div', { class: 'stat-s myev-s', text: '내 분야: ' + mt.name + ' · ' + (mt.topic || '') })]);
      mc.addEventListener('click', function () { goTab('today'); });
      p.appendChild(mc);
    }
    p.appendChild(h('div', { class: 'stats' }, grid));

    var ttc = todayTimetableCard(); if (ttc) p.appendChild(ttc);
    // 다음 일정 미리보기
    var rows = others.slice(0, 3).map(function (e) {
      var d = diffDays(e.date, TODAY), when = e.end ? fmt(e.date) + '~' + fmt(e.end) : fmt(e.date);
      return h('div', { class: 'ev' }, [h('div', { class: 'ev-main' }, [h('div', { class: 'ev-title', text: e.title }), h('div', { class: 'ev-sub' }, [h('b', { text: when })])]), ddayBadge(e)]);
    });
    var more = h('button', { class: 'linkbtn', type: 'button', text: '일정 전체 보기 →' });
    more.addEventListener('click', function () { goTab('today'); });
    p.appendChild(h('div', { class: 'card' }, [head('UP NEXT', '다가오는 일정'), h('div', { class: 'card-b' }, rows.concat(rows.length ? [more] : [h('div', { class: 'empty', text: '예정된 일정이 없어요. 평화 ✌️' })]))]));
  }

  // ---------- 캘린더 ----------
  function buildCalendar() {
    var t = new Date(TODAY);
    if (!calState) calState = { year: t.getUTCFullYear(), month: t.getUTCMonth(), sel: null };
    var st = calState, wrap = h('div', { class: 'card' });
    function iso(y, m, d) { return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2); }
    function eventsOn(key) {
      return allEvents().filter(function (e) { return key >= e.date && key <= (e.end || e.date); });
    }
    function draw() {
      clear(wrap); var year = st.year, month = st.month, sel = st.sel;
      var prev = h('button', { class: 'cal-nav', type: 'button', 'aria-label': '이전 달', text: '‹' });
      var next = h('button', { class: 'cal-nav', type: 'button', 'aria-label': '다음 달', text: '›' });
      prev.addEventListener('click', function () { st.month--; if (st.month < 0) { st.month = 11; st.year--; } st.sel = null; draw(); });
      next.addEventListener('click', function () { st.month++; if (st.month > 11) { st.month = 0; st.year++; } st.sel = null; draw(); });
      var top = h('div', { class: 'cal-top' }, [prev, h('div', { class: 'cal-title' }, [h('div', { class: 'eyebrow', text: 'CALENDAR' }), h('h2', { text: year + '년 ' + (month + 1) + '월' })]), next]);
      var grid = h('div', { class: 'cal-grid' });
      DOW.forEach(function (d, i) { grid.appendChild(h('div', { class: 'cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), text: d })); });
      var first = new Date(Date.UTC(year, month, 1)).getUTCDay(), days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      for (var i = 0; i < first; i++) grid.appendChild(h('div', { class: 'cal-cell blank' }));
      for (var d = 1; d <= days; d++) (function (d) {
        var key = iso(year, month, d), evs = eventsOn(key), dow = (first + d - 1) % 7;
        var cls = 'cal-cell' + (key === iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) ? ' today' : '') + (key === sel ? ' sel' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');
        var cell = h('button', { class: cls, type: 'button' }, [h('span', { class: 'cal-d', text: String(d) })]);
        if (evs.length) {
          var dots = h('span', { class: 'cal-dots' });
          evs.slice(0, 3).forEach(function (e) { dots.appendChild(h('i', { class: (e.mine ? 'mine' : /기말|중간|고사/.test(e.title) ? 'exam' : diffDays(e.date, TODAY) <= 7 && diffDays(e.date, TODAY) >= 0 ? 'hot' : '') })); });
          cell.appendChild(dots);
        }
        cell.addEventListener('click', function () { st.sel = key === sel ? null : key; draw(); });
        grid.appendChild(cell);
      })(d);
      var shown = sel ? eventsOn(sel) : allEvents().filter(function (e) { var m = iso(year, month, 1), n = iso(year, month, days); return (e.end || e.date) >= m && e.date <= n; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var title = sel ? fmt(sel) : (month + 1) + '월 일정';
      var rows = shown.length ? shown.map(function (e) {
        var when = e.end ? fmt(e.date) + '~' + fmt(e.end) : fmt(e.date);
        return h('div', { class: 'ev' }, [h('div', { class: 'ev-main' }, [h('div', { class: 'ev-title' }, [e.title, myBadge(e)]), h('div', { class: 'ev-sub' }, [h('b', { text: when }), e.note ? ' · ' + e.note : ''])].concat(evExtras(e)).concat([myDelBtn(e)])), ddayBadge(e)]);
      }) : [h('div', { class: 'empty', text: '이 날은 일정이 없어요.' })];
      wrap.appendChild(top);
      wrap.appendChild(h('div', { class: 'card-b' }, [grid, h('div', { class: 'cal-list-t', text: title })].concat(rows)));
    }
    draw();
    return wrap;
  }

  // ---------- 선생님 공유 (학생 기기에서 교사 공개키로 암호화한 사본 · 서버/운영자/다른 학생은 못 읽음) ----------
  var shareTimer = null;
  function pushShare() {
    if (PREVIEW || !DATA || !DATA.me || DATA.me.role === 'teacher') return;
    clearTimeout(shareTimer);
    shareTimer = setTimeout(doShare, 1200);
  }
  function doShare() {
    var tok = load('tok26'); if (!tok) return;
    fetch('/api/teacherkeys', { headers: { authorization: 'Bearer ' + tok }, cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.keys || !j.keys.length) return;
      var prefs = Object.assign({}, prefLoad()); delete prefs.myEvents;   // 내 개인 일정은 공유하지 않음
      var content = { v: 1, n: DATA.me.n, name: DATA.me.name, scores: gcLoad(), prefs: prefs, at: Date.now() };
      return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']).then(function (K) {
        var iv = crypto.getRandomValues(new Uint8Array(12));
        return Promise.all([crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, K, te.encode(JSON.stringify(content))), crypto.subtle.exportKey('raw', K)]).then(function (res) {
          return Promise.all(j.keys.map(function (k) {
            return crypto.subtle.importKey('jwk', k.pub, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
              .then(function (pub) { return crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, res[1]); })
              .then(function (w) { return [String(k.n), b64e(w)]; });
          })).then(function (pairs) {
            var keys = {}; pairs.forEach(function (x) { keys[x[0]] = x[1]; });
            return fetch('/api/share', { method: 'PUT', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ iv: b64e(iv), data: b64e(res[0]), keys: keys }) });
          });
        });
      });
    }).catch(function () {});
  }
  // 교사: 내 키쌍 준비 (비밀키는 내 비밀번호로 잠가서 서버에 둠 → 운영자도 못 풂) + 학생 사본 풀기
  var TKEY = null, TSHARES = {};
  function ensureTeacherKeys() {
    if (TKEY) return Promise.resolve(TKEY);
    return storedKey().then(function (wrap) {
      if (!wrap) return null;
      return tApi('mykey').then(function (rec) {
        var open = rec && rec.priv ? crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(rec.priv.iv) }, wrap, b64d(rec.priv.data))
          .then(function (pk) { return crypto.subtle.importKey('pkcs8', pk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']); }) : Promise.reject(new Error('none'));
        return open.catch(function () {   // 처음이거나 비밀번호가 바뀐 경우: 새 키쌍 (이전 사본은 학생이 다시 로그인하면 새로 만들어짐)
          return crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']).then(function (kp) {
            return Promise.all([crypto.subtle.exportKey('jwk', kp.publicKey), crypto.subtle.exportKey('pkcs8', kp.privateKey)]).then(function (r) {
              var iv = crypto.getRandomValues(new Uint8Array(12));
              return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, wrap, r[1]).then(function (ct) {
                return tApi('keys', { pub: r[0], priv: { iv: b64e(iv), data: b64e(ct) } });
              }).then(function () { return kp.privateKey; });
            });
          });
        });
      });
    }).then(function (k) { TKEY = k; return k; }).catch(function () { return null; });
  }
  function loadShares() {
    return ensureTeacherKeys().then(function (key) {
      if (!key) return {};
      return tApi('shares').then(function (j) {
        var out = {}, me = String(DATA.me.n);
        return Promise.all(Object.keys(j.shares || {}).map(function (n) {
          var s = j.shares[n], w = s.keys && s.keys[me]; if (!w) return null;
          return crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, b64d(w))
            .then(function (raw) { return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']); })
            .then(function (K) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(s.iv) }, K, b64d(s.data)); })
            .then(function (pt) { out[n] = JSON.parse(td.decode(pt)); }).catch(function () {});
        })).then(function () { TSHARES = out; return out; });
      });
    });
  }

  // ---------- 점수 암호화 (내 비밀번호에서 만든 키로 브라우저에서 암호화 → 서버엔 암호문만) ----------
  var te = new TextEncoder(), td = new TextDecoder();
  function b64e(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function b64d(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function deriveKey(pw, n) {
    return crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (km) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: te.encode('class26-scores|' + n), iterations: 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    });
  }
  function rememberKey(pw, n) {
    return deriveKey(pw, n).then(function (k) { return crypto.subtle.exportKey('raw', k); })
      .then(function (raw) { store('gk26', b64e(raw)); }).catch(function () {});
  }
  function storedKey() {
    var raw = load('gk26'); if (!raw) return Promise.resolve(null);
    return crypto.subtle.importKey('raw', b64d(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']).catch(function () { return null; });
  }
  function encryptJSON(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, te.encode(JSON.stringify(obj)))
      .then(function (ct) { return { iv: b64e(iv), data: b64e(ct) }; });
  }
  function decryptJSON(key, blob) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.data)).then(function (pt) { return JSON.parse(td.decode(pt)); });
  }
  var PREVIEW = null;   // 교사가 학생 화면을 미리보는 중일 때 그 학생 정보
  var PKEY = 'pref26';
  function prefLoad() { if (PREVIEW) return PREVIEW.prefs || {}; try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch (e) { return {}; } }
  function prefSave(o) { if (PREVIEW) return; try { localStorage.setItem(PKEY, JSON.stringify(o)); } catch (e) {} pushScores(); }
  function normName(s) { return String(s || '').replace(/\s+/g, '').replace(/Ⅱ/g, 'II').replace(/Ⅰ/g, 'I').replace(/[*]/g, ''); }
  var pushTimer = null;
  function pushScores() {
    if (PREVIEW) return;
    pushShare();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      storedKey().then(function (key) {
        if (!key) return;
        return encryptJSON(key, { v: 2, scores: gcLoad(), prefs: prefLoad() }).then(function (blob) {
          return fetch('/api/scores', { method: 'PUT', headers: { authorization: 'Bearer ' + (load('tok26') || ''), 'content-type': 'application/json' }, body: JSON.stringify(blob) });
        });
      }).catch(function () {});
    }, 800);
  }
  function syncScores() {
    if (PREVIEW) return Promise.resolve(false);
    return storedKey().then(function (key) {
      if (!key) return false;
      return fetch('/api/scores', { headers: { authorization: 'Bearer ' + (load('tok26') || '') }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return false;
          if (!j.blob) { if (Object.keys(gcLoad()).length || Object.keys(prefLoad()).length) pushScores(); return true; }
          return decryptJSON(key, j.blob).then(function (obj) {
            var srvScores = obj && obj.v === 2 ? (obj.scores || {}) : (obj || {}), srvPrefs = obj && obj.v === 2 ? (obj.prefs || {}) : {};
            var mergedS = Object.assign({}, gcLoad(), srvScores), mergedP = Object.assign({}, prefLoad(), srvPrefs);
            gcSave(mergedS); try { localStorage.setItem(PKEY, JSON.stringify(mergedP)); } catch (e) {}
            if (!(obj && obj.v === 2) || JSON.stringify(mergedS) !== JSON.stringify(srvScores) || JSON.stringify(mergedP) !== JSON.stringify(srvPrefs)) pushScores();
            return true;
          });
        }).catch(function () { return false; });
    });
  }

  // 교사: 학생 화면 미리보기 (읽기 전용)
  function enterPreview(n, name) {
    Promise.all([tApi('preview?n=' + n), loadShares()]).then(function (res) {
      var d = res[0], sh = res[1][String(n)];
      if (!d || !d.me) return;
      PREVIEW = { n: n, name: name, scores: sh ? sh.scores || {} : {}, prefs: sh ? sh.prefs || {} : {}, shared: !!sh }; DATA = d;
      GC_STATE = GC_STATE === 'loading' ? GC_STATE : (GC ? 'dirty' : 'idle');
      document.body.classList.remove('teacher'); document.body.classList.add('preview');
      var bar = document.getElementById('previewBar'); bar.hidden = false;
      document.getElementById('previewWho').textContent = '👀 ' + name + '(' + n + '번) 학생 화면 · 읽기 전용' + (sh ? ' · 성적 공유됨' : ' · 아직 공유 데이터 없음(학생이 한 번 로그인하면 생겨요)');
      document.getElementById('who').textContent = name + ' · ' + n + '번';
      clear(document.getElementById('panel-exam'));
      renderMe(); renderNaesin(); renderMore(); renderHome(); renderToday(); renderExamJump(); renderTable(); renderMove(); renderCaution(); tagExamCards();
      selectTab('home'); window.scrollTo({ top: 0 });
    });
  }
  function exitPreview() {
    PREVIEW = null; GC_STATE = GC ? 'dirty' : 'idle'; document.body.classList.remove('preview'); document.getElementById('previewBar').hidden = true;
    fetch('/api/data', { headers: { authorization: 'Bearer ' + load('tok26') }, cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      DATA = d; document.body.classList.add('teacher');
      document.getElementById('who').textContent = DATA.me.name + ' 선생님';
      renderMore(); renderToday(); renderTeacher(); selectTab('teacher'); window.scrollTo({ top: 0 });
    });
  }
  document.getElementById('previewExit').addEventListener('click', exitPreview);

  // ---------- 교사 도구 ----------
  function tApi(path, body) {
    return fetch('/api/teacher/' + path, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + (load('tok26') || ''), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { j._ok = r.ok; return j; }); });
  }
  function renderTeacher() {
    var p = document.getElementById('panel-teacher'); clear(p);
    p.appendChild(h('div', { class: 'greet' }, [h('div', { class: 'greet-hi', text: DATA.me.name + ' 선생님, 안녕하세요 👋' }), h('div', { class: 'greet-s', text: DATA.className + ' 교사 도구' })]));

    // 1) 일정·공지 올리기
    var kind = h('select', { class: 'field', 'aria-label': '종류' }, [h('option', { value: 'event', text: '일정 (날짜 있음)' }), h('option', { value: 'notice', text: '공지 (날짜 없음)' })]);
    var title = h('input', { class: 'field', type: 'text', maxlength: '80', placeholder: '제목 (예: 수행평가 제출)' });
    var date = h('input', { class: 'field', type: 'date', 'aria-label': '날짜' });
    var end = h('input', { class: 'field', type: 'date', 'aria-label': '끝나는 날(선택)' });
    var note = h('input', { class: 'field', type: 'text', maxlength: '120', placeholder: '메모 / 공지 내용 (선택)' });
    var link = h('input', { class: 'field', type: 'url', placeholder: '링크 (선택, https://…)' });
    var msg = h('div', { class: 'badmsg' }), post = h('button', { class: 'btn', type: 'button', text: '올리기' });
    var dateRow = h('div', null, [h('label', { class: 'af-l' }, ['날짜', date]), h('label', { class: 'af-l' }, ['끝나는 날 (여러 날일 때만)', end])]);
    kind.addEventListener('change', function () { dateRow.hidden = kind.value === 'notice'; });
    post.addEventListener('click', function () {
      msg.textContent = '';
      if (!title.value.trim()) { msg.textContent = '제목을 넣어 주세요.'; return; }
      if (kind.value === 'event' && !date.value) { msg.textContent = '날짜를 골라 주세요.'; return; }
      var body = { op: 'add', kind: kind.value, title: title.value, link: link.value || undefined };
      if (kind.value === 'event') { body.date = date.value; body.end = end.value || undefined; body.note = note.value; } else body.text = note.value;
      post.disabled = true;
      tApi('content', body).then(function (j) {
        post.disabled = false;
        if (!j._ok) { msg.textContent = '올리지 못했어요. 입력을 확인해 주세요.'; return; }
        return fetch('/api/data', { headers: { authorization: 'Bearer ' + load('tok26') }, cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { DATA = d; renderTeacher(); renderToday(); });
      }).catch(function () { post.disabled = false; msg.textContent = '연결에 실패했어요.'; });
    });
    p.appendChild(h('div', { class: 'card' }, [head('POST', '일정·공지 올리기'), h('div', { class: 'card-b' }, [kind, title, dateRow, note, link, msg, post,
      h('div', { class: 'note-sm', text: '올리면 학생 화면의 일정·공지에 바로 나와요. (참여자 명단·자세한 공고문은 아직 직접 요청해 주세요)' })])]));

    // 2) 올라간 일정·공지 관리
    var mk = [];
    (DATA.notices || []).forEach(function (n) { mk.push({ k: 'notice', title: n.title, sub: '공지' + (n.text ? ' · ' + n.text : '') }); });
    DATA.events.slice().sort(function (x, y) { return x.date < y.date ? -1 : 1; }).forEach(function (e) { mk.push({ k: 'event', title: e.title, date: e.date, sub: fmt(e.date) + (e.end ? '~' + fmt(e.end) : '') + (e.note ? ' · ' + e.note : '') }); });
    p.appendChild(h('div', { class: 'card' }, [head('MANAGE', '올라간 일정·공지'), h('div', { class: 'card-b' }, mk.map(function (m) {
      var del = h('button', { class: 'linkbtn del-b', type: 'button', text: '삭제' });
      del.addEventListener('click', function () {
        if (!confirm('"' + m.title + '"을(를) 지울까요? 학생 화면에서도 사라져요.')) return;
        tApi('content', { op: 'delete', kind: m.k, title: m.title, date: m.date }).then(function () {
          return fetch('/api/data', { headers: { authorization: 'Bearer ' + load('tok26') }, cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { DATA = d; renderTeacher(); renderToday(); });
        });
      });
      return h('div', { class: 'ev' }, [h('div', { class: 'ev-main' }, [h('div', { class: 'ev-title', text: m.title }), h('div', { class: 'ev-sub', text: m.sub })]), del]);
    }))]));

    // 3) 학생 현황 · 비밀번호 초기화
    var box = h('div', { class: 'card-b' }, [h('div', { class: 'empty', text: '불러오는 중…' })]);
    p.appendChild(h('div', { class: 'card' }, [head('STUDENTS', '학생 현황'), box]));
    function drawStudents() {
      Promise.all([tApi('students'), loadShares()]).then(function (res) { var j = res[0]; var shares = res[1] || {};
        clear(box); if (!j.students) { box.appendChild(h('div', { class: 'empty', text: '불러오지 못했어요.' })); return; }
        var on = j.students.filter(function (s) { return s.active; }).length;
        var nsh = j.students.filter(function (s) { return shares[String(s.n)]; }).length;
        box.appendChild(h('div', { class: 'note-sm', text: '가입 ' + on + ' / ' + j.students.length + '명 · 성적 공유 ' + nsh + '명. 학생의 점수·내신·선택과목은 선생님 전용으로 암호화돼 공유돼요(운영자·다른 학생은 못 봐요). 비밀번호 초기화하면 학생은 반 코드로 다시 설정하고 저장한 점수는 사라져요.' }));
        j.students.forEach(function (s) {
          var rst = h('button', { class: 'linkbtn del-b', type: 'button', text: '초기화' }); rst.disabled = !s.active;
          rst.addEventListener('click', function () {
            if (!confirm(s.n + '번 ' + s.name + ' 학생의 비밀번호를 초기화할까요?')) return;
            tApi('reset', { n: s.n }).then(drawStudents);
          });
          var view = h('button', { class: 'linkbtn', type: 'button', text: '화면 보기' });
          view.addEventListener('click', function () { enterPreview(s.n, s.name); });
          var sh = shares[String(s.n)], sumTxt = '';
          if (sh) {
            var pr = sh.prefs || {}, ns = pr.naesin && pr.naesin.sems ? nsTotal(pr.naesin.sems) : null;
            sumTxt = '선택 ' + (pr.el2 || []).length + '/5' + (ns && ns.avg != null ? ' · 내신 ' + nsFmt(ns.avg) : '') + ' · 점수 ' + Object.keys(sh.scores || {}).filter(function (k) { return k.indexOf('perf-') !== 0; }).length + '과목';
          }
          box.appendChild(h('div', { class: 'srow-wrap' }, [h('div', { class: 'srow' }, [h('span', { class: 'srow-n', text: s.n + '번' }), h('span', { class: 'srow-name', text: s.name }),
            h('span', { class: 'srow-st' + (s.active ? ' on' : ''), text: s.active ? (sh ? '공유' : '가입') : '아직' }), view, rst]), sumTxt ? h('div', { class: 'srow-sum', text: sumTxt }) : null]));
        });
      });
    }
    drawStudents();
  }

  // ---------- 더보기 (업데이트 내역 · 만든 사람) ----------
  var KIND = { feature: ['새 기능', 'new'], design: ['디자인', 'design'], fix: ['수정', 'fix'] };
  function renderMore() {
    var p = document.getElementById('panel-more'); if (!p || !DATA) return; clear(p);
    var about = DATA.about || {}, ups = (DATA.updates || []).slice().sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : 0; });
    p.appendChild(h('div', { class: 'card' }, [head('UPDATES', '업데이트 내역'), h('div', { class: 'card-b' },
      ups.length ? ups.map(function (u) {
        var k = KIND[u.kind] || ['업데이트', 'new'], d = new Date(toUTC(u.date));
        return h('div', { class: 'up' }, [h('div', { class: 'up-top' }, [h('span', { class: 'up-k ' + k[1], text: k[0] }), h('span', { class: 'up-d', text: (d.getUTCMonth() + 1) + '/' + d.getUTCDate() })]),
          h('div', { class: 'up-t', text: u.title }), u.detail ? h('div', { class: 'up-s', text: u.detail }) : null]);
      }) : [h('div', { class: 'empty', text: '아직 업데이트 기록이 없어요.' })])]));
    var people = (about.people || []).map(function (x) { return h('div', { class: 'me-row' }, [h('span', { text: x.role }), h('b', { text: x.name })]); });
    var notes = (about.notes || []).map(function (n) { return h('div', { class: 'note-sm', text: n }); });
    p.appendChild(h('div', { class: 'card' }, [head('CREDITS', '만든 사람'), h('div', { class: 'card-b' }, people.concat(notes))]));
  }

  // ---------- 내신 (학기별 등급 입력 → 총 내신 평균) ----------
  var NS_SEMS = [['1-1', '1학년 1학기'], ['1-2', '1학년 2학기'], ['2-1', '2학년 1학기'], ['2-2', '2학년 2학기']];
  var NS_BASE = {   // 편성표의 공통·일반 과목 (이름, 단위, 내신 반영 기본값). 반영 여부는 학교 기준에 맞게 직접 바꿀 수 있어요
    '1-1': [['공통국어1', 4], ['공통수학1', 4], ['공통영어1', 4], ['한국사1', 3], ['통합사회1', 4], ['통합과학1', 4], ['과학탐구실험1', 1, 1], ['체육Ⅰ', 2, 1], ['음악/미술', 2, 1], ['기술·가정/정보', 3]],
    '1-2': [['공통국어2', 4], ['공통수학2', 4], ['공통영어2', 4], ['한국사2', 3], ['통합사회2', 4], ['통합과학2', 4], ['과학탐구실험2', 1, 1], ['체육Ⅱ', 2, 1], ['음악/미술', 2, 1], ['정보/기술·가정', 3]],
    '2-1': [['문학', 4], ['대수', 4], ['영어Ⅰ', 4], ['스포츠문화', 1, 1], ['음악 연주와 창작/미술 창작', 2, 1]],
    '2-2': [['화법과 언어', 4], ['미적분Ⅰ', 4], ['영어Ⅱ', 4], ['스포츠과학', 1, 1], ['음악 연주와 창작/미술 창작', 2, 1]]
  };
  function nsLoad() { var s = (prefLoad().naesin || {}).sems; return s && typeof s === 'object' ? s : {}; }
  function nsSave(sems) { var p2 = prefLoad(); p2.naesin = { sems: sems }; prefSave(p2); }
  function nsDefault(key) {
    var rows = (NS_BASE[key] || []).map(function (r) { return { n: r[0], cr: r[1], g: 0, x: r[2] ? 1 : 0 }; });
    var pr = prefLoad(), picks = key === '2-1' ? pr.el1 : key === '2-2' ? pr.el2 : null;   // 내 정보에서 고른 선택과목 불러오기
    (picks || []).forEach(function (n) { rows.push({ n: n, cr: 3, g: 0, x: 0 }); });
    if (key === '2-1') (pr.el1lib || []).forEach(function (n) { rows.push({ n: n, cr: 2, g: 0, x: 1 }); });
    return rows;
  }
  function nsRows(sems, key) { return sems[key] || nsDefault(key); }
  function semAvg(rows) {
    var s = 0, c = 0; rows.forEach(function (r) { if (!r.x && r.g >= 1 && r.g <= 5 && r.cr > 0) { s += r.g * r.cr; c += r.cr; } });
    return { avg: c ? s / c : null, credits: c, sum: s };
  }
  function nsTotal(sems, assume) {
    var s = 0, c = 0, n = 0;
    NS_SEMS.forEach(function (sm) { var r = semAvg(nsRows(sems, sm[0])); if (r.credits) { s += r.sum; c += r.credits; n++; } });
    return { avg: c ? s / c : null, credits: c, sems: n, sum: s, c: c };
  }
  function nsStat() { var t = nsTotal(nsLoad()); return t.avg == null ? null : t; }
  var nsFmt = function (v) { return v == null ? '-' : (Math.round(v * 100) / 100).toFixed(2); };

  function renderNaesin() {
    var p = document.getElementById('ns-main'); if (!p || !DATA) return; clear(p);
    var nPicked = myElectives().length;
    if (nPicked < 5) {   // 선택과목을 먼저 골라야 성적(내신)을 입력할 수 있음
      var go = h('button', { class: 'btn', type: 'button', text: '선택과목 고르러 가기 →' });
      go.addEventListener('click', function () { goTab('me'); });
      p.appendChild(h('div', { class: 'card' }, [head('LOCKED', '먼저 선택과목을 골라 주세요'), h('div', { class: 'card-b' }, [
        h('div', { class: 'gate-ic', text: '🔐' }),
        h('div', { class: 'note-sm', text: '내신(학기별 성적)은 2학기 선택과목(택5)을 먼저 고른 뒤에 입력할 수 있어요. 지금 ' + nPicked + ' / 5 선택했어요.' }),
        go])]));
      return;
    }
    var sems = nsLoad(), summary = h('div', { class: 'card ns-sum' }), cards = h('div');
    p.appendChild(h('div', { class: 'note-sm ns-intro', text: '학기별로 과목의 등급(1~5)과 단위수를 넣으면 단위수 가중 평균을 계산해요. 체육·예술·과학탐구실험 등은 기본으로 평균에서 빼 뒀고, 학교 기준에 맞게 "반영"을 켜고 끌 수 있어요.' }));
    p.appendChild(secureNote(!!load('gk26')));
    p.appendChild(summary); p.appendChild(cards);

    function persist() { nsSave(sems); drawSummary(); }
    function drawSummary() {
      clear(summary);
      var t = nsTotal(sems);
      var per = NS_SEMS.map(function (sm) { var r = semAvg(nsRows(sems, sm[0])); return h('div', { class: 'ns-per' }, [h('small', { text: sm[1] }), h('b', { text: r.avg == null ? '-' : nsFmt(r.avg) })]); });
      var kids = [h('div', { class: 'eyebrow', text: '총 내신 평균 (단위수 가중)' }), h('div', { class: 'ns-avg', text: nsFmt(t.avg) }),
        h('div', { class: 'note-sm', text: t.avg == null ? '아래에 등급을 넣으면 계산돼요.' : t.sems + '개 학기 · 반영 ' + t.credits + '단위' }), h('div', { class: 'ns-pers' }, per)];
      // 이번 학기(2-2) 가정: 아직 등급이 없는 학기의 평균을 가정해서 총 평균을 미리 보기
      var r22 = nsRows(sems, '2-2'), cr22 = r22.reduce(function (a, r) { return a + (!r.x && r.cr > 0 ? r.cr : 0); }, 0), has22 = semAvg(r22).credits > 0;
      if (!has22 && cr22 > 0) {
        var base = nsTotal(sems), out = h('div', { class: 'ns-what-v' }), rng = h('input', { class: 'semrange', type: 'range', min: '1', max: '5', step: '0.1', value: '2.5', 'aria-label': '2학년 2학기 가정 평균 등급' });
        var upd = function () {
          var x = parseFloat(rng.value), c = base.c + cr22, tot = (base.sum + x * cr22) / c;
          clear(out); out.appendChild(h('div', null, ['2학년 2학기를 평균 ', h('b', { text: x.toFixed(1) }), '등급으로 받으면 → 총 평균 ', h('b', { class: 'ns-accent', text: nsFmt(tot) })]));
        };
        rng.addEventListener('input', upd); upd();
        kids.push(h('div', { class: 'ns-what' }, [h('div', { class: 'needs-h', text: '🎚 이번 학기(2-2) 가정해 보기' }), rng, h('div', { class: 'rr' }, [h('span', { text: '1등급' }), h('span', { text: '5등급' })]), out,
          h('div', { class: 'note-sm', text: '2-2 반영 ' + cr22 + '단위 기준 · 기말이 끝나고 등급을 넣으면 이 가정은 사라져요.' })]));
      }
      summary.appendChild(h('div', { class: 'card-b' }, kids));
    }
    function drawCards() {
      clear(cards);
      NS_SEMS.forEach(function (sm, si) {
        var key = sm[0], rows = nsRows(sems, key), avgEl = h('span', { class: 'ns-savg' }), meta = h('span', { class: 'el-gcount' });
        var list = h('div', { class: 'ns-rows' });
        function head2() { var r = semAvg(rows); avgEl.textContent = r.avg == null ? '-' : nsFmt(r.avg); meta.textContent = r.credits + '단위'; }
        function save() { sems[key] = rows; persist(); head2(); }
        function drawRows() {
          clear(list);
          rows.forEach(function (r, ri) {
            var on = h('button', { class: 'ns-on' + (r.x ? '' : ' on'), type: 'button', 'aria-pressed': r.x ? 'false' : 'true', title: '내신 반영', text: r.x ? '제외' : '반영' });
            on.addEventListener('click', function () { r.x = r.x ? 0 : 1; on.className = 'ns-on' + (r.x ? '' : ' on'); on.textContent = r.x ? '제외' : '반영'; on.setAttribute('aria-pressed', r.x ? 'false' : 'true'); save(); });
            var nm = h('input', { class: 'ns-name', type: 'text', maxlength: '24', value: r.n, 'aria-label': '과목명' });
            nm.addEventListener('input', function () { r.n = nm.value; save(); });
            var cr = h('input', { class: 'ns-cr', type: 'number', min: '1', max: '9', step: '1', value: String(r.cr), 'aria-label': '단위수', inputmode: 'numeric' });
            cr.addEventListener('input', function () { r.cr = Math.max(0, Math.min(9, parseInt(cr.value, 10) || 0)); save(); });
            var gs = h('div', { class: 'ns-g' });
            [1, 2, 3, 4, 5].forEach(function (g) {
              var b = h('button', { class: 'ns-gb g' + g + (r.g === g ? ' on' : ''), type: 'button', 'aria-pressed': r.g === g ? 'true' : 'false', text: String(g) });
              b.addEventListener('click', function () { r.g = r.g === g ? 0 : g; Array.prototype.forEach.call(gs.children, function (x, k) { var o = r.g === k + 1; x.classList.toggle('on', o); x.setAttribute('aria-pressed', o ? 'true' : 'false'); }); save(); });
              gs.appendChild(b);
            });
            var del = h('button', { class: 'linkbtn del-b', type: 'button', text: '삭제', 'aria-label': r.n + ' 삭제' });
            del.addEventListener('click', function () { rows.splice(ri, 1); save(); drawRows(); });
            list.appendChild(h('div', { class: 'ns-row' + (r.x ? ' off' : '') }, [h('div', { class: 'ns-r1' }, [nm, cr, on]), h('div', { class: 'ns-r2' }, [gs, del])]));
          });
          var add = h('button', { class: 'linkbtn', type: 'button', text: '＋ 과목 추가' });
          add.addEventListener('click', function () { rows.push({ n: '', cr: 3, g: 0, x: 0 }); save(); drawRows(); var ins = list.querySelectorAll('.ns-name'); if (ins.length) ins[ins.length - 1].focus(); });
          list.appendChild(add);
          // 선택과목을 내 정보에서 새로 고른 경우 불러오기
          if (key === '2-1' || key === '2-2') {
            var picks = (prefLoad()[key === '2-1' ? 'el1' : 'el2'] || []).filter(function (n) { return !rows.some(function (r) { return r.n === n; }); });
            if (picks.length) {
              var imp = h('button', { class: 'linkbtn', type: 'button', text: '내 선택과목 ' + picks.length + '개 불러오기' });
              imp.addEventListener('click', function () { picks.forEach(function (n) { rows.push({ n: n, cr: 3, g: 0, x: 0 }); }); save(); drawRows(); });
              list.appendChild(imp);
            }
          }
        }
        head2(); drawRows();
        var box = h('details', { class: 'card el-card' }, [h('summary', { class: 'el-sum' }, [h('div', null, [h('div', { class: 'eyebrow', text: key + ' · 평균' }), h('h2', null, [sm[1] + ' ', avgEl])]), meta]), h('div', { class: 'el-body' }, [list])]);
        if (si >= 2) box.setAttribute('open', '');
        cards.appendChild(box);
      });
    }
    drawSummary(); drawCards();
  }

  // ---------- 보안 안내 문구 ----------
  function secureBanner(compact) {
    var rows = [['🙅', '관리자', '저장된 내용을 볼 수 없어요'], ['👤', '나', '내 비밀번호로 볼 수 있어요'], ['👩‍🏫', '담임 선생님', '선생님 전용 열쇠로 볼 수 있어요'], ['🚫', '다른 친구들', '볼 수 없어요']];
    var det = h('details', { class: 'secure-det' }, [h('summary', { text: '자세히 보기' }), h('ul', null, [
      h('li', null, [h('b', { text: '암호 방식 ' }), 'AES-256-GCM(변조까지 감지하는 인증 암호화) + 선생님 공유용 RSA-OAEP']),
      h('li', null, [h('b', { text: '열쇠 ' }), '내 비밀번호 + PBKDF2-SHA256 20만 회로 내 기기 안에서만 만들어요. 비밀번호와 열쇠는 서버로 보내지 않아요.']),
      h('li', null, [h('b', { text: '서버 저장 ' }), '점수·내신·선택과목은 저장되기 전에 이미 내 기기에서 암호화돼, 서버에는 읽을 수 없는 암호문만 있어요.']),
      h('li', null, [h('b', { text: '선생님 공유 ' }), '선생님이 학생 지도에 쓰도록, 같은 내용의 사본이 선생님 전용 열쇠로 암호화돼 함께 저장돼요. 개인 일정은 공유하지 않아요.']),
      h('li', null, [h('b', { text: '비밀번호 분실 ' }), '열쇠를 복구할 수 없어서, 초기화하면 저장된 점수는 사라져요.']),
      h('li', null, [h('b', { text: '주의 ' }), '내 비밀번호를 아는 사람은 볼 수 있어요. 짧은 비밀번호(6자 미만)는 암호가 약해요. 비밀번호는 나만 알고 있어야 해요.'])
        ].concat(parseInt(load('pwlen26') || '99', 10) < 6 ? [h('li', { class: 'weak' }, [h('b', { text: '⚠ 약한 비밀번호 ' }), '지금 비밀번호가 6자 미만이라 암호가 약해요. 6자 이상으로 바꾸는 걸 권장해요. (담임 선생님께 초기화 요청 후 다시 설정)'])] : []))]);
    return h('div', { class: 'secure-big compact' }, [
      h('div', { class: 'sb-head' }, [h('span', { class: 'sb-ic', text: '🔒' }), h('div', null, [h('div', { class: 'sb-t', text: '내 성적은 암호화돼요' }), h('div', { class: 'sb-s', text: '관리자는 볼 수 없고, 나와 담임 선생님만 볼 수 있어요' })])]),
      det]);
  }
  function secureNote(synced) {
    // 열쇠 유무와 상관없이 항상 같은 안내 카드를 보여 줌 (열쇠가 없으면 안내 한 줄만 추가)
    var card = secureBanner(true);
    if (!synced) card.insertBefore(h('div', { class: 'sb-warn', text: '이 기기는 아직 다른 기기와의 동기화가 꺼져 있어요. 로그아웃 후 다시 로그인하면 켜져요.' }), card.lastChild);
    return card;
  }
  // 로그인 직후 한 번 크게 알려 주기
  function showSecureModal() {
    var seen = false; try { seen = !!localStorage.getItem('secack26'); } catch (e) {}
    if (seen || (DATA && DATA.me && DATA.me.role === 'teacher') || PREVIEW) return;
    var ok = h('button', { class: 'btn', type: 'button', text: '확인했어요' });
    var wrap = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [h('div', { class: 'modal-card' }, [secureBanner(false), ok])]);
    ok.addEventListener('click', function () { try { localStorage.setItem('secack26', '1'); } catch (e) {} wrap.classList.add('out'); setTimeout(function () { wrap.remove(); }, 300); });
    document.body.appendChild(wrap);
  }

  // ---------- 내 정보 (선택과목) ----------
  function myElectives() { var v = prefLoad().el2; return Array.isArray(v) ? v : []; }
  var SEM_CARDS = [
    { eyebrow: '2학년 · 지금', title: '2학기', open: true, groups: [['el2', 'sem2']] },
    { eyebrow: '3학년 · 내년', title: '3학년 1학기', groups: [['y3s1', 'y3s1'], ['y3s1art', 'y3s1art']] },
    { eyebrow: '3학년 · 내년', title: '3학년 2학기', groups: [['y3s2', 'y3s2'], ['y3s2lib', 'y3s2lib']] },
    { eyebrow: '2학년 · 지난 학기', title: '1학기', groups: [['el1', 'sem1'], ['el1lib', 'liberal']] }
  ];
  function renderMe() {
    var p = document.getElementById('panel-me'); if (!p || !DATA) return; clear(p);
    var E = window.ELECTIVES, me = DATA.me, prefs = prefLoad();
    var gcNames = {};   // 등급컷 자료가 있는 과목
    if (GC) GC.subjects.forEach(function (s) { gcNames[normName(s.subject)] = 1; });

    p.appendChild(h('div', { class: 'card' }, [head('MY ACCOUNT', '내 정보'), h('div', { class: 'card-b' }, [
      h('div', { class: 'me-row' }, [h('span', { text: '이름' }), h('b', { text: me.name })]),
      h('div', { class: 'me-row' }, [h('span', { text: '번호' }), h('b', { text: me.n + '번' })]),
      h('div', { class: 'me-row' }, [h('span', { text: '반' }), h('b', { text: DATA.className })])
    ])]));

    // 한 학기 = 한 카드. 선택과목·교양(예술)은 칸을 나눠서 따로 고름
    function semCard(cfg) {
      var count = h('span', { class: 'el-count' }), sels = {}, groups = [];
      var content = h('div', { class: 'el-body' });
      function total() {
        var need = 0, have = 0;
        groups.forEach(function (g) { need += g.def.pick; have += Math.min(sels[g.key].length, g.def.pick); });
        count.textContent = have + ' / ' + need + ' 선택';
      }
      cfg.groups.forEach(function (gc, gi) {
        var key = gc[0], def = E[gc[1]];
        var sel = (Array.isArray(prefs[key]) ? prefs[key] : []).slice(); sels[key] = sel; groups.push({ key: key, def: def });
        var gcount = h('span', { class: 'el-gcount' }), btns = [];
        function update() {
          gcount.textContent = sel.length + ' / ' + def.pick;
          btns.forEach(function (x) {
            var on = sel.indexOf(x.o.n) >= 0, full = !on && sel.length >= def.pick;
            x.b.classList.toggle('on', on); x.b.classList.toggle('dis', full); x.b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          total();
        }
        var sec = h('div', { class: 'el-sec' }, [h('div', { class: 'el-sh' }, [h('div', null, [h('b', { text: def.title }), h('small', { text: '택' + def.pick + ' · ' + def.credits + '학점' })]), gcount])]);
        var byG = {}, order = [];
        def.options.forEach(function (o) { if (!byG[o.g]) { byG[o.g] = []; order.push(o.g); } byG[o.g].push(o); });
        order.forEach(function (g) {
          sec.appendChild(h('div', { class: 'el-g', text: g }));
          var wrap = h('div', { class: 'el-chips' });
          byG[g].forEach(function (o) {
            var b = h('button', { class: 'el-chip', type: 'button', 'aria-pressed': 'false', text: o.n });
            if (key === 'el2' && gcNames[normName(o.n)]) b.appendChild(h('i', { class: 'el-dot', title: '등급컷 자료 있음' }));
            b.addEventListener('click', function () {
              var on = sel.indexOf(o.n) >= 0, full = !on && sel.length >= def.pick;
              if (on) sel.splice(sel.indexOf(o.n), 1); else if (!full) sel.push(o.n); else return;
              prefs[key] = sel; prefSave(prefs); update();
              if (key === 'el2') {
                syncCta(); GC_STATE = GC_STATE === 'done' ? 'dirty' : GC_STATE; renderHome(); refreshTable();
                if (typeof drawBlocks === 'function') { drawBlocks(); refreshWeekly(); }
                // 5개를 다 고르면 바로 내 시간표로 (칩이 눌리는 모션이 보이도록 잠깐 뒤에)
                if (sel.length === def.pick) setTimeout(function () { goTab('exam'); setTimeout(function () { jumpTo('sec-table'); }, 80); }, 650);
              }
            });
            btns.push({ o: o, b: b }); wrap.appendChild(b);
          });
          sec.appendChild(wrap);
        });
        update(); content.appendChild(sec);
      });
      var cta = null;
      if (cfg.open) {
        cta = h('button', { class: 'btn el-cta', type: 'button', text: '내 시간표 확인하기 →' });
        cta.addEventListener('click', function () { goTab('exam'); setTimeout(function () { jumpTo('sec-table'); }, 80); });
      }
      function syncCta() { if (cta) cta.hidden = (sels.el2 || []).length < 5; }
      syncCta();
      var box = h('details', { class: 'card el-card' }, [h('summary', { class: 'el-sum' }, [h('div', null, [h('div', { class: 'eyebrow', text: cfg.eyebrow }), h('h2', { text: cfg.title })]), count]), content, cta]);
      if (cfg.open) box.setAttribute('open', '');
      total();
      return box;
    }
    p.appendChild(semCard(SEM_CARDS[0]));
    p.appendChild(h('div', { class: 'note-sm el-hint', text: '파란 점이 있는 과목은 등급컷 자료가 있어요. 고른 과목은 등급컷 탭과 기말 목표 계산기에 먼저 나와요.' }));

    // 선택과목 반(A~E): 고른 과목마다 몇 반인지
    var blkCard = h('div', { class: 'card' });
    function drawBlocks() {
      clear(blkCard);
      var mine = myElectives(), bl = prefLoad().blocks || {};
      blkCard.appendChild(h('div', { class: 'el-sum', style: 'cursor:default' }, [h('div', null, [h('div', { class: 'eyebrow', text: 'A ~ E' }), h('h2', { text: '내 선택과목 반' })]),
        h('span', { class: 'el-count', text: blocksAssigned() + ' / ' + Math.max(mine.length, 1) + ' 정함' })]));
      var body = h('div', { class: 'el-body' });
      if (!mine.length) body.appendChild(h('div', { class: 'note-sm', text: '위에서 2학기 선택과목을 먼저 골라 주세요.' }));
      else {
        body.appendChild(h('div', { class: 'note-sm', text: '시간표의 A~E 중 과목마다 내 반을 골라 주세요. 한 글자는 한 과목만 쓸 수 있어요.' }));
        mine.forEach(function (name) {
          var row = h('div', { class: 'blk-row' }, [h('div', { class: 'blk-n', text: name })]);
          var chips = h('div', { class: 'blk-chips' });
          ['A', 'B', 'C', 'D', 'E'].forEach(function (L) {
            var on = bl[name] === L, usedBy = Object.keys(bl).filter(function (n) { return n !== name && bl[n] === L && mine.indexOf(n) >= 0; })[0];
            var b = h('button', { class: 'el-chip blk' + (on ? ' on' : '') + (usedBy ? ' dis' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', text: L, title: usedBy ? usedBy + '이(가) 사용 중' : '' });
            b.addEventListener('click', function () {
              var p2 = prefLoad(), m2 = p2.blocks || {};
              if (m2[name] === L) delete m2[name]; else { Object.keys(m2).forEach(function (n) { if (m2[n] === L) delete m2[n]; }); m2[name] = L; }
              p2.blocks = m2; prefSave(p2); drawBlocks(); refreshWeekly(); renderHome();
            });
            chips.appendChild(b);
          });
          row.appendChild(chips); body.appendChild(row);
        });
      }
      if (mine.length >= 5 && blocksAssigned() >= mine.length) {   // 반을 다 정하면: 일과표 보러가기 / 저장
        var see = h('button', { class: 'btn', type: 'button', text: '일과표 보러 가기 →' });
        see.addEventListener('click', showWeekly);
        var save = h('button', { class: 'btn out', type: 'button', text: '📷 사진으로 저장' });
        save.addEventListener('click', saveWeeklyImage);
        body.appendChild(h('div', { class: 'blk-done' }, [h('div', { class: 'note-sm', text: '✅ 선택과목 반을 모두 정했어요. 내용은 자동으로 저장돼요.' }), h('div', { class: 'af-btns' }, [see, save])]));
      }
      blkCard.appendChild(body);
    }
    drawBlocks();
    p.appendChild(blkCard);

    p.appendChild(h('div', { class: 'el-next', text: '내년 · 지난 학기' }));
    SEM_CARDS.slice(1).forEach(function (c) { p.appendChild(semCard(c)); });
    var out = h('button', { class: 'btn out', type: 'button', text: '로그아웃' });
    out.addEventListener('click', function () { document.getElementById('logoutBtn').click(); });
    p.appendChild(out);
  }

  // ---------- 등급컷 (gradecut 계산 로직을 내장) ----------
  var GC = null, GC_STATE = 'idle', GC_SYNC = false, GKEY = 'gcscore26';
  function gcLoad() { if (PREVIEW) return PREVIEW.scores || {}; try { return JSON.parse(localStorage.getItem(GKEY) || '{}'); } catch (e) { return {}; } }
  function gcSave(o) { if (PREVIEW) return; try { localStorage.setItem(GKEY, JSON.stringify(o)); } catch (e) {} }
  function gradeGate() {
    var n = myElectives().length;
    if (n >= 5) return false;
    var p = document.getElementById('panel-grade'); clear(p);
    var go = h('button', { class: 'btn', type: 'button', text: '선택과목 고르러 가기 →' });
    go.addEventListener('click', function () { goTab('me'); });
    p.appendChild(h('div', { class: 'card' }, [head('LOCKED', '먼저 선택과목을 골라 주세요'), h('div', { class: 'card-b' }, [
      h('div', { class: 'gate-ic', text: '🔐' }),
      h('div', { class: 'note-sm', text: '내가 듣는 과목의 등급컷과 기말 목표를 보려면, 2학기 선택과목(택5)을 먼저 골라야 해요. 지금 ' + n + ' / 5 선택했어요.' }),
      go])]));
    if (GC_STATE === 'done') GC_STATE = 'dirty';
    return true;
  }
  function loadGrade() {
    if (gradeGate()) return;
    var p = document.getElementById('panel-grade');
    if (GC_STATE === 'dirty') { GC_STATE = 'done'; renderGrade(); return; }
    if (GC_STATE === 'loading' || GC_STATE === 'done') return;
    GC_STATE = 'loading'; clear(p);
    p.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-b' }, [h('div', { class: 'empty', text: '등급컷을 불러오는 중이에요…' })])]));
    fetch('/api/cuts', { headers: { authorization: 'Bearer ' + (load('tok26') || '') }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { GC = j; return syncScores().then(function (ok) { GC_SYNC = ok; GC_STATE = 'done'; renderGrade(); renderMe(); }); })
      .catch(function () {
        GC_STATE = 'idle'; clear(p);
        p.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-b' }, [h('div', { class: 'empty', text: '등급컷을 못 불러왔어요. 잠시 후 다시 눌러 보세요.' })])]));
      });
  }
  function renderGrade() {
    var p = document.getElementById('panel-grade'); clear(p);
    var G = window.GradeCut, scores = gcLoad();
    var exams = []; GC.subjects.forEach(function (s) { if (exams.indexOf(s.exam) < 0) exams.push(s.exam); });
    var exam = exams[0];
    var summary = h('div', { class: 'card gc-sum' });
    var list = h('div', { class: 'gc-list' });
    var asof = GC.updated ? new Date(GC.updated).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

    p.appendChild(h('div', { class: 'card' }, [head('GRADE CUT ARCHIVE', '오송고 등급컷 아카이브'), h('div', { class: 'card-b' }, [
      h('div', { class: 'note-sm', text: '오송고 2학년 시험 기준 · 학생들이 모은 정보예요 (학교 공식 자료 아님). 5등급제: 1컷 상위 10% · 2컷 34% · 3컷 66% · 4컷 90%' }),
      secureNote(GC_SYNC),
      h('div', { class: 'note-sm', text: asof ? '등급컷 업데이트 ' + asof : '' }),
      h('a', { class: 'linkbtn', href: 'https://bldoijoa01-lab.github.io/gradecut/', target: '_blank', rel: 'noopener', text: '원본 사이트(수행 점수·성적표 이미지 등) ↗' })
    ])]));
    var mineNames = myElectives().map(normName), showAll = false;
    function visible(d) { return showAll || !mineNames.length || d.common || mineNames.indexOf(normName(d.subject)) >= 0; }
    var cutView = h('div'), calcView = h('div'); calcView.hidden = true;
    var seg = h('div', { class: 'seg' });
    [['과목 컷', cutView], ['기말 목표 계산기', calcView]].forEach(function (v, i) {
      var b = h('button', { class: 'seg-b', type: 'button', text: v[0], 'aria-pressed': i === 0 ? 'true' : 'false' });
      b.addEventListener('click', function () {
        cutView.hidden = v[1] !== cutView; calcView.hidden = v[1] !== calcView;
        Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (v[1] === calcView) drawCalc();
      });
      seg.appendChild(b);
    });
    p.appendChild(seg);
    if (mineNames.length) {
      var allBtn = h('button', { class: 'linkbtn all-toggle', type: 'button', text: '내 선택과목만 보는 중 · 전체 과목 보기' });
      allBtn.addEventListener('click', function () { showAll = !showAll; allBtn.textContent = showAll ? '전체 과목 보는 중 · 내 과목만 보기' : '내 선택과목만 보는 중 · 전체 과목 보기'; drawList(); drawCalc(); });
      p.appendChild(allBtn);
    } else {
      var go = h('button', { class: 'linkbtn all-toggle', type: 'button', text: '내 정보에서 선택과목을 고르면 내 과목만 모아 볼 수 있어요 →' });
      go.addEventListener('click', function () { goTab('me'); });
      p.appendChild(go);
    }
    p.appendChild(cutView); p.appendChild(calcView);
    var chips = null;
    if (exams.length > 1) {
      chips = h('div', { class: 'jump' });
      exams.forEach(function (ex) {
        var b = h('button', { class: 'jump-b', type: 'button', text: ex, 'aria-pressed': ex === exam ? 'true' : 'false' });
        b.addEventListener('click', function () { exam = ex; Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); drawList(); });
        chips.appendChild(b);
      });
      cutView.appendChild(chips);
    }
    cutView.appendChild(summary); cutView.appendChild(list);

    function cutBox(i, v) {
      var pr = G.parse(v), t = String(v || '').trim();
      return h('div', { class: 'cut' + (!pr ? ' none' : pr.unsure ? ' est' : '') }, [h('small', { text: (i + 1) + '컷' }), h('b', { text: pr ? (pr.unsure ? '≈' : '') + G.num(pr.n) + (/x/i.test(t) ? '+' : '') : '—' })]);
    }
    function drawSummary(rows) {
      clear(summary);
      var graded = rows.filter(function (r) { return r.g; });
      if (!graded.length) { summary.appendChild(h('div', { class: 'card-b' }, [h('div', { class: 'empty', text: '아래 과목에 내 점수를 넣으면 등급과 예상 석차가 나와요.' })])); return; }
      var sum = 0, cr = 0, unsure = false;
      graded.forEach(function (r) { var w = r.d.cr || 1; sum += r.g.n * w; cr += w; if (r.g.u) unsure = true; });
      var avg = (Math.round(sum / cr * 100) / 100).toFixed(2);
      summary.appendChild(h('div', { class: 'card-b gc-sumb' }, [
        h('div', null, [h('div', { class: 'eyebrow', text: '내 평균 등급 (단위수 가중)' }), h('div', { class: 'gc-avg', text: avg })]),
        h('div', { class: 'note-sm', text: graded.length + '과목 입력' + (unsure ? ' · 일부는 추정 컷 기준이라 바뀔 수 있어요' : '') })]));
    }
    function drawList() {
      clear(list);
      var subs = GC.subjects.filter(function (s) { return s.exam === exam && visible(s); })
        .sort(function (a, b) { return (b.common ? 1 : 0) - (a.common ? 1 : 0); });
      var rows = [];
      subs.forEach(function (d) {
        var row = { d: d, g: null }; rows.push(row);
        var badge = h('div', { class: 'gb none' }, [h('b', { text: '—' }), h('i', { text: '점수 입력' })]);
        var info = h('div', { class: 'gc-info' });
        var msg = h('small', { class: 'badmsg' });
        var inp = h('input', { class: 'field gc-in', type: 'text', inputmode: 'decimal', placeholder: '내 점수', 'aria-label': d.subject + ' 내 점수', autocomplete: 'off' });
        inp.value = scores[d.id] || '';
        function calc(save) {
          var raw = inp.value.trim(); clear(info); msg.textContent = '';
          inp.classList.remove('bad'); row.g = null;
          if (save) { if (raw) scores[d.id] = raw; else delete scores[d.id]; gcSave(scores); pushScores(); }
          var bad = G.badNum(raw, 0, 100) ? '0~100 사이 숫자로 넣어 주세요' : G.scoreIssue(d, raw);
          if (bad) { inp.classList.add('bad'); msg.textContent = bad; }
          var x = Object.assign({}, d, { my: bad ? '' : raw }), g = bad ? null : G.gradeInfo(x);
          row.g = g;
          badge.className = 'gb ' + (g ? 'g' + g.n + (g.u ? ' part' : '') : 'none');
          clear(badge);
          if (!raw || bad) { badge.className = 'gb none'; badge.appendChild(h('b', { text: '—' })); badge.appendChild(h('i', { text: '점수 입력' })); }
          else if (!g) { badge.appendChild(h('b', { text: '?' })); badge.appendChild(h('i', { text: '컷 대기' })); }
          else { badge.appendChild(h('b', { text: g.n + (g.below ? '↓' : '') })); badge.appendChild(h('i', { text: g.below ? '등급 이하' : g.prob && g.u ? '확률 ' + g.pmax + '%' : g.u ? '등급?' : '등급' })); }
          if (g && g.tip) info.appendChild(h('div', { class: 'gc-tip', text: g.tip }));
          var r = (!bad && raw) ? G.rankOf(x) : null;
          if (r) {
            var pct = Math.max(0.1, r.frac * 100); pct = pct < 10 ? pct.toFixed(1) : Math.round(pct);
            var kids;
            if (r.below) kids = ['상위 ' + Math.round(r.frac * 100) + '% 밖'];
            else if (r.rank) {
              kids = [(r.sim && r.lo !== r.hi ? '약 ' : ''), h('b', { text: r.rank + '등' }), '/' + r.N + ' · 상위 ' + pct + '%'];
              if (r.sim && r.lo !== r.hi) kids.push(h('span', { class: 'gc-rng', text: ' (90% 범위 ' + r.lo + '~' + r.hi + '등)' }));
            } else kids = ['상위 약 ' + pct + '%'];
            info.appendChild(h('div', { class: 'gc-rank' }, kids));
          }
          drawSummary(rows);
        }
        inp.addEventListener('input', function () { calc(true); });

        var facts = (d.facts || []).length || d.note;
        var detail = facts ? h('details', { class: 'gc-more' }, [h('summary', { text: '자세히 보기' }),
          h('ul', null, (d.facts || []).map(function (f) { return h('li', { text: f }); })),
          d.note ? h('div', { class: 'note-sm', text: d.note }) : null]) : null;

        var cutsEl = h('div', { class: 'cuts' }, [0, 1, 2, 3].map(function (i) { return cutBox(i, (d.c || [])[i]); }));
        var meta = [d.avg ? '평균 ' + String(d.avg).replace('x', '') : null, d.n ? '응시 ' + d.n + '명' : null, d.cr ? d.cr + '단위' : null].filter(Boolean).join(' · ');
        var noCuts = !(d.c || []).some(function (v) { return String(v || '').trim(); });
        list.appendChild(h('div', { class: 'card gc-card' }, [h('div', { class: 'card-b' }, [
          h('div', { class: 'gc-top' }, [
            h('div', null, [h('div', { class: 'gc-name' }, [d.subject, d.alias ? h('span', { class: 'chip', text: d.alias }) : null, d.common ? h('span', { class: 'chip phys', text: '공통' }) : null]),
              h('div', { class: 'ev-sub', text: meta || '정보 수집 중' })]),
            badge]),
          noCuts ? h('div', { class: 'empty', text: '아직 등급컷 정보가 없어요.' }) : cutsEl,
          h('div', { class: 'gc-inrow' }, [inp, info]), msg, detail])]));
        calc(false);
      });
      drawSummary(rows);
    }

    function drawCalc() {
      clear(calcView);
      calcView.appendChild(h('div', { class: 'card' }, [head('FINAL EXAM GOAL', '기말 목표 계산기'), h('div', { class: 'card-b' }, [
        h('div', { class: 'note-sm', text: '중간 점수를 넣은 과목의 학기말 등급 확률과, 목표 등급에 필요한 기말 등수·점수를 계산해요. 학기말 = 중간 25% + 기말 25% + 수행 50%, 다른 학생 수행은 모두 만점으로 봐요. 기말 난이도·분포는 아직 몰라서 중간과 비슷하다고 보고 여러 경우를 섞어요.' }),
        h('div', { class: 'note-sm', text: '점수는 [과목 컷] 화면에서 넣어요.' })
      ])]));
      var subs = GC.subjects.filter(function (s) { return s.exam === exam && visible(s); }), any = false;
      subs.forEach(function (d) {
        var raw = (scores[d.id] || '').trim();
        if (!raw || G.badNum(raw, 0, 100) || G.scoreIssue(d, raw)) return;
        any = true;
        var mid = Object.assign({}, d, { my: raw });
        var perfIn = h('input', { class: 'field gc-in', type: 'text', inputmode: 'decimal', placeholder: '수행 /50', 'aria-label': d.subject + ' 내 수행 점수' });
        perfIn.value = scores['perf-' + d.id] || '';
        var out = h('div', { class: 'calc-out' });
        var slider = h('input', { class: 'semrange', type: 'range', min: '0', max: '100', step: '0.5', value: String(Math.min(100, parseFloat(raw))), 'aria-label': d.subject + ' 기말 목표 점수' });
        var probs = h('div', { class: 'probs' });
        function drawProbs() {
          clear(probs);
          var ps = perfIn.value.trim(), fx = parseFloat(slider.value);
          var r = G.semGp(mid, null, fx, G.badNum(ps, 0, 50) ? '' : ps); if (!r) return;
          probs.appendChild(h('div', { class: 'probs-h' }, [h('b', { text: '기말 ' + fx + '점이면' }), h('small', { text: ' · 내 학기말 원점수 약 ' + (Math.round(r.raw * 10) / 10) })]));
          r.gp.forEach(function (v, k) {
            var pc = Math.round(v * 100);
            probs.appendChild(h('div', { class: 'pr' }, [h('span', { class: 'pr-l', text: (k + 1) + '등급' }),
              h('div', { class: 'pr-bar' }, [h('i', { class: 'g' + (k + 1), style: 'width:' + Math.max(pc, pc ? 2 : 0) + '%' })]), h('span', { class: 'pr-v', text: pc + '%' })]));
          });
        }
        function drawNeed() {
          clear(out);
          var ps = perfIn.value.trim(), bad = G.badNum(ps, 0, 50), info;
          try { info = G.semInfo(mid, null, '', bad ? '' : ps); } catch (e) { info = null; }
          if (!info || !info.M) { out.appendChild(h('div', { class: 'empty', text: '이 과목은 분포 정보가 아직 부족해서 계산할 수 없어요.' })); return; }
          if (bad) out.appendChild(h('div', { class: 'badmsg', text: '수행 점수는 0~50 사이로 넣어 주세요. 지금은 만점으로 계산했어요.' }));
          out.appendChild(h('div', { class: 'needs-h', text: '🎯 학기말 등급별 기말 목표' }));
          info.need.forEach(function (x) {
            var body;
            if (x.from === 0) body = '기말 몇 등이든 유력해요';
            else if (x.from === null) body = '기말 만점이어도 어려워요 (' + x.best + '%)';
            else body = ['기말 ', h('b', { text: '약 ' + x.rank + '등' }), ' 안' + (x.rlo !== x.rhi ? ' (' + x.rlo + '~' + x.rhi + '등)' : ''),
              h('small', { text: '점수로는 ' + x.from + '점 이상' + (x.sr ? ' · 난이도에 따라 ' + (x.sr[0] == null ? 0 : x.sr[0]) + '~' + (x.sr[1] == null ? '100점↑' : x.sr[1] + '점') : '') })];
            out.appendChild(h('div', { class: 'nb g' + (x.g + 1) }, [h('em', { text: (x.g + 1) + '등급' }), h('div', null, Array.isArray(body) ? body : [body])]));
          });
          out.appendChild(h('div', { class: 'needs-h', text: '🎚 기말 점수를 움직여 보세요' }));
          out.appendChild(slider); out.appendChild(h('div', { class: 'rr' }, [h('span', { text: '0점' }), h('span', { text: '100점' })]));
          out.appendChild(probs); drawProbs();
        }
        perfIn.addEventListener('input', function () { var v = perfIn.value.trim(); if (v) scores['perf-' + d.id] = v; else delete scores['perf-' + d.id]; gcSave(scores); pushScores(); drawNeed(); });
        slider.addEventListener('input', drawProbs);
        calcView.appendChild(h('div', { class: 'card gc-card' }, [h('div', { class: 'card-b' }, [
          h('div', { class: 'gc-top' }, [h('div', null, [h('div', { class: 'gc-name', text: d.subject }), h('div', { class: 'ev-sub', text: '중간 ' + raw + '점' })]), perfIn]), out])]));
        drawNeed();
      });
      if (!any) calcView.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-b' }, [h('div', { class: 'empty', text: '[과목 컷]에서 중간 점수를 넣은 과목이 아직 없어요.' })])]));
    }
    drawList();
  }

  // ---------- 기말고사 (시간표 + 이동교실 + 유의사항 한 곳에) ----------
  function jumpTo(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function renderExamJump() {
    var p = document.getElementById('panel-exam');
    var items = [['sec-table', '시간표'], ['sec-move', '이동교실'], ['sec-special', '특별실'], ['sec-caution', '유의사항']];
    p.appendChild(h('div', { class: 'jump' }, items.map(function (it) {
      var b = h('button', { class: 'jump-b', type: 'button', text: it[1] });
      b.addEventListener('click', function () { jumpTo(it[0]); }); return b;
    })));
  }
  function tagExamCards() {
    var map = { 'EXAM TIMETABLE': 'sec-table', 'MOVING ROOM': 'sec-move', 'SPECIAL ROOM': 'sec-special', 'NOTICE': 'sec-caution' };
    Array.prototype.forEach.call(document.querySelectorAll('#panel-exam .card'), function (c) {
      var e = c.querySelector('.eyebrow'); if (e && map[e.textContent]) c.id = map[e.textContent];
    });
  }

  // ---------- 일정 ----------
  function ddayBadge(ev) {
    var d = diffDays(ev.date, TODAY);
    var end = ev.end ? diffDays(ev.end, TODAY) : d;
    var cls = 'dday', txt;
    if (d > 0) { txt = 'D-' + d; if (d <= 7) cls += ' hot'; if (ev.end) cls += ' final'; }
    else if (end >= 0) { txt = d === 0 ? 'D-DAY' : '진행 중'; cls += d === 0 ? ' hot' : ' ing'; }
    else return null;
    return h('div', { class: cls, text: txt });
  }
  function renderToday() {
    var p = document.getElementById('panel-today'); clear(p);
    var byDate = function (a, b) { return toUTC(a.date) - toUTC(b.date); };
    var base = DATA.events.filter(function (e) { return diffDays(e.end || e.date, TODAY) >= 0; }).sort(byDate);   // 반 공통 일정(헤더용)
    var upcoming = allEvents().filter(function (e) { return diffDays(e.end || e.date, TODAY) >= 0; }).sort(byDate);   // 내 일정 포함
    var hot = upcoming.filter(function (e) { return diffDays(e.date, TODAY) <= 7; });
    var rest = upcoming.filter(function (e) { return diffDays(e.date, TODAY) > 7; });

    // 포스터식 요소: 오늘 체크 띠 + 스타버스트(가장 가까운 일정)
    var nx = base[0], burst = document.getElementById('burst');
    if (nx) {
      var nd = diffDays(nx.date, TODAY), nb = ddayBadge(nx);
      burst.hidden = false; clear(burst);
      burst.appendChild(h('b', { text: nb ? nb.textContent : '' }));
      burst.appendChild(h('span', { text: nx.title.length > 14 ? nx.title.slice(0, 13) + '…' : nx.title }));
    } else burst.hidden = true;

    function evRow(e) {
      var d = diffDays(e.date, TODAY);
      var when = e.end ? fmt(e.date) + '~' + fmt(e.end) : fmt(e.date);
      var sub = h('div', { class: 'ev-sub' }, [h('b', { text: d === 0 ? '오늘 ' + when : when }), e.note ? ' · ' + e.note : '']);
      var main = h('div', { class: 'ev-main' }, [h('div', { class: 'ev-title' }, [e.title, myBadge(e)]), sub]);
      evExtras(e).forEach(function (x) { main.appendChild(x); });
      var dl = myDelBtn(e); if (dl) main.appendChild(dl);
      return h('div', { class: 'ev' }, [main, ddayBadge(e)]);
    }

    var body = [];
    if (nx) body.push(h('div', { class: 'check' }, [h('b', { text: '오늘 체크!' }), ' ' + (diffDays(nx.date, TODAY) === 1 ? '내일 ' : '') + nx.title]));
    if (hot.length) { body.push(h('div', { class: 'tag', text: '🔥 중요!!' })); hot.forEach(function (e) { body.push(evRow(e)); }); }
    if (rest.length) { body.push(h('div', { class: 'tag blue', text: '📌 좀중요' })); rest.forEach(function (e) { body.push(evRow(e)); }); }
    if (!upcoming.length) body.push(h('div', { class: 'empty', text: '예정된 일정이 없어요. 평화 ✌️' }));
    body.push(h('div', { class: 'elect', text: '📣 ' + DATA.electiveNote }));
    var listCard = h('div', { class: 'card' }, [head('SCHEDULE', '수행·시험 일정'), h('div', { class: 'card-b' }, body)]);
    var calCard = buildCalendar();
    var seg = h('div', { class: 'seg' });
    var weeklyCard = buildWeeklyCard();
    var VIEWS = ['list', 'cal', 'week'], vi = Math.max(0, VIEWS.indexOf(todayView));
    listCard.hidden = vi !== 0; calCard.hidden = vi !== 1; weeklyCard.hidden = vi !== 2;
    [['목록', listCard], ['캘린더', calCard], ['주간 시간표', weeklyCard]].forEach(function (v, i) {
      var b = h('button', { class: 'seg-b', type: 'button', text: v[0], 'aria-pressed': i === vi ? 'true' : 'false' });
      b.addEventListener('click', function () {
        todayView = VIEWS[i];
        listCard.hidden = v[1] !== listCard; calCard.hidden = v[1] !== calCard; weeklyCard.hidden = v[1] !== weeklyCard;
        Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
      seg.appendChild(b);
    });
    var addBtn = h('button', { class: 'linkbtn add-ev', type: 'button', text: '＋ 내 일정 추가' });
    var formSlot = h('div');
    addBtn.addEventListener('click', function () {
      if (formSlot.firstChild) { clear(formSlot); return; }
      formSlot.appendChild(addEventForm(calState && calState.sel ? calState.sel : ''));
    });
    var nc = noticesCard(); if (nc) p.appendChild(nc);
    p.appendChild(h('div', { class: 'seg-row' }, [seg, addBtn])); p.appendChild(formSlot);
    p.appendChild(listCard); p.appendChild(calCard); p.appendChild(weeklyCard);
  }

  // ---------- 기말 시간표 ----------
  var ttCard = null, ttMine = true;
  // 내 선택과목에 맞춰 칸 고르기: 선택 칸이 여러 과목이면 내 과목만, 내 과목이 없으면 자습 칸
  function myCell(c) {
    if (c.k !== 'elective') return { t: c.t, k: c.k };
    var mine = myElectives().map(normName);
    var hit = c.t.split('/').map(function (x) { return x.trim(); }).filter(function (x) { return mine.indexOf(normName(x)) >= 0; });
    return hit.length ? { t: hit.join(' / '), k: 'elective' } : { t: '시험 없음', k: 'self' };
  }
  function ttCells(d, pi, mineView) { var c = d.cells[pi]; return mineView ? myCell(c) : { t: c.t, k: c.k }; }
  function buildTableCard() {
    var ex = DATA.exam, hasMine = myElectives().length > 0, mineView = hasMine && ttMine;
    var thead = h('tr', null, [h('th', { text: '' })].concat(ex.days.map(function (d) {
      return h('th', { class: diffDays(d.date, TODAY) === 0 ? 'today' : '', text: d.label });
    })));
    var rows = ex.periods.map(function (per, pi) {
      var tr = h('tr', null, [h('th', null, [per.name, h('small', { text: per.time })])]);
      ex.days.forEach(function (d) {
        var c = ttCells(d, pi, mineView);
        tr.appendChild(h('td', { class: 'k-' + c.k + (diffDays(d.date, TODAY) === 0 ? ' today' : ''), text: c.t }));
      });
      return tr;
    });
    var table = h('table', { class: 'tt' }, [h('thead', null, [thead]), h('tbody', null, rows)]);
    var morning = ex.morning.map(function (m) { return m.name + ' ' + m.time; }).join(' · ');
    var body = [];
    if (hasMine) {
      var seg = h('div', { class: 'seg' });
      [['내 시간표', true], ['전체', false]].forEach(function (v) {
        var b = h('button', { class: 'seg-b', type: 'button', text: v[0], 'aria-pressed': ttMine === v[1] ? 'true' : 'false' });
        b.addEventListener('click', function () { ttMine = v[1]; refreshTable(); });
        seg.appendChild(b);
      });
      body.push(seg);
    } else {
      var go = h('button', { class: 'linkbtn', type: 'button', text: '내 정보에서 선택과목을 고르면 내 시간표만 볼 수 있어요 →' });
      go.addEventListener('click', function () { goTab('me'); });
      body.push(go);
    }
    body.push(h('div', { class: 'scroll-hint', text: '← 옆으로 밀어서 보기 →' }));
    body.push(h('div', { class: 'tt-wrap' }, [table]));
    body.push(h('div', { class: 'legend' }, [
      h('span', { class: 'lg' }, [h('i', { style: 'background:var(--blue-t)' }), '공통']),
      h('span', { class: 'lg' }, [h('i', { style: 'background:var(--green-t)' }), mineView ? '내 선택과목' : '선택 ( / = 둘 중 내 과목 )']),
      h('span', { class: 'lg' }, [h('i', { style: 'background:var(--gray-t)' }), mineView ? '자습 · 시험 없음' : '자습'])
    ]));
    body.push(h('div', { class: 'note-sm' }, [morning + ' · 점심 있음 (', h('b', { text: fmt(ex.noLunchDate) + '만 점심 없음' }), ')']));
    var photo = h('button', { class: 'btn', type: 'button', text: '📷 사진으로 저장' });
    photo.addEventListener('click', function () { saveTimetableImage(hasMine ? true : false, photo); });
    body.push(photo);
    var card = h('div', { class: 'card', id: 'sec-table' }, [head('EXAM TIMETABLE', mineView ? '내 기말고사 시간표' : '2학기 기말고사 시간표 (2학년)'), h('div', { class: 'card-b' }, body)]);
    return card;
  }
  function refreshTable() {
    if (!ttCard || !ttCard.parentNode) return;
    var n = buildTableCard(); n.classList.add('swap-in'); ttCard.parentNode.replaceChild(n, ttCard); ttCard = n;
  }
  function renderTable() {
    ttCard = buildTableCard(); document.getElementById('panel-exam').appendChild(ttCard);
  }

  // 시간표를 사진(PNG)으로: 캔버스에 직접 그려서 저장/공유
  function saveTimetableImage(mineView, btn) {
    var ex = DATA.exam, me = DATA.me, mv = mineView && ttMine;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var W = 1080, pad = 48, labW = 150, gap = 10, nd = ex.days.length, np = ex.periods.length;
    var cw = (W - pad * 2 - labW - gap * nd) / nd, ch = 150, headH = 64, top = 210;
    var H = top + headH + np * (ch + gap) + 150;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
    var C = dark ? { bg: '#0F1218', ink: '#EAEEFB', sub: '#A6B0CB', head: '#262C3A', lab: '#222735', common: '#1D2A4A', commonT: '#9DB8FF', el: '#173326', self: '#222735', selfT: '#7C8496' }
                 : { bg: '#EAF0FF', ink: '#1A2040', sub: '#566078', head: '#1A2040', lab: '#E7EAF3', common: '#DCE6FE', commonT: '#2E58D6', el: '#DDF2E8', self: '#ECEEF4', selfT: '#8590A8' };
    function rr(px, py, w, h2, r, fill) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h2, r); x.arcTo(px + w, py + h2, px, py + h2, r); x.arcTo(px, py + h2, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); x.fillStyle = fill; x.fill(); }
    function wrap(text, cx, cy, maxW, lh) {
      var words = text.split(' '), lines = [], cur = '';
      words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
      if (cur) lines.push(cur);
      var y0 = cy - (lines.length - 1) * lh / 2;
      lines.forEach(function (l, i) { x.fillText(l, cx, y0 + i * lh); });
    }
    var F = 'PretendardL, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 40px PretendardL'), document.fonts.load('500 28px PretendardL')]) : Promise.resolve()).catch(function () {}).then(function () {
      var g = x.createLinearGradient(0, 0, W, H);
      if (dark) { g.addColorStop(0, '#0A0F22'); g.addColorStop(1, '#190F26'); } else { g.addColorStop(0, '#DCE8FF'); g.addColorStop(0.55, '#F0E4FF'); g.addColorStop(1, '#FFE6EE'); }
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillStyle = C.sub; x.font = '700 26px ' + F; x.fillText('2-6 알림장  ·  2학기 기말고사', pad, 78);
      x.fillStyle = C.ink; x.font = '800 60px ' + F; x.fillText(mv ? '내 시간표' : '기말고사 시간표', pad, 142);
      if (mv) { x.textAlign = 'right'; x.fillStyle = C.commonT; x.font = '800 34px ' + F; x.fillText(me.name + ' · ' + me.n + '번', W - pad, 142); }
      x.textAlign = 'center';
      ex.days.forEach(function (d, i) {
        var px = pad + labW + gap + i * (cw + gap);
        rr(px, top, cw, headH, 18, C.head); x.fillStyle = dark ? '#EAEEFB' : '#FFFFFF'; x.font = '800 28px ' + F; x.fillText(d.label, px + cw / 2, top + headH / 2);
      });
      ex.periods.forEach(function (per, pi) {
        var py = top + headH + gap + pi * (ch + gap);
        rr(pad, py, labW, ch, 18, C.lab);
        x.fillStyle = C.ink; x.font = '800 30px ' + F; x.fillText(per.name, pad + labW / 2, py + ch / 2 - 18);
        x.fillStyle = C.sub; x.font = '500 20px ' + F; x.fillText(per.time, pad + labW / 2, py + ch / 2 + 20);
        ex.days.forEach(function (d, i) {
          var c = ttCells(d, pi, mv), px = pad + labW + gap + i * (cw + gap);
          rr(px, py, cw, ch, 18, c.k === 'common' ? C.common : c.k === 'elective' ? C.el : C.self);
          x.fillStyle = c.k === 'common' ? C.commonT : c.k === 'self' ? C.selfT : C.ink;
          x.font = (c.k === 'self' ? '500 ' : '800 ') + '27px ' + F; wrap(c.t, px + cw / 2, py + ch / 2, cw - 24, 34);
        });
      });
      x.textAlign = 'left'; x.fillStyle = C.sub; x.font = '500 24px ' + F;
      x.fillText(ex.morning.map(function (m) { return m.name + ' ' + m.time; }).join(' · '), pad, H - 84);
      x.fillText('점심 있음 · ' + fmt(ex.noLunchDate) + '만 점심 없음', pad, H - 44);
      x.textAlign = 'right'; x.fillText('class-26.bldoijoa01.workers.dev', W - pad, H - 44);
      cv.toBlob(function (blob) {
        if (!blob) return;
        var name = '기말고사-시간표' + (mv ? '-' + me.name : '') + '.png', file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: '기말고사 시간표' }).catch(function () {});
        } else {
          var u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
        }
      }, 'image/png');
    });
  }

  // ---------- 이동교실 (로그인한 계정 기준 자동 판별) ----------
  function renderMove() {
    var p = document.getElementById('panel-exam');
    var mv = DATA.move, me = DATA.me, n = me.n;

    var numOut = h('div', { class: 'result' });
    if (n <= mv.frontCount) {
      numOut.classList.add('go');
      numOut.appendChild(h('strong', { text: me.name + '(' + n + '번) → ' + mv.otherRoom + ' 교실로 이동!' }));
      numOut.appendChild(document.createTextNode(mv.moveTime + ' 사이에 이동 (1교시 시작 10분 전까지 도착). 책상 번호순 착석.'));
      numOut.appendChild(h('div', { class: 'note-sm', style: 'margin-top:6px', text: '※ 빈 번호(자퇴·전출 등)가 있으면 앞번호 컷이 밀려요. 애매하면 담임쌤께 확인!' }));
    } else {
      numOut.classList.add('stay');
      numOut.appendChild(h('strong', { text: me.name + '(' + n + '번) → 우리 교실(' + mv.ownRoom + ') 그대로!' }));
      numOut.appendChild(document.createTextNode('1학년 6반 앞번호 ' + mv.frontCount + '명이 우리 교실로 와요.'));
    }
    p.appendChild(h('div', { class: 'card' }, [head('MOVING ROOM', '① 내 원반 이동'), h('div', { class: 'card-b' }, [
      numOut, seatBlock(),
      h('ul', { class: 'rules' }, mv.rules.map(function (r) { return h('li', { text: r }); }))
    ])]));

    var kids = [];
    if (!DATA.special.length) {
      kids.push(h('div', { class: 'result none', text: me.name + ' → 특별실 응시 과목 없음 (원반 이동 규칙만 확인!)' }));
    } else {
      DATA.special.forEach(function (s) {
        var chipCls = s.room.indexOf('외국어') === 0 ? 'ext' : 'pub';
        kids.push(h('div', { class: 'sp-row' }, [
          h('div', { class: 'sp-top' }, [h('span', { class: 'sp-sub', text: s.subject }), h('span', { class: 'chip ' + chipCls, text: '4층 ' + s.room })]),
          h('div', { class: 'sp-when', text: s.label + ' 시작' })
        ]));
      });
      kids.push(h('div', { class: 'callout', text: DATA.specialNote }));
    }
    p.appendChild(h('div', { class: 'card' }, [head('SPECIAL ROOM', '② 내 특별실(4층) 응시'), h('div', { class: 'card-b' }, kids)]));
  }

  // ---------- 내 고사장 자리배치도 (이동 공지 카드 안에 작게: 5열 · 66676, 홀수열=원반 · 짝수열=이동반, 번호순) ----------
  function seatBlock() {
    var mv = DATA.move, me = DATA.me;
    var cols = (mv.seats && mv.seats.cols) || [6, 6, 6, 7, 6], front = mv.frontCount, rows = Math.max.apply(null, cols);
    function seq(isOdd) {   // 열 순서대로 앞(칠판)에서 뒤로 채움
      var out = [];
      cols.forEach(function (n, ci) { if ((ci % 2 === 0) === isOdd) for (var r = 0; r < n; r++) out.push({ c: ci, r: r }); });
      return out;
    }
    var odd = seq(true), even = seq(false);   // odd: 원반 18명, even: 이동반 13명
    var moved = me.n <= front, room = moved ? mv.otherRoom : mv.ownRoom;
    var mine = moved ? even[me.n - 1] : odd[me.n - front - 1];
    var grid = h('div', { class: 'seat-grid sm', style: 'grid-template-columns:repeat(' + cols.length + ',1fr)' });
    for (var r = 0; r < rows; r++) cols.forEach(function (n, ci) {
      if (r >= n) { grid.appendChild(h('div', { class: 'seat blank' })); return; }
      var isOdd = ci % 2 === 0, list = isOdd ? odd : even, idx = list.findIndex(function (s) { return s.c === ci && s.r === r; });
      var num = isOdd ? front + 1 + idx : idx + 1, isMe = mine && mine.c === ci && mine.r === r;
      grid.appendChild(h('div', { class: 'seat ' + (isOdd ? 'own' : 'mv') + (isMe ? ' me' : '') }, [h('b', { text: isMe ? '★' : String(num) })]));
    });
    return h('div', { class: 'seatbox' }, [
      h('div', { class: 'seat-line' }, [h('b', { text: '내 자리' }), ' ' + room + ' · ' + (mine.c + 1) + '열 앞에서 ' + (mine.r + 1) + '번째']),
      h('div', { class: 'seat-board', text: '칠판 · 교탁' }),
      h('div', { class: 'seat-cols' }, cols.map(function (n, ci) { return h('span', { text: (ci + 1) + '열' }); })), grid,
      h('div', { class: 'seat-leg' }, [h('span', { class: 'lg' }, [h('i', { style: 'background:var(--blue-t)' }), '홀수열 원반']), h('span', { class: 'lg' }, [h('i', { style: 'background:var(--amber-t)' }), '짝수열 이동반']), h('span', { text: '← 운동장쪽 창가' })])]);
  }

  // ---------- 유의사항 ----------
  function renderCaution() {
    var p = document.getElementById('panel-exam');
    p.appendChild(h('div', { class: 'card' }, [head('NOTICE', '시험 유의사항'), h('div', { class: 'card-b' },
      DATA.cautions.map(function (c) {
        return h('div', { class: 'cau' }, [h('div', null, [h('div', { class: 'cau-t', text: c.t }), h('div', { class: 'cau-s', text: c.s })])]);
      }))]));
  }

  // ---------- init ----------
  function init(data) {
    DATA = data;
    document.body.classList.remove('locked');
    document.body.classList.add('enter'); setTimeout(function () { document.body.classList.remove('enter'); }, 1600);
    var who = document.getElementById('who'); who.hidden = false;
    var isT = DATA.me.role === 'teacher';
    who.textContent = isT ? DATA.me.name + ' 선생님' : DATA.me.name + ' · ' + DATA.me.n + '번';
    document.body.classList.toggle('teacher', isT);
    var d = new Date(TODAY);
    document.getElementById('todayLabel').textContent = (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + DOW[d.getUTCDay()] + ')';
    document.getElementById('updated').textContent = DATA.className + ' 알림장 · 마지막 업데이트 ' + fmt(DATA.updated);
    if (isT) {   // 교사 계정: 학생 전용 화면(홈·기말고사·등급컷·내 정보)은 만들지 않음
      renderMore(); renderToday(); renderTeacher();
      var ts = (location.hash || '').replace('#', '');
      selectTab(['teacher', 'today', 'more'].indexOf(ts) >= 0 ? ts : 'teacher');
      return;
    }
    clear(document.getElementById('panel-exam'));
    renderMe(); renderMore(); renderHome(); renderToday(); renderExamJump(); renderTable(); renderMove(); renderCaution();
    tagExamCards();
    pushShare();
    var start = (location.hash || '').replace('#', '');
    start = { table: 'exam', move: 'exam', caution: 'exam' }[start] || start;
    selectTab(['home', 'today', 'exam', 'grade', 'naesin', 'me', 'more'].indexOf(start) >= 0 ? start : 'home');
  }

  // ---------- 로그인 (서버: 이름+번호) ----------
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function api(path, body) {
    return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
  }
  function card(kids) { document.body.classList.add('locked'); var p = document.getElementById('panel-today'); p.hidden = false; clear(p); p.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-b' }, kids)])); }

  function showLogin(msg, pre) {
    pre = pre || {};
    var nameIn = h('input', { type: 'text', class: 'login-in', placeholder: '이름', autocomplete: 'username' });
    var numIn = h('input', { type: 'number', class: 'login-in', placeholder: '번호', inputmode: 'numeric' });
    var pwIn = h('input', { type: 'password', class: 'login-in', placeholder: '비밀번호 (처음이면 반 코드)', autocomplete: 'current-password' });
    nameIn.value = pre.name || ''; numIn.value = pre.number || '';
    var err = h('div', { class: 'empty', text: msg || '' });
    var btn = h('button', { class: 'btn', type: 'button', text: '입장' });
    function go() {
      if (!nameIn.value || !numIn.value || !pwIn.value) return;
      btn.disabled = true; err.textContent = '확인 중…';
      api('/api/login', { name: nameIn.value, number: numIn.value, secret: pwIn.value }).then(function (j) {
        if (j.status === 429) { btn.disabled = false; err.textContent = '많이 틀렸어요. 10분 뒤에 다시 시도하세요.'; }
        else if (j.status !== 200) { btn.disabled = false; err.textContent = '이름·번호·비밀번호가 맞지 않아요.'; }
        else if (j.setup) showSetup(j.token, parseInt(numIn.value, 10));
        else { store('tok26', j.token); store('pwlen26', String(pwIn.value.length)); rememberKey(pwIn.value, parseInt(numIn.value, 10)).then(loadData); }
      }).catch(function () { btn.disabled = false; err.textContent = '연결에 실패했어요. 다시 시도하세요.'; });
    }
    btn.addEventListener('click', go);
    pwIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    card([h('div', { class: 'login-brand' }, [h('span', { class: 'logo', text: '6' }), h('b', { text: '2-6 알림장' })]), h('div', { class: 'login-sub', text: '우리 반 전용이에요. 이름·번호·비밀번호를 입력하세요. 처음이면 비밀번호 칸에 반 코드를 넣으세요.' }), nameIn, numIn, pwIn, btn, err]);
  }

  function showSetup(setupToken, num) {
    var p1 = h('input', { type: 'password', class: 'login-in', placeholder: '새 비밀번호 (4자 이상)', autocomplete: 'new-password' });
    var p2 = h('input', { type: 'password', class: 'login-in', placeholder: '새 비밀번호 확인', autocomplete: 'new-password' });
    var err = h('div', { class: 'empty', text: '' });
    var btn = h('button', { class: 'btn', type: 'button', text: '비밀번호 정하고 입장' });
    function go() {
      if (p1.value.length < 4) { err.textContent = '4자 이상으로 정하세요.'; return; }
      if (p1.value !== p2.value) { err.textContent = '두 번 입력한 비밀번호가 달라요.'; return; }
      btn.disabled = true;
      api('/api/setpw', { token: setupToken, password: p1.value }).then(function (j) {
        if (j.status === 200) { store('tok26', j.token); store('pwlen26', String(p1.value.length)); rememberKey(p1.value, num).then(loadData); }
        else { btn.disabled = false; err.textContent = '시간이 지났어요. 처음부터 다시 입장하세요.'; }
      }).catch(function () { btn.disabled = false; err.textContent = '연결에 실패했어요.'; });
    }
    btn.addEventListener('click', go);
    p2.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    card([h('div', { class: 'login-brand' }, [h('span', { class: 'logo', text: '6' }), h('b', { text: '비밀번호 설정' })]), h('div', { class: 'login-sub', text: '반 코드 확인 완료! 나만의 비밀번호를 정하세요. 다음부터는 이 비밀번호로 입장해요. (잊어버리면 담당자에게 초기화 요청)' }), p1, p2, h('div', { class: 'note-sm', text: '4자리 숫자도 가능해요. 다만 짧을수록 남이 맞히기 쉽고, 내 점수 암호도 약해져요. 6자 이상을 권장해요.' }), btn, err]);
  }

  function loadData() {
    var tok = load('tok26');
    if (!tok) return showLogin();
    fetch('/api/data', { headers: { authorization: 'Bearer ' + tok }, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) { store('tok26', null); showLogin('로그인이 만료됐어요. 다시 입장하세요.'); return null; }
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) { if (d) init(d); })
      .catch(function () {
        var p = document.getElementById('panel-today'); clear(p);
        p.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-b' }, [
          h('div', { class: 'empty', text: '데이터를 못 불러왔어요. 잠시 후 다시 시도하세요.' })])]));
      });
  }
  loadData();
})();
