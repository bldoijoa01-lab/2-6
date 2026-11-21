// 전자칠판 전용 화면 (role 'board' 계정으로 로그인했을 때): 교실에 띄워 두는 대시보드 + 수업 도구
// 오늘(알림장·일과·급식·일정·청소) / 의견 보드 / 발표자 뽑기 / 모둠 나누기
(function () {
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  var KIND_META = {
    pin: { label: '중요', cls: 'pin' },
    notice: { label: '공지', cls: 'notice' },
    prep: { label: '준비물', cls: 'prep' },
    hw: { label: '과제', cls: 'hw' },
    time: { label: '시간', cls: 'time' }
  };
  var ICONS = {
    home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    clean: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    announce: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    study: '<path d="M2 5a2 2 0 0 1 2-2h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4a2 2 0 0 1-2-2z"/><path d="M22 5a2 2 0 0 0-2-2h-6a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h7a2 2 0 0 0 2-2z"/>',
    seat: '<rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="14" y="4" width="7" height="6" rx="1.5"/><rect x="3" y="14" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/>',
    game: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4"/><path d="M8 10v4"/><circle cx="15.5" cy="11" r=".8" fill="currentColor"/><circle cx="17.5" cy="13" r=".8" fill="currentColor"/>',
    board: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    pick: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/>',
    group: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.79 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    notice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    meal: '<path d="M4 3v7a3 3 0 0 0 3 3v8"/><path d="M7 3v7"/><path d="M10 3v7a3 3 0 0 1-3 3"/><path d="M17 3v18"/><path d="M17 3c2 0 3 2.5 3 6s-1 4-3 4"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    broom: '<path d="M14.5 3.5l6 6"/><path d="M18 7l-8.5 8.5"/><path d="M9.5 15.5L4 17l3 3 1.5-5.5z"/><path d="M5 13l6 6"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>',
    shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
    reset: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    door: '<path d="M13 4h5a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2h7z"/><path d="M13 4v16"/><circle cx="10.5" cy="12" r=".8" fill="currentColor"/>',
    fullscreen: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
  };
  function svgIcon(name) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ks-svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ICONS.notice;
    return s;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function tok() { return load('tok26') || ''; }
  function kst() { return new Date(Date.now() + 9 * 3600e3); }               // UTC getter로 읽으면 한국 시각
  function isoOf(d) { return d.toISOString().slice(0, 10); }
  function toUTC(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function pad(n) { return ('0' + n).slice(-2); }
  function beep(times) {                                                      // 타이머 종료음 (WebAudio)
    try { var C = window.AudioContext || window.webkitAudioContext, a = new C(); for (var i = 0; i < (times || 3); i++) { (function (i) { var o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(a.destination); var t = a.currentTime + i * 0.55; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.start(t); o.stop(t + 0.5); })(i); } } catch (e) {}
  }

  function chime() {   // 딩동 (전환 알림)
    try { var C = window.AudioContext || window.webkitAudioContext, a = new C(); [[660, 0], [523, 0.5]].forEach(function (n) { var o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = n[0]; o.connect(g); g.connect(a.destination); var t = a.currentTime + n[1]; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.start(t); o.stop(t + 1); }); } catch (e) {}
  }
  var SCHED_DEF = { cs: '16:10', js: '16:25', ee: '16:30', msg: '자리에 앉아 주세요', auto: true, chime: true, hs: '08:20', he: '08:30', smsg: '조용히 자습해요 🤫' };   // 청소 시작 · 종례 시작 · 끝 / 자습 시작·끝   // 청소 시작 · 종례 시작 · 끝
  function loadSched() { var s = {}; try { s = JSON.parse(load('ks_sched') || '{}'); } catch (e) {} var o = {}; Object.keys(SCHED_DEF).forEach(function (k) { o[k] = s[k] != null ? s[k] : SCHED_DEF[k]; }); return o; }
  function mins(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }

  function start(data) {
    var D = data, mode = 'today', timers = [], root = el('div', 'ks-root'), head = el('div', 'ks-head'), main = el('div', 'ks-main'), dock = el('div', 'ks-dock');
    var clockEl = el('div', 'ks-clock'), dateEl = el('div', 'ks-date'), periodEl = el('div', 'ks-period'), suEl = el('div', 'ks-period ks-sucd'), examEl = el('div', 'ks-period ks-examcd');
    var hl = el('div', 'ks-hl'), hmeta = el('div', 'ks-hmeta'), dateline = el('div', 'ks-dateline');
    dateline.appendChild(el('span', 'ks-classbadge', D.className || '2-6'));
    dateline.appendChild(dateEl);
    hmeta.appendChild(dateline);
    hmeta.appendChild(periodEl);
    hl.appendChild(clockEl);
    hl.appendChild(el('div', 'ks-hdiv'));
    hl.appendChild(hmeta);
    var hr = el('div', 'ks-hr'), prow = el('div', 'ks-prow');
    prow.appendChild(examEl); prow.appendChild(suEl); hr.appendChild(prow);
    var atmo = el('div', 'ks-atmo'); atmo.setAttribute('aria-hidden', 'true');
    atmo.appendChild(el('div', 'ks-orb ks-orb-a'));
    atmo.appendChild(el('div', 'ks-orb ks-orb-b'));
    atmo.appendChild(el('div', 'ks-ring'));
    head.appendChild(hl); head.appendChild(hr);
    root.appendChild(atmo); root.appendChild(head); root.appendChild(main); root.appendChild(dock);
    document.body.classList.add('kiosk'); document.body.classList.remove('locked');
    var scale = parseFloat(load('ks_scale') || '1'); root.style.setProperty('--ks', scale);
    var theme = load('ks_theme') === 'light' ? 'light' : 'dark';
    root.classList.toggle('ks-light', theme === 'light');
    function applyTheme(next) { theme = next === 'light' ? 'light' : 'dark'; store('ks_theme', theme); root.classList.toggle('ks-light', theme === 'light'); if (dock.childNodes.length) paintDock(); }
    var names = null;   // 학생 이름(뽑기·모둠)
    var stLbl = null, stRng = null, KAPI = {}, alertEl = null, alertText = '', SC = loadSched(), barEl = null, cdEl = null, cdEnd = 0, lastPhase = null;
    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function resetTimers() { timers.forEach(clearTimeout); timers = []; }

    // ---------- 공통: 시각·교시 ----------
    // ---- 오늘 일과 시간: 오늘 일정에 '시간표'(예: "1교시 · 08:30~09:20 · 수업", "종례 · 12:20 이후")가 있으면 그걸 우선, 없으면 주간 시간표(+50분) ----
    function hmStr(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
    function daySched() {
      var iso = isoOf(kst()), evs = (D.events || []).filter(function (e) { return e.info && e.date && e.date <= iso && iso <= (e.end || e.date); });
      for (var i = 0; i < evs.length; i++) {
        var rows = [], jong = null, lunch = null, clean = null, seen = {}, T = function (h, m) { return +h * 60 + +m; };
        (evs[i].info.sections || []).forEach(function (sec) { (sec.items || []).forEach(function (t) {
          var m1 = /(\d)교시\s*·\s*(\d{1,2}):(\d{2})\s*[~∼\-–]\s*(\d{1,2}):(\d{2})/.exec(t), m2 = /^종례\s*·\s*(\d{1,2}):(\d{2})\s*이후/.exec(t),
              m3 = /^점심\s*·\s*(\d{1,2}):(\d{2})(?:\s*[~∼\-–]\s*(\d{1,2}):(\d{2}))?/.exec(t), m4 = /^청소\s*·\s*(\d{1,2}):(\d{2})\s*[~∼\-–]\s*(\d{1,2}):(\d{2})/.exec(t);
          if (m1 && !seen[m1[1]]) { seen[m1[1]] = 1; rows.push({ n: +m1[1], s: T(m1[2], m1[3]), e: T(m1[4], m1[5]) }); }
          if (m2 && jong == null) jong = T(m2[1], m2[2]);
          if (m3 && !lunch) lunch = { s: T(m3[1], m3[2]), e: m3[3] ? T(m3[3], m3[4]) : null };
          if (m4 && !clean) clean = { s: T(m4[1], m4[2]), e: T(m4[3], m4[4]) };
        }); });
        if (rows.length >= 2) { rows.sort(function (a, b) { return a.s - b.s; }); if (lunch && lunch.e == null) lunch.e = clean ? clean.s : jong != null ? jong : lunch.s + 60; return { rows: rows, jong: jong, lunch: lunch, clean: clean, title: evs[i].title }; }
      }
      return null;
    }
    function periods() {
      var W = D.weekly, ds = daySched(); if (ds) return ds.rows.map(function (r) { return { n: r.n, s: r.s, e: r.e, row: W ? W.rows.filter(function (x) { return x.n === r.n; })[0] || null : null, special: true }; });
      if (!W) return []; return W.rows.map(function (w) { var p = w.time.split(':'), st = +p[0] * 60 + +p[1]; return { n: w.n, s: st, e: st + 50, row: w }; });
    }
    function SCe() {   // 청소·종례 시각: 오늘 일정에 '종례 · HH:MM 이후'가 있으면 그 시각부터(청소 15분 → 종례 5분)
      var ds = daySched(); if (!ds || (ds.jong == null && !ds.clean)) return SC;
      var o = {}; Object.keys(SC).forEach(function (k) { o[k] = SC[k]; });
      if (ds.clean) { o.cs = hmStr(ds.clean.s); o.js = hmStr(Math.max(ds.clean.s + 1, ds.clean.e - 5)); o.ee = hmStr(ds.clean.e); }   // 청소 시각이 명시된 날: 청소 끝 5분 전부터 종례
      else { o.cs = hmStr(ds.jong); o.js = hmStr(ds.jong + 15); o.ee = hmStr(ds.jong + 20); }
      return o;
    }
    function curPeriod() {
      var k = kst(), dow = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes(), P = periods();
      if (!P.length || dow < 1 || dow > 5) return { idx: -1, text: dow === 0 || dow === 6 ? '주말' : '' };
      for (var i = 0; i < P.length; i++) if (m >= P[i].s && m < P[i].e) return { idx: i, text: P[i].n + '교시 수업 중' };
      var dsl = daySched(); if (dsl && dsl.lunch && m >= dsl.lunch.s && m < dsl.lunch.e) return { idx: -1, text: '점심시간 · ~' + hmStr(dsl.lunch.e) };
      for (var j = 0; j < P.length; j++) if (m < P[j].s) return { idx: -1, text: j === 0 ? '등교 전' : '쉬는 시간 · 다음 ' + P[j].n + '교시 ' + hmStr(P[j].s) };
      return { idx: -1, text: '수업 끝' };
    }
    function phase() {   // 평일(등교일)의 청소/종례 시간대인지
      var k = kst(), iso = isoOf(k), dow = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes();
      if (dow < 1 || dow > 5) return null;
      if ((D.events || []).some(function (e) { return e.noSchool && e.date <= iso && iso <= (e.end || e.date); })) return null;
      var E = SCe();
      if (m >= mins(E.cs) && m < mins(E.js)) return 'clean';
      if (m >= mins(SC.hs) && m < mins(SC.he)) return 'jo';
      if (m >= mins(E.js) && m < mins(E.ee)) return 'jongrye';
      return null;
    }
    function tick() {
      var k = kst(); clockEl.textContent = pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes());
      dateEl.textContent = (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일 ' + DOW[k.getUTCDay()] + '요일';
      var p = curPeriod(); periodEl.textContent = p.text; periodEl.style.display = p.text ? '' : 'none';
      if (mode === 'today' && p.idx !== lastIdx) { lastIdx = p.idx; paintToday(true); }
      var ph = phase();
      periodEl.classList.remove('ks-cdchip', 'soon', 'live');
      if (p.idx >= 0) periodEl.classList.add('live');
      var nowSec = k.getUTCHours() * 3600 + k.getUTCMinutes() * 60 + k.getUTCSeconds(), toJo = mins(SC.hs) * 60 - nowSec, dw = k.getUTCDay();
      if (dw >= 1 && dw <= 5 && toJo > 0 && nowSec >= 6 * 3600 && !(D.events || []).some(function (e) { var i0 = isoOf(k); return e.noSchool && e.date <= i0 && i0 <= (e.end || e.date); })) {   // 조회 시작 전 카운트다운
        periodEl.textContent = '조회까지 ' + (toJo >= 3600 ? Math.floor(toJo / 3600) + ':' : '') + pad(Math.floor(toJo % 3600 / 60)) + ':' + pad(toJo % 60); periodEl.style.display = ''; periodEl.classList.add('ks-cdchip'); if (toJo <= 60) periodEl.classList.add('soon');
      }
      if (ph) { periodEl.textContent = ph === 'clean' ? '청소 시간' : ph === 'jo' ? '조회 시간' : '종례 시간'; periodEl.style.display = ''; periodEl.classList.add('live'); }
      if (ph !== lastPhase) {   // 시간대가 바뀔 때 자동 전환 (설정에서 끌 수 있음)
        var prev = lastPhase; lastPhase = ph;
        if (SC.auto) {
          if (ph) { jView = ph === 'jo' ? 'jo' : ph === 'jongrye' ? 'jong' : jView; setMode(ph === 'jo' ? 'jongrye' : ph); if (SC.chime) chime(); }
          else if (prev && (mode === 'clean' || mode === 'jongrye')) setMode('today');
        }
      }
      paintSuneung();
      if (barEl) {   // 자습: 지금 교시(일과 시간표) 기준 남은 시간
        var w = studyWin(), nowS = k.getUTCHours() * 3600 + k.getUTCMinutes() * 60 + k.getUTCSeconds();
        if (w) { cdEnd = w.e * 60; barEl.style.width = Math.max(0, Math.min(100, (nowS - w.s * 60) / Math.max(1, (w.e - w.s) * 60) * 100)).toFixed(1) + '%'; if (stLbl) stLbl.textContent = (w.brk ? '다음 수업 ' : (w.n + '교시 ') + '끝 ') + pad(Math.floor(w.e / 60)) + ':' + pad(w.e % 60); if (stRng) stRng.textContent = w.brk ? '쉬는 시간' : pad(Math.floor(w.s / 60)) + ':' + pad(w.s % 60) + ' ~ ' + pad(Math.floor(w.e / 60)) + ':' + pad(w.e % 60); }
        else { cdEnd = 0; barEl.style.width = '0'; if (stLbl) stLbl.textContent = '수업 시간이 아니에요'; if (stRng) stRng.textContent = ''; }
      }
      if (cdEl) { var left = Math.max(0, cdEnd - (k.getUTCHours() * 3600 + k.getUTCMinutes() * 60 + k.getUTCSeconds())); cdEl.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60); }
    }
    var lastIdx = -2;

    // ---------- 안내 요약(조회/종례 끝 때 AI가 정리) 배너 ----------
    var sumBox = null;
    function paintSum() {
      if (!sumBox || !sumBox.isConnected) return; clear(sumBox); var sm = D.jongrye && D.jongrye.summary;
      if ((!sm || !sm.lines || !sm.lines.length) && D.jongrye && D.jongrye.hist && D.jongrye.hist.length) { var le = D.jongrye.hist[D.jongrye.hist.length - 1]; sm = le.summary && { lines: le.summary.lines, at: le.summary.at || le.at, kind: le.kind }; }
      if (!sm || !sm.lines || !sm.lines.length) { sumBox.style.display = 'none'; return; }
      sumBox.style.display = ''; var h1 = el('div', 'ks-sumh'); h1.appendChild(el('b', null, sm.kind === 'jo' ? '오늘 조회 요약' : sm.kind === 'jong' ? '오늘 종례 요약' : '오늘의 안내 요약')); h1.appendChild(el('small', null, hm(sm.at) + ' 정리')); sumBox.appendChild(h1);
      var ul = el('ul', 'ks-suml'); sm.lines.forEach(function (t) { ul.appendChild(el('li', null, t)); }); sumBox.appendChild(ul);
    }

    // ---------- 오늘 대시보드 ----------
    var todayEl = null;
    function card(title, iconName, metaText) {
      var c = el('div', 'ks-card'), h = el('div', 'ks-ch');
      var ce = el('span', 'ks-ce'); ce.appendChild(svgIcon(iconName)); h.appendChild(ce);
      h.appendChild(el('b', null, title));
      if (metaText) h.appendChild(el('span', 'ks-cmeta', metaText));
      c.appendChild(h); return c;
    }
    function paintToday(keep) {
      if (!todayEl) { todayEl = el('div', 'ks-today'); }
      clear(todayEl); todayEl.classList.toggle('ks-noreveal', !!keep); var k = kst(), iso = isoOf(k), dow = k.getUTCDay();
      var noSchool = (D.events || []).filter(function (e) { return e.noSchool && e.date <= iso && iso <= (e.end || e.date); })[0];
      // 알림장
      var daily = (D.daily || {})[iso], items = (daily && daily.items) || [{ k: 'notice', t: '오늘 알림장이 아직 없어요' }];
      var c1 = card('오늘의 알림장', 'notice', daily && daily.items ? items.length + '건' : ''), ul = el('ul', 'ks-list');
      items.forEach(function (i) {
        var km = KIND_META[i.k] || KIND_META.notice, li = el('li', 'ks-ni ks-ni-' + km.cls);
        li.appendChild(el('span', 'ks-tag', km.label)); li.appendChild(el('span', 'ks-t', i.t)); ul.appendChild(li);
      });
      c1.appendChild(ul); todayEl.appendChild(c1);
      // 일과
      var c2 = card('오늘 일과', 'clock', DOW[dow] + '요일'), W = D.weekly, p = curPeriod(); c2.classList.add('ks-b');
      if (noSchool) c2.appendChild(el('div', 'ks-empty', '오늘은 ' + noSchool.title.replace(/\(.*\)/, '') + '이라 수업이 없어요'));
      else if (!W || dow < 1 || dow > 5) c2.appendChild(el('div', 'ks-empty', '주말이에요 · 휴식 시간'));
      else periods().forEach(function (P, i) {
        var cell = P.row && P.row.cells[dow - 1]; if (!cell) return;
        var name = cell.k === 'block' ? cell.b + ' 선택' : cell.t, isNow = i === p.idx, row = el('div', 'ks-tt' + (isNow ? ' now' : '')); row.dataset.s = P.s;
        row.appendChild(el('span', 'ks-tp', P.n + '교시')); row.appendChild(el('span', 'ks-tm', P.special ? hmStr(P.s) + '~' + hmStr(P.e) : hmStr(P.s))); row.appendChild(el('span', 'ks-ts', name));
        if (isNow) row.appendChild(el('span', 'ks-nowtag', '진행 중'));
        c2.appendChild(row);
      });
      var dsx = daySched(); if (dsx && dsx.lunch && !noSchool && dow >= 1 && dow <= 5) { var lr = el('div', 'ks-tt lunch'); lr.appendChild(el('span', 'ks-tp', '점심')); lr.appendChild(el('span', 'ks-tm', hmStr(dsx.lunch.s) + '~' + hmStr(dsx.lunch.e))); lr.appendChild(el('span', 'ks-ts', '중식')); var rowsEl = c2.querySelectorAll('.ks-tt'), put = false; Array.prototype.forEach.call(rowsEl, function (re) { if (!put && +re.dataset.s > dsx.lunch.s) { c2.insertBefore(lr, re); put = true; } }); if (!put) c2.appendChild(lr); }
      if (dsx && dsx.clean && !noSchool && dow >= 1 && dow <= 5) { var cr = el('div', 'ks-tt'); cr.appendChild(el('span', 'ks-tp', '청소')); cr.appendChild(el('span', 'ks-tm', hmStr(dsx.clean.s) + '~' + hmStr(dsx.clean.e))); cr.appendChild(el('span', 'ks-ts', '청소 · 하교')); c2.appendChild(cr); }
      if (dsx && !noSchool && dow >= 1 && dow <= 5) { var tag = el('div', 'ks-ttnote', '특별 일과 · ' + dsx.title.replace(/\(.*?\)/g, '').trim() + (dsx.jong != null ? ' · 종례 ' + hmStr(dsx.jong) + ' 이후' : '')); c2.appendChild(tag); }
      todayEl.appendChild(c2);
      // 급식
      var c3 = card('오늘 급식', 'meal'); c3.classList.add('ks-c'); var meals = (D.today && D.today.date === iso ? D.today.meals : []) || [], hm = k.getUTCHours() * 60 + k.getUTCMinutes();
      var now = hm < 540 ? '조식' : hm < 840 ? '중식' : '석식';
      if (!meals.length) c3.appendChild(el('div', 'ks-empty', '오늘 급식 정보가 없어요'));
      meals.forEach(function (m) {
        var b = el('div', 'ks-meal' + (m.name === now ? ' now' : '')), h = el('div', 'ks-mh');
        h.appendChild(el('b', null, m.name));
        if (m.name === now) h.appendChild(el('span', 'ks-mbadge', '현재'));
        if (m.kcal) h.appendChild(el('small', null, m.kcal + 'kcal'));
        b.appendChild(h); b.appendChild(el('div', 'ks-md', m.dishes.join(' · '))); c3.appendChild(b);
      });
      todayEl.appendChild(c3);
      // 다가오는 일정
      var c4 = card('다가오는 일정', 'calendar'); c4.classList.add('ks-d'); var up = (D.events || []).filter(function (e) { return !e.calOnly && Math.round((toUTC(e.end || e.date) - toUTC(iso)) / 86400000) >= 0; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 6);
      if (!up.length) c4.appendChild(el('div', 'ks-empty', '예정된 일정이 없어요'));
      up.forEach(function (e) { var d = Math.round((toUTC(e.date) - toUTC(iso)) / 86400000), r = el('div', 'ks-ev'); r.appendChild(el('span', 'ks-evt', e.title)); var badge = el('span', 'ks-dd' + (d <= 1 ? ' hot' : ''), d < 0 ? '진행 중' : d === 0 ? 'D-DAY' : 'D-' + d); r.appendChild(badge); c4.appendChild(r); });
      todayEl.appendChild(c4);
      // 청소
      var C = D.clean; if (C && C.zones && !noSchool && dow >= 1 && dow <= 5 && (!C.until || iso <= C.until) && (!C.from || iso >= C.from)) {
        var c5 = card('청소 당번', 'broom'); c5.classList.add('ks-e');
        C.zones.forEach(function (z) { (z.rows || []).forEach(function (r) { var row = el('div', 'ks-cl'); row.appendChild(el('span', 'ks-clp', (z.zone + ' ' + (r.task || '')).replace(/\(\d+\)/g, '').trim())); row.appendChild(el('span', 'ks-clw', r.who.join(', '))); c5.appendChild(row); }); });
        todayEl.appendChild(c5);
      }
      if (!keep) { main.scrollTop = 0; }
    }

    // ---------- 청소 시간 ----------
    function cleanZones() {
      var C = D.clean, iso = isoOf(kst()); if (!C || !C.zones || (C.until && iso > C.until) || (C.from && iso < C.from)) return null;
      return C.zones;
    }
    function banner(cls, iconName, title, sub, endHM, endLabel) {
      var b = el('div', 'ks-ban ' + cls), l = el('div', 'ks-banl'), ic = el('span', 'ks-bane');
      ic.appendChild(svgIcon(iconName)); l.appendChild(ic);
      var t = el('div'); t.appendChild(el('div', 'ks-bant', title)); if (sub) t.appendChild(el('div', 'ks-bans', sub)); l.appendChild(t); b.appendChild(l);
      cdEl = el('b', 'ks-cd'); cdEnd = mins(endHM) * 60; var r = el('div', 'ks-banr'); r.appendChild(el('small', null, endLabel)); r.appendChild(cdEl); b.appendChild(r); return b;
    }
    // 청소 체크: 이름을 누르면 ✓ (오늘 날짜로 서버에 저장 → 선생님·관리자가 앱에서 기록 확인)
    var CL = D.cleanlog || {}, chips = [], sumEl = null, cleanSeq = 0, cleanBusy = 0, cleanChain = Promise.resolve();
    function api(method, body) {
      return fetch('/api/clean', { method: method, headers: { authorization: 'Bearer ' + tok(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
    function chk(name) {
      var b = el('button', 'ks-who'); b.type = 'button'; b.dataset.name = name; chips.push(b); paintChip(b);
      b.addEventListener('click', function () {
        var now = Date.now();
        if (now - (b._tap || 0) < 350) return;   // 전자칠판 터치 바운스(이중 클릭) 방지
        b._tap = now;
        var done = !CL[name], seq = ++cleanSeq;
        if (done) CL[name] = now; else delete CL[name];
        chips.forEach(function (c) { if (c.dataset.name === name) paintChip(c); });
        paintSummary();
        cleanBusy++;
        cleanChain = cleanChain.then(function () { return api('POST', { name: name, done: done }); }).then(function (j) {
          cleanBusy--;
          if (seq === cleanSeq && j && j.log) { CL = j.log; paintChips(); }
        }).catch(function () {
          cleanBusy--;
          if (seq === cleanSeq) {
            if (done) delete CL[name]; else CL[name] = 1;
            chips.forEach(function (c) { if (c.dataset.name === name) paintChip(c); });
            paintSummary();
          }
        });
      }); return b;
    }
    function paintChip(b) {
      var n = b.dataset.name, on = !!CL[n];
      if (b._on === on && b.firstChild) return;
      b._on = on;
      b.classList.toggle('done', on);
      if (!b.firstChild) { b.appendChild(el('span', 'ks-ck', on ? '✓' : '')); b.appendChild(document.createTextNode(n)); }
      else { b.firstChild.textContent = on ? '✓' : ''; }
    }
    var zoneCards = [];
    function paintSummary() {
      var all = {}; chips.forEach(function (b) { all[b.dataset.name] = 1; });
      var tot = Object.keys(all).length, dn = Object.keys(all).filter(function (n) { return CL[n]; }).length;
      if (sumEl) {
        var pct = tot ? Math.round((dn / tot) * 100) : 0;
        sumEl.firstChild.textContent = '청소 완료 ' + dn + ' / ' + tot + '명 (' + pct + '%)';
        if (sumEl._bar) sumEl._bar.style.width = pct + '%';
        sumEl.classList.toggle('all', tot > 0 && dn === tot);
      }
      zoneCards.forEach(function (z) {
        var done = z.btns.length > 0 && z.btns.every(function (b) { return !!CL[b.dataset.name]; });
        z.el.classList.toggle('zdone', done);
      });
    }
    function paintChips() {
      chips.forEach(paintChip);
      paintSummary();
    }
    function pullLog() {
      if (cleanBusy > 0) return;
      var seq = cleanSeq;
      api('GET').then(function (j) {
        if (cleanBusy === 0 && seq === cleanSeq && j && j.logs) { CL = j.logs[j.today] || {}; paintChips(); }
      }).catch(function () {});
    }
    function paintClean() {
      chips = []; zoneCards = []; var box = el('div', 'ks-cleanbox'), zs = cleanZones();
      box.appendChild(banner('clean', 'clean', '차분하게 청소 시간', SCe().cs + ' ~ ' + SCe().js + ' · 맡은 구역을 조용히 정리해요', SCe().js, '종례까지'));
      sumEl = el('div', 'ks-sumbar');
      var sumTxt = el('div', 'ks-sumtxt', '청소 완료 0 / 0명 (0%)');
      var prog = el('div', 'ks-cprog'), fill = el('div', 'ks-cprog-fill'); prog.appendChild(fill);
      sumEl.appendChild(sumTxt); sumEl.appendChild(prog); sumEl._bar = fill;
      var grid = el('div', 'ks-zones');
      if (!zs) grid.appendChild(el('div', 'ks-empty big', '이번 달 청소배정표가 없어요 · 학급 구역을 함께 정리해요'));
      else zs.forEach(function (z) {
        var c = el('div', 'ks-zone'), zBtns = [];
        var hdr = el('div', 'ks-zhdr');
        hdr.appendChild(el('div', 'ks-zn', z.zone.replace(/\(\d+\)/g, '').trim()));
        hdr.appendChild(el('span', 'ks-zbadge', '✓ 완료'));
        c.appendChild(hdr);
        if (z.note) c.appendChild(el('div', 'ks-zt', z.note));
        (z.rows || []).forEach(function (r) {
          var row = el('div', 'ks-zr');
          if (r.task) row.appendChild(el('span', 'ks-ztask', r.task.replace(/\(\d+\)/g, '')));
          var zw = el('span', 'ks-zw');
          r.who.forEach(function (nm) { var btn = chk(nm); zBtns.push(btn); zw.appendChild(btn); });
          row.appendChild(zw); c.appendChild(row);
          if (r.handover) c.appendChild(el('div', 'ks-zh', '인수인계 ' + r.handover));
        });
        zoneCards.push({ el: c, btns: zBtns });
        grid.appendChild(c);
      });
      box.appendChild(sumEl); box.appendChild(grid); main.appendChild(box); paintChips(); pullLog();
      var iv = setInterval(pullLog, 15000); cleanups.push(function () { clearInterval(iv); sumEl = null; chips = []; zoneCards = []; });
    }
    function tomorrowItems() {   // 종례 때 알려 줄 내일 일정
      var tm = new Date(kst().getTime() + 86400000), iso = isoOf(tm), out = [];
      (D.events || []).forEach(function (e) { if (e.calOnly) return; var s = e.date, en = e.end || e.date; if (s === iso) out.push('내일 ' + e.title + (e.note ? ' · ' + e.note.split(' · ')[0] : '')); else if (en === iso && en > s) out.push('내일 마감 · ' + e.title); });
      return out.slice(0, 6);
    }
    // ---------- 종례 ----------
    var JR = D.jongrye || null, jrBox = null, histBox = null, jView = null;   // jView: 'jo'(조회) | 'jong'(종례), 비어 있으면 오전=조회 오후=종례
    // 안내사항에 받아쓰기 통합: 🎙를 켜면 말씀이 글자로 안내사항 끝에 줄 단위로 쌓이고 바로 저장·학생 반영 (소리는 저장 안 함)
    var dictOn = false, dictRec = null, dictInterim = '', dictMsg = '', dictFail = 0, dictAt = 0, jrPending = 0, jrQ = Promise.resolve(), jrLive = null;
    function jrSave(text) {
      jrPending++;
      jrQ = jrQ.then(function () { return fetch('/api/jongrye', { method: 'POST', headers: { authorization: 'Bearer ' + tok(), 'content-type': 'application/json' }, body: JSON.stringify({ text: text }) }).then(function (r) { return r.json(); }); })
        .then(function (j) { jrPending--; if (j && j.ok && jrPending === 0 && !dictOn) { JR = j.rec || null; D.jongrye = JR; paintJrNote(); } }).catch(function () { jrPending--; });
    }
    function jrSet(text) { JR = text ? { text: text, by: '받아쓰기', at: Date.now() } : null; D.jongrye = JR; paintJrNote(); jrSave(text); }
    // 받아쓰기는 문장을 한 문단으로 쭉 이어 붙임(줄바꿈 없음). 기존 안내사항(dictBase) 뒤에 새 문단으로 시작
    var dictBase = '', dictSent = [];
    function dictText() { return dictBase + (dictSent.length ? (dictBase ? '\n' : '') + dictSent.join(' ') : ''); }
    function dictAppend(line) {
      // 일부 기기(안드로이드 크롬)는 확정 결과를 '앞 문장+새 단어'로 계속 다시 보내므로: 직전 문장의 연장이면 교체, 같거나 더 짧으면 무시
      var n = function (x) { return x.replace(/\s+/g, ''); }, last = dictSent[dictSent.length - 1];
      if (last) {
        if (n(line) === n(last) || n(last).indexOf(n(line)) === 0) return;
        if (n(line).indexOf(n(last)) === 0) dictSent[dictSent.length - 1] = line; else dictSent.push(line);
      } else dictSent.push(line);
      var t = dictText();
      while (t.length > 800) { if (dictBase) { var i = dictBase.indexOf('\n'); dictBase = i > -1 ? dictBase.slice(i + 1) : ''; } else if (dictSent.length > 1) dictSent.shift(); else break; t = dictText(); }
      jrSet(t.slice(-800));
    }
    function fitNote(t) {   // 한 화면에: 줄이 많으면 옆 칸으로 이어 붙이고, 그래도 넘치면 글자를 줄임
      t.classList.remove('cols'); t.style.height = ''; t.style.fontSize = '';
      var lim = window.innerHeight * 0.34; if (t.scrollHeight <= lim) return;
      t.classList.add('cols'); t.style.height = lim + 'px';
      var fs = 1.65; for (var i = 0; i < 14 && t.scrollWidth > t.clientWidth + 2 && fs > 0.8; i++) { fs -= 0.1; t.style.fontSize = fs + 'em'; }
    }
    var dictBadge = null;
    function paintBadge() {
      if (dictBadge) { dictBadge.remove(); dictBadge = null; }
      if (!dictOn || mode === 'jongrye') return;   // 안내사항 화면에서는 카드에 표시되므로 다른 화면에서만 작은 표시
      dictBadge = el('button', 'ks-recbadge', '🔴 받아쓰기 중 · 누르면 끝내기'); dictBadge.type = 'button'; dictBadge.addEventListener('click', function () { dictStop(); }); root.appendChild(dictBadge);
    }
    function dictStop(msg) {
      dictOn = false; dictInterim = ''; dictMsg = msg || ''; aiStopAll(); if (dictRec) { try { dictRec.onend = null; dictRec.stop(); } catch (e) {} dictRec = null; } paintJrNote(); paintBadge();
    }
    // ---- 고정밀 받아쓰기(AI): 마이크 소리를 5~12초 조각으로 잘라 서버(Whisper)에 보내 글자로 받음. 무음 조각은 보내지 않음 ----
    var aiQBusy = 0, aiStream = null, aiRec = null, aiCtx = null, aiQ = Promise.resolve(), aiTimer = 0, aiSeg = null;
    function engine() { return load('ks_stt') === 'chrome' ? 'chrome' : 'ai'; }
    function aiStopAll() { clearInterval(aiTimer); aiTimer = 0; try { if (aiRec && aiRec.state !== 'inactive') { aiSeg = null; aiRec.stop(); } } catch (e) {} aiRec = null; if (aiStream) { aiStream.getTracks().forEach(function (t) { t.stop(); }); aiStream = null; } if (aiCtx) { try { aiCtx.close(); } catch (e) {} aiCtx = null; } }
    function aiUpload(blob) {
      aiQ = aiQ.then(function () {
        if (!dictOn) return; aiQBusy++; dictInterim = '🎧 인식 중 …'; if (jrLive && jrLive.isConnected) jrLive.textContent = dictInterim;
        return fetch('/api/stt', { method: 'POST', headers: { authorization: 'Bearer ' + tok(), 'content-type': blob.type || 'audio/webm' }, body: blob }).then(function (r) { return r.json().then(function (j) { j._st = r.status; return j; }); })
          .then(function (j) { aiQBusy = Math.max(0, aiQBusy - 1); dictInterim = ''; if (jrLive && jrLive.isConnected) jrLive.textContent = ''; if (j && j.ok) { dictMsg = ''; if (j.text) return aiReveal(j.text); } else if (j && (j.error === 'no_ai' || j.error === 'ai_fail')) { dictMsg = 'AI 받아쓰기를 쓸 수 없어요 → 기본(크롬) 방식으로 바꿔요'; store('ks_stt', 'chrome'); stopAiStartChrome(); } })
          .catch(function () { aiQBusy = Math.max(0, aiQBusy - 1); dictInterim = ''; dictMsg = '연결이 불안정해요 · 자동으로 다시 시도 중'; paintJrNote(); });
      });
    }
    function aiReveal(text) {   // 받아온 문장을 한 번에 툭 넣지 않고 단어 단위로 빠르게 타이핑하듯 보여 줌(체감 속도↑). 저장은 다 나온 뒤 한 번만
      return new Promise(function (res) {
        var n = function (x) { return x.replace(/\s+/g, ''); }, last = dictSent[dictSent.length - 1];
        if (last && (n(text) === n(last) || n(last).indexOf(n(text)) === 0)) return res();
        var words = text.split(' '), i = 0, idx, replace = last && n(text).indexOf(n(last)) === 0;
        if (replace) idx = dictSent.length - 1; else { dictSent.push(''); idx = dictSent.length - 1; }
        var iv = setInterval(function () {
          i += Math.max(1, Math.ceil(words.length / 12));
          if (i >= words.length || !dictOn) { clearInterval(iv); dictSent[idx] = text; var t = dictText(); while (t.length > 800 && dictSent.length > 1) { dictSent.shift(); idx--; t = dictText(); } jrSet(t.slice(-800)); res(); }
          else { dictSent[idx] = words.slice(0, i).join(' '); JR = { text: dictText(), by: '받아쓰기', at: Date.now() }; D.jongrye = JR; paintJrNote(); }
        }, 55);
      });
    }
    function stopAiStartChrome() { aiStopAll(); if (dictOn) dictRun(); paintJrNote(); }
    function aiRun() {
      if (!navigator.mediaDevices || !window.MediaRecorder) { store('ks_stt', 'chrome'); dictMsg = '이 브라우저는 AI 받아쓰기를 지원하지 않아 기본 방식으로 바꿨어요'; dictRun(); return; }
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
        if (!dictOn) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        aiStream = stream; var C = window.AudioContext || window.webkitAudioContext; aiCtx = new C(); var an = aiCtx.createAnalyser(); an.fftSize = 1024; aiCtx.createMediaStreamSource(stream).connect(an); var data = new Uint8Array(an.fftSize);
        var mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0] || '';
        function startSeg() {
          var chunks = [], rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), seg = { t0: Date.now(), loud: 0, quietSince: 0, rec: rec }; aiSeg = seg; aiRec = rec;
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = function () { var loud = seg.loud; if (dictOn && aiStream) startSeg(); if (loud > 0.012 * 6 && chunks.length) aiUpload(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); };   // 말소리가 있었던 조각만 전송
          rec.start();
        }
        aiTimer = setInterval(function () {   // 소리 크기 감시: 5초 이상 쌓였고 0.7초 이상 조용하면 그 자리에서 자름(말 중간을 덜 자르려고), 12초 넘으면 무조건 자름
          if (!aiSeg) return; an.getByteTimeDomainData(data); var sum = 0; for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; } var rms = Math.sqrt(sum / data.length), now = Date.now();
          if (rms > 0.012) { aiSeg.loud += rms; aiSeg.quietSince = 0; } else if (!aiSeg.quietSince) aiSeg.quietSince = now;
          var age = now - aiSeg.t0;
          dictInterim = aiSeg.loud > 0.012 * 3 ? '🎙 듣는 중 ●●●' : ''; if (jrLive && jrLive.isConnected && dictInterim.indexOf('🎙') === 0) jrLive.textContent = dictInterim; else if (jrLive && jrLive.isConnected && aiQBusy === 0) jrLive.textContent = '';
          if ((age > 2200 && aiSeg.loud > 0.012 * 4 && aiSeg.quietSince && now - aiSeg.quietSince > 450) || age > 7000 || (age > 4000 && !aiSeg.loud)) { var r = aiSeg.rec; aiSeg = null; try { r.stop(); } catch (e) {} }
        }, 100);
        startSeg();
      }).catch(function () { dictStop('마이크 사용을 허용해 주세요 (주소창 왼쪽 자물쇠)'); });
    }
    function dictRun() {
      if (engine() === 'ai') { aiRun(); return; }
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition, r = new SR(); dictRec = r; r.lang = 'ko-KR'; r.continuous = true; r.interimResults = true; dictAt = Date.now();
      r.onresult = function (e) { var interim = ''; for (var i = e.resultIndex; i < e.results.length; i++) { var t = e.results[i][0].transcript; if (e.results[i].isFinal) { if (t.trim()) dictAppend(t.trim()); } else interim += t; } dictInterim = interim; paintJrNote(); };   // 말하는 대로 흐린 글자가 바로 문단 끝에 이어 보이고, 확정되면 진해짐
      r.onspeechstart = function () { if (jrLive && jrLive.isConnected && !dictInterim) jrLive.textContent = '🎙 듣는 중 ●●●'; };
      r.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') dictStop('마이크 사용을 허용해 주세요 (주소창 왼쪽 자물쇠)'); else if (e.error === 'network' || e.error === 'audio-capture') { dictMsg = '연결이 불안정해요 (' + (e.error === 'network' ? '인터넷' : '마이크') + ') · 자동으로 다시 시도 중'; paintJrNote(); } };
      r.onend = function () {   // 크롬은 말이 없으면 끊김 → 다시 이어 듣되, 금방 계속 끊기면(소리 나는 기기에서 반복음 방지) 멈춤
        if (!dictOn) return; var ran = Date.now() - dictAt; dictFail = ran < 4000 ? Math.min(dictFail + 1, 6) : 0;   // 끄기 전까지는 계속 이어 듣되, 자꾸 끊기면 간격을 늘려 반복음을 줄임
        setTimeout(function () { if (dictOn) { try { dictRun(); } catch (e2) { dictFail = 6; setTimeout(function () { if (dictOn) { try { dictRun(); } catch (e3) {} } }, 5000); } } }, ran < 4000 ? Math.min(1200 + dictFail * 1200, 8000) : 300);
      };
      try { r.start(); } catch (e) { dictStop('받아쓰기를 시작하지 못했어요'); }
    }
    function dictToggle() {
      if (dictOn) { dictStop(); return; }
      if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) { dictMsg = '이 브라우저는 받아쓰기를 지원하지 않아요 (크롬을 써 주세요)'; paintJrNote(); return; }
      dictOn = true; dictFail = 0; dictMsg = ''; dictBase = (JR && JR.text) || ''; dictSent = []; dictRun(); paintJrNote(); paintBadge();
    }
    function paintHist() {   // 이미 끝낸 조회/종례의 요약본(접을 수 있는 카드)
      if (!histBox) return; clear(histBox);
      var KL = { jo: '오늘 조회 요약', jong: '오늘 종례 요약' };
      ((JR && JR.hist) || []).forEach(function (e, i, arr) {
        var d = el('details', 'ks-hcard'); if (i === arr.length - 1) d.open = true;
        var sm = el('summary'); sm.appendChild(el('b', null, KL[e.kind] || '안내 요약')); if (e.at) sm.appendChild(el('small', null, ' · ' + hm(e.at) + ' 정리')); d.appendChild(sm);
        var ul = el('ul', 'ks-suml'); ((e.summary && e.summary.lines) || []).forEach(function (t) { ul.appendChild(el('li', null, t)); }); d.appendChild(ul);
        var rawBtn = el('button', 'ks-chip', '원문 보기'), raw = el('div', 'ks-hraw', e.text || ''); raw.hidden = true; rawBtn.type = 'button'; rawBtn.addEventListener('click', function () { raw.hidden = !raw.hidden; rawBtn.textContent = raw.hidden ? '원문 보기' : '원문 접기'; });
        d.appendChild(rawBtn); d.appendChild(raw); histBox.appendChild(d);
      });
    }
    function paintJrNote(flash) {
      paintHist();
      if (!jrBox) return; clear(jrBox); jrLive = null; jrBox.classList.toggle('rec', dictOn);
      var hdr = el('div', 'ks-jnote-h');
      var ttl = el('span', 'ks-jtitle'); ttl.appendChild(svgIcon('announce')); ttl.appendChild(document.createTextNode('오늘의 안내사항')); hdr.appendChild(ttl);
      if (JR && JR.text) { var meta = (JR.by ? JR.by + ' · ' : '') + (JR.at ? hm(JR.at) : ''); if (meta) hdr.appendChild(el('small', 'ks-jnote-m', meta)); }
      var tools = el('span', 'ks-jtools');
      var mic = el('button', 'ks-chip' + (dictOn ? ' on rec' : ''), dictOn ? '듣는 중 · 끝내기' : '받아쓰기'); mic.type = 'button'; mic.addEventListener('click', dictToggle); tools.appendChild(mic);
      var eng = el('button', 'ks-chip', engine() === 'ai' ? 'AI 인식' : '기본 인식'); eng.type = 'button'; eng.title = '받아쓰기 방식 바꾸기'; eng.addEventListener('click', function () { store('ks_stt', engine() === 'ai' ? 'chrome' : 'ai'); var was = dictOn; if (was) { dictStop(); dictToggle(); } else paintJrNote(); }); tools.appendChild(eng);
      if (JR && JR.text) { var un = el('button', 'ks-chip', '마지막 줄 지우기'); un.type = 'button'; un.addEventListener('click', function () { if (dictSent.length) { dictSent.pop(); jrSet(dictText()); return; } var L = JR.text.split('\n'); L.pop(); dictBase = L.join('\n'); jrSet(dictBase); }); tools.appendChild(un);
        var all = el('button', 'ks-chip', '전체 지우기'), armed = null; all.type = 'button';
        all.addEventListener('click', function () { if (!armed) { all.textContent = '한 번 더 누르면 삭제'; all.classList.add('rec'); armed = setTimeout(function () { armed = null; all.textContent = '전체 지우기'; all.classList.remove('rec'); }, 3000); return; } clearTimeout(armed); armed = null; dictBase = ''; dictSent = []; jrSet(''); });   // 실수 방지: 3초 안에 한 번 더 누르면 삭제
        tools.appendChild(all); }
      hdr.appendChild(tools); jrBox.appendChild(hdr);
      if (dictMsg) jrBox.appendChild(el('div', 'ks-jnote-e', dictMsg));
      var liveTxt = dictOn && dictInterim && engine() === 'chrome' ? dictInterim : '';   // 기본(크롬) 인식: 말하는 중인 글자를 바로 이어서 보여 줌
      if ((JR && JR.text) || liveTxt) {
        var nt = el('div', 'ks-jnote-t'), lines = ((JR && JR.text) || '').split('\n').filter(function (x) { return x.trim(); }), lastEl = null;
        lines.forEach(function (ln) { lastEl = el('div', 'ks-jline', ln); nt.appendChild(lastEl); });
        if (liveTxt) { var host = (dictSent.length && lastEl) ? lastEl : nt.appendChild(el('div', 'ks-jline')); host.appendChild(el('span', 'ks-jinterim', (host.textContent ? ' ' : '') + liveTxt)); }
        jrBox.appendChild(nt); jrBox.classList.remove('empty'); if (jrBox.isConnected) fitNote(nt);
      }
      else if (!liveTxt) { jrBox.appendChild(el('div', 'ks-jnote-e', '받아쓰기를 켜고 말씀하시거나, 관리자 화면에서 입력하면 여기에 표시돼요')); jrBox.classList.add('empty'); }
      if (dictOn) { jrLive = el('div', 'ks-jlive', engine() === 'ai' ? dictInterim : ''); jrBox.appendChild(jrLive); }
      if (flash) { jrBox.classList.remove('flash'); void jrBox.offsetWidth; jrBox.classList.add('flash'); }
    }
    function pullJongrye() {
      fetch('/api/jongrye?days=1', { headers: { authorization: 'Bearer ' + tok() }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.logs) { JR = j.logs[j.today] || null; D.jongrye = JR; paintJrNote(); } })
        .catch(function () {});
    }
    // 2028학년도 수능(2027-11-18 목) 입실 완료 08:10(KST)까지 남은 초 — 헤더의 'n교시 수업 중' 왼쪽에 표시. 평가원 시행계획 확정 시 바뀔 수 있음
    var SUNEUNG_AT = Date.UTC(2027, 10, 18, 8, 10, 0) - 9 * 3600e3;
    function nextExam() {   // 다가오는 시험(기말고사·중간고사)의 첫 시험 시작 시각까지
      var now = Date.now(), best = null;
      function consider(date, time, label) { var p = String(time).split(':'); var ms = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +p[0], +p[1] || 0) - 9 * 3600e3; if (ms > now && (!best || ms < best.ms)) best = { ms: ms, date: date, label: label }; }
      if (D.exam && D.exam.days && D.exam.days.length) consider(D.exam.days[0].date, ((D.exam.periods && D.exam.periods[0] && D.exam.periods[0].time) || '08:50').split('~')[0], '기말고사');
      (D.events || []).forEach(function (e) { if (e.date && /중간고사|기말고사/.test(e.title)) consider(e.date, '08:50', /중간/.test(e.title) ? '중간고사' : '기말고사'); });
      return best;
    }
    function paintExam() {
      var x = nextExam(); clear(examEl);
      if (!x) { examEl.style.display = 'none'; return; }
      var left = Math.max(0, Math.floor((x.ms - Date.now()) / 1000)), dd = Math.round((Date.UTC(+x.date.slice(0, 4), +x.date.slice(5, 7) - 1, +x.date.slice(8, 10)) - Date.UTC(kst().getUTCFullYear(), kst().getUTCMonth(), kst().getUTCDate())) / 864e5);
      examEl.style.display = '';
      examEl.appendChild(el('span', 'ks-cdlbl', x.label + ' ' + (dd <= 0 ? 'D-DAY' : 'D-' + dd)));
      examEl.appendChild(el('b', 'ks-cdval', left.toLocaleString('ko-KR') + '초'));
    }
    function paintSuneung() {
      paintExam();
      var left = Math.max(0, Math.floor((SUNEUNG_AT - Date.now()) / 1000));
      clear(suEl);
      suEl.appendChild(el('span', 'ks-cdlbl', '수능'));
      suEl.appendChild(el('b', 'ks-cdval', left.toLocaleString('ko-KR') + '초'));
    }
    function paintJongrye() {
      var box = el('div', 'ks-jbox'), jv = jView || (JR && JR.hist && JR.hist.length ? 'jong' : (kst().getUTCHours() < 12 ? 'jo' : 'jong')), jo = jv === 'jo';   // 조회를 끝냈으면 다시 열 때 종례 화면
      var tg = el('div', 'ks-jtog'); [['jo', '조회'], ['jong', '종례']].forEach(function (x) { var b = el('button', 'ks-chip' + (jv === x[0] ? ' on' : ''), x[1]); b.type = 'button'; b.addEventListener('click', function () { if (jv !== x[0]) { jView = x[0]; setMode('jongrye'); } }); tg.appendChild(b); });
      var fin = el('button', 'ks-chip ks-endbtn', jo ? '조회 끝' : '종례 끝'); fin.type = 'button'; fin.addEventListener('click', function () {
        if (fin.disabled) return; fin.disabled = true; fin.textContent = '저장·요약 중…'; var kind = jo ? 'jo' : 'jong'; dictStop();
        var done = false; function go() { if (done) return; done = true; jView = null; setMode('today'); }
        setTimeout(go, 15000);   // 요약이 늦어져도 화면은 넘어감 (원문은 이미 저장됨)
        jrQ.then(function () { return (JR && JR.text) ? fetch('/api/jongrye', { method: 'POST', headers: { authorization: 'Bearer ' + tok(), 'content-type': 'application/json' }, body: JSON.stringify({ summarize: true, kind: kind }) }).then(function (r) { return r.json(); }) : null; })
          .then(function (j) { if (j && j.rec) { JR = j.rec; D.jongrye = JR; } }).catch(function () {}).then(go);
      }); tg.appendChild(fin); box.appendChild(tg);   // 일찍 끝나면 눌러서 오늘 화면으로
      if (jo) box.appendChild(banner('jong', 'announce', '조회 시간', SC.hs + ' ~ ' + SC.he, SC.he, '조회 끝까지'));
      else box.appendChild(banner('jong', 'announce', '종례 시간', SCe().js + ' ~ ' + SCe().ee, SCe().ee, '종례 끝까지'));
      histBox = el('div', 'ks-jhist'); box.appendChild(histBox);
      jrBox = el('div', 'ks-jnote'); box.appendChild(jrBox); paintJrNote(); cleanups.push(function () { jrBox = null; histBox = null; });
   // 받아쓰기는 다른 화면으로 가도 계속 듣고, 끄기 버튼을 눌러야 멈춤
      var cols = el('div', 'ks-jcols'), iso = isoOf(kst()), daily = (D.daily || {})[iso];
      var c1 = card('오늘의 알림장', 'notice'), ul = el('ul', 'ks-list');
      ((daily && daily.items) || [{ k: 'notice', t: '오늘 알림장이 없어요' }]).slice(0, 5).forEach(function (i) {
        var km = KIND_META[i.k] || KIND_META.notice, li = el('li', 'ks-ni ks-ni-' + km.cls);
        li.appendChild(el('span', 'ks-tag', km.label)); li.appendChild(el('span', 'ks-t', i.t)); ul.appendChild(li);
      }); c1.appendChild(ul);
      var c2, ul2 = el('ul', 'ks-list');
      if (jo) {   // 조회: 오늘 일과(시간표)
        c2 = card('오늘 일과', 'clock'); var W = D.weekly, dow = kst().getUTCDay(), line = [];
        if (W && dow >= 1 && dow <= 5) periods().forEach(function (P) { var cell = P.row && P.row.cells[dow - 1]; if (cell) line.push(P.n + '교시 ' + (cell.k === 'block' ? cell.b + ' 선택' : cell.t) + (P.special ? ' (' + hmStr(P.s) + '~' + hmStr(P.e) + ')' : '')); });
        (line.length ? line : ['오늘은 수업이 없어요']).forEach(function (t) { var li = el('li'); li.appendChild(el('span', 'ks-t', t)); ul2.appendChild(li); }); c2.appendChild(ul2);
      } else {
        c2 = card('내일 챙길 것', 'calendar'); var tm = tomorrowItems(); (tm.length ? tm : ['내일 특별한 일정은 없어요']).forEach(function (t) { var li = el('li'); li.appendChild(el('span', 'ks-t', t)); ul2.appendChild(li); }); c2.appendChild(ul2);
      }
      cols.appendChild(c1); cols.appendChild(c2); box.appendChild(cols); main.appendChild(box);
      pullJongrye();
    }

    // ---------- 자습 중 교실 이탈 ----------
    var OUT = [], outBox = null, REASONS = ['📖 밖에서 공부', '기타'];
    function outApi(body) { return fetch('/api/out', { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + tok(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }).then(function (r) { return r.json(); }); }
    function hm(ts) { var d = new Date(ts + 9 * 3600e3); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
    function pullOut() { outApi().then(function (j) { if (j && j.logs) { OUT = j.logs[j.today] || []; paintOut(); } }).catch(function () {}); }
    function paintOut() {
      paintSeatMap();
      if (!outBox) return; clear(outBox);
      var now = OUT.filter(function (e) { return !e.back; }), back = OUT.filter(function (e) { return e.back; });
      var h1 = el('div', 'ks-oh'), tt = el('div', 'ks-ott'); tt.appendChild(el('b', null, '교실 이탈')); tt.appendChild(el('span', 'ks-ocnt' + (now.length ? ' on' : ''), now.length + '명')); h1.appendChild(tt);
      var tl = el('div', 'ks-otl'), add = el('button', 'ks-chip on', '＋ 등록'); add.type = 'button'; add.addEventListener('click', function () { openOut(); }); tl.appendChild(add);
      if (now.length > 1) { var all = el('button', 'ks-chip', '모두 돌아옴'); all.type = 'button'; all.addEventListener('click', function () { OUT.forEach(function (e) { if (!e.back) e.back = Date.now(); }); paintOut(); outApi({ op: 'backall' }).then(function (j) { if (j && j.list) { OUT = j.list; paintOut(); } }); }); tl.appendChild(all); }
      h1.appendChild(tl); outBox.appendChild(h1);
      if (!now.length) outBox.appendChild(el('div', 'ks-onone', '지금 자리를 비운 사람이 없어요'));
      // 사유별로 묶어 이름 칩으로 (많아져도 한눈에). 칩을 누르면 돌아옴
      var groups = {}; now.forEach(function (e) { var k = e.reason.split(' · ')[0]; (groups[k] = groups[k] || []).push(e); });
      Object.keys(groups).forEach(function (k) {
        var g = el('div', 'ks-og'), gh = el('div', 'ks-ogh', k + ' · ' + groups[k].length + '명'); g.appendChild(gh); var chips = el('div', 'ks-ochips');
        groups[k].sort(function (a, b) { return a.out - b.out; }).forEach(function (e) {
          var min = Math.max(0, Math.round((Date.now() - e.out) / 60000)), c = el('button', 'ks-ochip' + (min >= 15 ? ' long' : '')); c.type = 'button'; c.title = e.reason + ' · ' + hm(e.out) + '부터';
          c.appendChild(el('b', null, e.name)); c.appendChild(el('small', null, min + '분')); if (e.reason.indexOf(' · ') > -1) c.appendChild(el('i', null, e.reason.split(' · ').slice(1).join(' · ')));
          c.addEventListener('click', function () { e.back = Date.now(); paintOut(); outApi({ op: 'back', id: e.id }).then(function (j) { if (j && j.list) { OUT = j.list; paintOut(); } }); });
          chips.appendChild(c);
        });
        g.appendChild(chips); outBox.appendChild(g);
      });
      if (now.length) outBox.appendChild(el('small', 'ks-oback', '이름을 누르면 "돌아옴"'));
      if (back.length) outBox.appendChild(el('small', 'ks-oback', '오늘 다녀온 ' + back.length + '건'));
    }
    function openOut(pre) {   // pre: 자리표에서 누른 이름(문자열)이면 미리 선택. 여러 명을 골라 한 번에 등록
      var ov = el('div', 'ks-modal'), card = el('div', 'ks-mcard wide'), picked = {}, reason = '';
      card.appendChild(el('h2', null, '🚪 교실 이탈 등록'));
      var grid = el('div', 'ks-ngrid'), rs = el('div', 'ks-row left'), txt = el('input', 'ks-in'), ok = el('button', 'ks-btn big', '등록'), msg = el('div', 'ks-note', '이름을 여러 명 눌러 고르고, 사유(밖에서 공부 / 기타)를 골라 주세요');
      txt.type = 'text'; txt.placeholder = '자세한 내용 (선택, 예: 화장실)'; txt.style.width = '16em'; txt.maxLength = 30;
      function cnt() { var n = Object.keys(picked).length; ok.textContent = n ? n + '명 등록' : '등록'; }
      var away = {}; OUT.forEach(function (e) { if (!e.back) away[e.name] = 1; });
      getNames(function (all) { all.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (st) {
        var b = el('button', 'ks-nbtn' + (away[st.name] ? ' away' : ''), st.name); b.type = 'button'; b.disabled = !!away[st.name];
        if (typeof pre === 'string' && pre === st.name) { picked[st.name] = 1; b.classList.add('sel'); }
        b.addEventListener('click', function () { if (picked[st.name]) { delete picked[st.name]; b.classList.remove('sel'); } else { picked[st.name] = 1; b.classList.add('sel'); } cnt(); });
        grid.appendChild(b); }); cnt(); });
      REASONS.forEach(function (r) { var c = el('button', 'ks-chip', r); c.type = 'button'; c.addEventListener('click', function () { reason = r; Array.prototype.forEach.call(rs.querySelectorAll('.ks-chip'), function (x) { x.classList.remove('on'); }); c.classList.add('on'); }); rs.appendChild(c); });
      var clr = el('button', 'ks-chip', '선택 해제'); clr.type = 'button'; clr.addEventListener('click', function () { picked = {}; Array.prototype.forEach.call(grid.children, function (x) { x.classList.remove('sel'); }); cnt(); });
      ok.addEventListener('click', function () {
        var names = Object.keys(picked); if (!names.length) { msg.textContent = '먼저 이름을 눌러 주세요 (여러 명 가능)'; return; } if (!reason.trim()) { msg.textContent = '사유를 골라 주세요'; return; }
        ok.disabled = true; outApi({ op: 'out', names: names, reason: reason + (txt.value.trim() ? ' · ' + txt.value.trim() : '') }).then(function (j) { if (j && j.list) { OUT = j.list; paintOut(); ov.remove(); } else { ok.disabled = false; msg.textContent = j && j.error === 'already' ? '이미 나가 있는 사람들이에요' : '등록하지 못했어요'; } }).catch(function () { ok.disabled = false; msg.textContent = '연결이 불안정해요'; });
      });
      var cancel = el('button', 'ks-btn', '닫기'); cancel.addEventListener('click', function () { ov.remove(); }); var row = el('div', 'ks-row'); row.appendChild(ok); row.appendChild(cancel);
      var tr = el('div', 'ks-row left'); tr.appendChild(txt); tr.appendChild(clr);
      card.appendChild(grid); card.appendChild(rs); card.appendChild(tr); card.appendChild(msg); card.appendChild(row);
      ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); }); root.appendChild(ov);
    }

    // ---------- 자습 시간 ----------
    function studyWin() {   // 오늘 일과 기준: 수업 중이면 그 교시 끝까지, 쉬는 시간이면 다음 수업 시작까지 (분 단위)
      var k = kst(), dow = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes(), P = periods(); if (!P.length || dow < 1 || dow > 5) return null;
      for (var i = 0; i < P.length; i++) if (m >= P[i].s && m < P[i].e) return { s: P[i].s, e: P[i].e, n: P[i].n };
      for (var j = 0; j < P.length; j++) if (m < P[j].s) return { s: m, e: P[j].s, n: 0, brk: true };
      return null;
    }
    // ---- 자습 화면 자리표: 자리에 있는 사람은 밝게, 교실을 비운 사람(이탈 등록)은 점선·흐림 + 사유·경과 시간. 자리를 누르면 이탈 등록/돌아옴 ----
    var seatMapEl = null;
    function paintSeatMap() {
      if (!seatMapEl || !seatMapEl.isConnected) return; clear(seatMapEl);
      var seats = seatsLoad(), away = {}, total = 0, out = 0; OUT.forEach(function (e) { if (!e.back) away[e.name] = e; });
      var grid = el('div', 'ks-sgrid');
      seats.forEach(function (col) {
        var c = el('div', 'ks-scol');
        col.forEach(function (row) {
          var r = el('div', 'ks-srow');
          row.forEach(function (v) {
            if (!v) { r.appendChild(el('div', 'ks-sdesk empty')); return; }
            total++; var e = away[v], d = el('button', 'ks-sdesk' + (e ? ' away' : ' here')); d.type = 'button'; d.appendChild(el('span', 'ks-dn', v));
            if (e) { out++; var min = Math.max(0, Math.round((Date.now() - e.out) / 60000)); d.appendChild(el('small', 'ks-dr', '🚪 ' + e.reason.split(' · ')[0].replace(/^\S+\s/, '') + ' · ' + min + '분')); }
            d.addEventListener('click', function () { if (e) { e.back = Date.now(); paintOut(); outApi({ op: 'back', id: e.id }).then(function (j) { if (j && j.list) { OUT = j.list; paintOut(); } }); } else openOut(v); });
            r.appendChild(d);
          });
          c.appendChild(r);
        });
        grid.appendChild(c);
      });
      var hd = el('div', 'ks-smaph'); hd.appendChild(el('b', null, '교실 자리표')); hd.appendChild(el('span', 'ks-smapc', '재석 ' + (total - out) + ' / ' + total + '명')); var oc = el('span', 'ks-smapc o' + (out ? ' on' : ''), out ? '이탈 ' + out + '명' : '전원 재석'); hd.appendChild(oc);
      var lg = el('div', 'ks-smapl', '이름을 누르면 이탈 등록 · 빨간 자리(나간 사람)를 누르면 "돌아옴"');
      seatMapEl.appendChild(hd); seatMapEl.appendChild(grid); seatMapEl.appendChild(el('div', 'ks-podium small', '교탁')); seatMapEl.appendChild(lg);
    }
    function paintStudy() {
      var box = el('div', 'ks-study'), side = el('div', 'ks-side'), mainc = el('div', 'ks-smain');
      var c1 = el('div', 'ks-sbox'); c1.appendChild(el('small', null, '현재 시각')); var clk = el('b', 'ks-sclock'); c1.appendChild(clk);
      var c2 = el('div', 'ks-sbox'); stLbl = el('small', null, '자습 종료'); c2.appendChild(stLbl); cdEl = el('b', 'ks-cd ks-scd'); cdEnd = 0; c2.appendChild(cdEl); c2.appendChild(el('small', null, '남았어요'));
      var bar = el('div', 'ks-sbar'); barEl = el('i'); bar.appendChild(barEl); c2.appendChild(bar); stRng = el('small', 'ks-srange'); c2.appendChild(stRng);
      var c3 = el('div', 'ks-sbox'); c3.appendChild(el('small', null, '내일 챙길 것')); var tm = tomorrowItems(), ul = el('ul', 'ks-slist'); (tm.length ? tm : ['특별한 일정 없음']).slice(0, 4).forEach(function (t) { ul.appendChild(el('li', null, t)); }); c3.appendChild(ul);
      outBox = el('div', 'ks-sbox ks-outbox'); side.appendChild(c1); side.appendChild(c2); side.appendChild(outBox); paintOut(); pullOut();
      mainc.appendChild(el('div', 'ks-smsg', SC.smsg)); seatMapEl = el('div', 'ks-smap'); mainc.appendChild(seatMapEl); paintSeatMap();   // 자리표: 빠진 사람이 한눈에
      box.appendChild(side); box.appendChild(mainc); main.appendChild(box);
      function t2() { var k = kst(); clk.textContent = pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes()) + ':' + pad(k.getUTCSeconds()); }
      t2(); var iv = setInterval(t2, 1000), iv2 = setInterval(pullOut, 10000), iv3 = setInterval(paintOut, 30000); cleanups.push(function () { clearInterval(iv); clearInterval(iv2); clearInterval(iv3); seatMapEl = null; barEl = null; stLbl = null; stRng = null; outBox = null; });
    }

    // ---------- 자리 바꾸기 ----------
    // 교실 배치(칠판 반대편에서 본 모습, 교탁이 아래): 3분단 × 2열, 맨 오른쪽 분단 맨 앞 한 칸은 혼자 앉는 자리
    var SEAT_DEF = [[['이민진', '박윤서'], ['성시윤', '박상범'], ['김관우', '김경하'], ['김태연', '이서연'], ['박준선', '유예준']],
      [['고준서', '이수환'], ['이윤지', '이채민'], ['윤희선', '유동경'], ['오은혁', '송은준'], ['이찬민', '김진호']],
      [['김서연', null], ['정수진', '최호연'], ['한호승', '신재경'], ['안채빈', '김가빈'], ['윤기원', '김성현'], ['강다연', '정서진']]];
    function seatsLoad() { try { var j = JSON.parse(load('ks_seats') || 'null'); if (j && j.length === 3) return j; } catch (e) {} return JSON.parse(JSON.stringify(SEAT_DEF)); }
    function paintSeat() {
      var seats = seatsLoad(), box = el('div', 'ks-seat'), grid = el('div', 'ks-sgrid'), sel = null, ctl = el('div', 'ks-row'), note = el('div', 'ks-note');
      function flat() { var a = []; seats.forEach(function (c) { c.forEach(function (r) { r.forEach(function (v, i) { if (v) a.push(v); }); }); }); return a; }
      function put(names) { var k = 0; seats.forEach(function (c) { c.forEach(function (r) { for (var i = 0; i < r.length; i++) if (r[i]) r[i] = names[k++]; }); }); }
      function draw(anim) {
        clear(grid); var ix = 0;
        seats.forEach(function (col, ci) {
          var c = el('div', 'ks-scol');
          col.forEach(function (row, ri) { var r = el('div', 'ks-srow'); row.forEach(function (v, si) {
            if (!v) { r.appendChild(el('div', 'ks-sdesk empty')); return; }
            var d = el('button', 'ks-sdesk' + (sel && sel[0] === ci && sel[1] === ri && sel[2] === si ? ' sel' : ''), v); d.type = 'button'; if (anim) d.style.animationDelay = (ix * 28) + 'ms'; if (anim) d.classList.add('shuf'); ix++;
            d.addEventListener('click', function () {
              if (!sel) { sel = [ci, ri, si]; draw(); return; }
              var a = seats[sel[0]][sel[1]], t = a[sel[2]]; a[sel[2]] = seats[ci][ri][si]; seats[ci][ri][si] = t; sel = null; save(); draw(); note.textContent = '두 자리를 바꿨어요';
            }); r.appendChild(d); }); c.appendChild(r); });
          grid.appendChild(c);
        });
      }
      function save() { store('ks_seats', JSON.stringify(seats)); }
      var go = el('button', 'ks-btn big', '자리 섞기'), rs = el('button', 'ks-btn', '처음 배치로'), by = el('button', 'ks-btn', '번호순');
      go.addEventListener('click', function () { put(shuffle(flat())); sel = null; save(); draw(true); note.textContent = '새 자리예요! 이동하세요 · 두 자리를 차례로 누르면 서로 바뀌어요'; });
      rs.addEventListener('click', function () { seats = JSON.parse(JSON.stringify(SEAT_DEF)); sel = null; save(); draw(true); note.textContent = '처음 배치로 돌아왔어요'; });
      by.addEventListener('click', function () { getNames(function (all) { var a = all.slice().sort(function (p, q) { return p.n - q.n; }).map(function (x) { return x.name; }); if (a.length === flat().length) { put(a); save(); draw(true); note.textContent = '번호순으로 앉아 봤어요'; } else note.textContent = '학생 수가 달라서 번호순은 못 만들었어요'; }); });
      KAPI.seat = { shuffle: function () { go.click(); }, reset: function () { rs.click(); }, num: function () { by.click(); }, state: function () { return { seats: seats }; } };
      [go, rs, by].forEach(function (x) { ctl.appendChild(x); }); note.textContent = '자리를 누르고 다른 자리를 누르면 서로 바뀌어요 · 배치는 이 전자칠판에 저장돼요';
      var wrap = el('div', 'ks-swrap'); wrap.appendChild(grid); wrap.appendChild(el('div', 'ks-podium', '교탁'));
      box.appendChild(ctl); box.appendChild(wrap); box.appendChild(note); main.appendChild(box); draw();
    }

    var cleanups = [];

    // ---------- 학생 이름 불러오기 ----------
    function getNames(cb) {
      if (names) return cb(names);
      fetch('/api/classmates', { headers: { authorization: 'Bearer ' + tok() }, cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { names = (j.students || []).map(function (s) { return { n: s.n, name: s.name }; }); cb(names); }).catch(function () { cb([]); });
    }
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

    // ---------- 발표자 뽑기 ----------
    var picked = [];
    function paintPick() {
      var box = el('div', 'ks-pick'), stage = el('div', 'ks-pickstage'), big = el('div', 'ks-pickname', '대기 중'), sub = el('div', 'ks-picksub', '버튼을 눌러 발표자를 뽑아요');
      stage.appendChild(big); stage.appendChild(sub);
      var excl = true, exBtn = el('button', 'ks-chip on', '뽑힌 사람 제외 ✓'); exBtn.type = 'button'; exBtn.addEventListener('click', function () { excl = !excl; exBtn.classList.toggle('on', excl); exBtn.textContent = '뽑힌 사람 제외' + (excl ? ' ✓' : ''); });
      var go = el('button', 'ks-btn big', '발표자 뽑기'), clr = el('button', 'ks-btn', '처음부터'), hist = el('div', 'ks-hist'), busy = false;
      go.type = 'button'; clr.type = 'button';
      function paintHist() { clear(hist); picked.forEach(function (p) { hist.appendChild(el('span', 'ks-hchip', p.n + ' ' + p.name)); }); }
      go.addEventListener('click', function () {
        if (busy) return;
        getNames(function (all) {
          var pool = all.filter(function (s) { return !excl || !picked.some(function (p) { return p.n === s.n; }); });
          if (!pool.length) { sub.textContent = '모두 뽑았어요 · "처음부터"를 눌러 주세요'; return; }
          busy = true; stage.classList.remove('hit'); var win = pool[Math.floor(Math.random() * pool.length)], i = 0, delay = 55, steps = 0;
          (function spin() { var s = pool[Math.floor(Math.random() * pool.length)]; big.textContent = s.name; sub.textContent = s.n + '번'; steps++; delay *= 1.085; if (delay < 420) { later(spin, delay); } else { big.textContent = win.name; sub.textContent = win.n + '번 당첨'; stage.classList.add('hit'); picked.push(win); paintHist(); busy = false; beep(1); } })();
        });
      });
      clr.addEventListener('click', function () { picked = []; paintHist(); big.textContent = '대기 중'; sub.textContent = '버튼을 눌러 발표자를 뽑아요'; stage.classList.remove('hit'); });
      var row = el('div', 'ks-row'); row.appendChild(go); row.appendChild(exBtn); row.appendChild(clr);
      KAPI.pick = { go: function () { go.click(); }, reset: function () { clr.click(); }, state: function () { return { picked: picked.map(function (p) { return p.n + ' ' + p.name; }), now: stage.classList.contains('hit') ? big.textContent : '' }; } };
      box.appendChild(stage); box.appendChild(row); box.appendChild(hist); main.appendChild(box); paintHist();
    }

    // ---------- 모둠 나누기 ----------
    var groupN = 6, lastGroups = [];
    function paintGroup() {
      var box = el('div', 'ks-group'), ctl = el('div', 'ks-row'), out = el('div', 'ks-groups');
      var minus = el('button', 'ks-chip', '－'), plus = el('button', 'ks-chip', '＋'), lab = el('b', 'ks-glab', groupN + '모둠'), go = el('button', 'ks-btn big', '모둠 구성');
      minus.type = 'button'; plus.type = 'button'; go.type = 'button';
      function draw() { lab.textContent = groupN + '모둠'; }
      minus.addEventListener('click', function () { groupN = Math.max(2, groupN - 1); draw(); });
      plus.addEventListener('click', function () { groupN = Math.min(10, groupN + 1); draw(); });
      go.addEventListener('click', function () {
        getNames(function (all) {
          var sh = shuffle(all), groups = []; for (var g = 0; g < groupN; g++) groups.push([]);
          sh.forEach(function (s, i) { groups[i % groupN].push(s); });
          clear(out);
          lastGroups = groups.map(function (g) { return g.map(function (x) { return x.name; }); });
          groups.forEach(function (g, gi) { var c = el('div', 'ks-gcard'); c.style.animationDelay = (gi * 90) + 'ms'; c.appendChild(el('div', 'ks-gh', (gi + 1) + '모둠 · ' + g.length + '명')); g.forEach(function (s) { c.appendChild(el('div', 'ks-gn', s.name)); }); out.appendChild(c); });
        });
      });
      KAPI.group = { set: function (n) { groupN = Math.max(2, Math.min(10, parseInt(n, 10) || 6)); draw(); go.click(); }, go: function () { go.click(); }, state: function () { return { n: groupN, groups: lastGroups }; } };
      [minus, lab, plus, go].forEach(function (x) { ctl.appendChild(x); }); box.appendChild(ctl); box.appendChild(out); main.appendChild(box);
      go.click();
    }

    // ---------- 설정 ----------
    function openSettings() {
      var ov = el('div', 'ks-modal'), card = el('div', 'ks-mcard');
      card.appendChild(el('h2', null, '전자칠판 설정'));
      var th = el('div', 'ks-row left'); th.appendChild(el('span', 'ks-lbl', '화면 테마'));
      [['다크 모드', 'dark'], ['라이트 모드', 'light']].forEach(function (tOpt) {
        var b = el('button', 'ks-chip' + (theme === tOpt[1] ? ' on' : ''), tOpt[0]); b.type = 'button';
        b.addEventListener('click', function () {
          applyTheme(tOpt[1]);
          Array.prototype.forEach.call(th.querySelectorAll('.ks-chip'), function (x) { x.classList.remove('on'); }); b.classList.add('on');
        });
        th.appendChild(b);
      });
      card.appendChild(th);
      var sz = el('div', 'ks-row left'); sz.appendChild(el('span', 'ks-lbl', '글자 크기'));
      [['보통', 1], ['크게', 1.15], ['아주 크게', 1.3]].forEach(function (s) { var b = el('button', 'ks-chip' + (Math.abs(scale - s[1]) < 0.01 ? ' on' : ''), s[0]); b.type = 'button'; b.addEventListener('click', function () { scale = s[1]; store('ks_scale', String(scale)); root.style.setProperty('--ks', scale); Array.prototype.forEach.call(sz.querySelectorAll('.ks-chip'), function (x) { x.classList.remove('on'); }); b.classList.add('on'); }); sz.appendChild(b); });
      card.appendChild(sz);
      function field(label, type, val, onChange, w) { var r = el('div', 'ks-row left'); r.appendChild(el('span', 'ks-lbl', label)); var i = el('input', 'ks-in'); i.type = type; i.value = val; if (w) i.style.width = w; i.addEventListener('change', function () { onChange(i.value); store('ks_sched', JSON.stringify(SC)); lastPhase = undefined; }); r.appendChild(i); return r; }
      function toggle(label, key) { var b = el('button', 'ks-chip' + (SC[key] ? ' on' : ''), label + (SC[key] ? ' 켜짐' : ' 꺼짐')); b.type = 'button'; b.addEventListener('click', function () { SC[key] = !SC[key]; store('ks_sched', JSON.stringify(SC)); b.classList.toggle('on', SC[key]); b.textContent = label + (SC[key] ? ' 켜짐' : ' 꺼짐'); }); return b; }
      card.appendChild(el('div', 'ks-sec', '청소 · 종례 시간'));
      card.appendChild(field('청소 시작', 'time', SC.cs, function (v) { SC.cs = v; })); card.appendChild(field('종례 시작', 'time', SC.js, function (v) { SC.js = v; })); card.appendChild(field('종례 끝', 'time', SC.ee, function (v) { SC.ee = v; }));
      card.appendChild(field('종례 문구', 'text', SC.msg, function (v) { SC.msg = v || SCHED_DEF.msg; }, '16em'));
      card.appendChild(el('div', 'ks-sec', '자습 화면 (끝나는 시각은 일과 시간표의 교시 끝에 맞춰요)'));
      card.appendChild(field('자습 문구', 'text', SC.smsg, function (v) { SC.smsg = v || SCHED_DEF.smsg; }, '16em'));
      card.appendChild(el('div', 'ks-sec', '조회 시간')); card.appendChild(field('조회 시작', 'time', SC.hs, function (v) { SC.hs = v; })); card.appendChild(field('조회 끝', 'time', SC.he, function (v) { SC.he = v; }));
      var tg = el('div', 'ks-row left'); tg.appendChild(toggle('시간 되면 자동 전환', 'auto')); tg.appendChild(toggle('딩동 소리', 'chime')); card.appendChild(tg);
      var fs = el('button', 'ks-btn', '전체화면'); fs.type = 'button'; fs.addEventListener('click', function () { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); });
      var wl = el('div', 'ks-note', wakeLock ? '화면이 꺼지지 않게 유지 중이에요' : '이 브라우저는 화면 꺼짐 방지를 지원하지 않거나 아직 켜지지 않았어요');
      var out = el('button', 'ks-btn danger', '로그아웃'); out.type = 'button'; out.addEventListener('click', function () { if (window.confirm('전자칠판 계정을 로그아웃할까요? 다시 로그인하려면 비밀번호가 필요해요.')) { store('tok26', null); store('gk26', null); location.hash = ''; location.reload(); } });
      var close = el('button', 'ks-btn', '닫기'); close.type = 'button'; close.addEventListener('click', function () { ov.remove(); });
      var row = el('div', 'ks-row'); row.appendChild(fs); row.appendChild(close); card.appendChild(wl); card.appendChild(row); card.appendChild(out);
      ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); }); root.appendChild(ov);
    }

    // ---------- 모드 전환 ----------
    var MODES = [
      ['today', 'home', '오늘'],
      ['clean', 'clean', '청소'],
      ['jongrye', 'announce', '조회/종례'],
      ['study', 'study', '자습'],
      ['seat', 'seat', '자리'],
      ['game', 'game', '미니게임'],
      ['board', 'board', '의견 보드'],
      ['pick', 'pick', '발표자'],
      ['group', 'group', '모둠']
    ];
    function paintDock() {
      clear(dock);
      MODES.forEach(function (m) {
        var b = el('button', 'ks-dbtn' + (mode === m[0] ? ' on' : '')); b.type = 'button';
        var ic = el('span', 'ks-de'); ic.appendChild(svgIcon(m[1]));
        b.appendChild(ic); b.appendChild(el('span', 'ks-dl', m[2]));
        b.addEventListener('click', function () { setMode(m[0]); }); dock.appendChild(b);
      });
      var tBtn = el('button', 'ks-dbtn small ks-tbtn'); tBtn.type = 'button';
      var tTitle = theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환';
      tBtn.title = tTitle; tBtn.setAttribute('aria-label', tTitle);
      var tic = el('span', 'ks-de'); tic.appendChild(svgIcon(theme === 'light' ? 'moon' : 'sun')); tBtn.appendChild(tic);
      tBtn.addEventListener('click', function () { applyTheme(theme === 'light' ? 'dark' : 'light'); });
      dock.appendChild(tBtn);
      var s = el('button', 'ks-dbtn small'); s.type = 'button'; s.title = '설정'; s.setAttribute('aria-label', '설정');
      var sic = el('span', 'ks-de'); sic.appendChild(svgIcon('settings')); s.appendChild(sic);
      s.addEventListener('click', openSettings); dock.appendChild(s);
    }
    function setMode(m) {
      if (m === 'game') { if (window.Game26) window.Game26.hub({ onExit: function () { paintDock(); } }); return; }
      if (m === 'board') { if (window.Board26) window.Board26.show({ power: true, onExit: function () { paintDock(); } }); return; }
      if (m !== 'board' && m !== 'game') store('ks_mode', JSON.stringify({ m: m, v: jView, at: Date.now() })); try { history.replaceState(null, '', '#k-' + m); } catch (e) {}   // 새로고침·자동 업데이트 후에도 보던 화면 유지 (저장소 + 주소 뒤 #k-화면)
      cleanups.forEach(function (f) { f(); }); cleanups = []; KAPI = {}; resetTimers(); cdEl = null; mode = m; setTimeout(paintBadge, 0); clear(main); main.scrollTop = 0; paintDock(); root.classList.toggle('ks-solid', m === 'clean' || m === 'jongrye' || m === 'study'); root.classList.toggle('ks-cleanmode', m === 'clean');
      if (m === 'today') { todayEl = null; paintToday(); sumBox = el('div', 'ks-sumbn'); main.appendChild(sumBox); paintSum(); main.appendChild(todayEl); lastIdx = -2; tick(); }
      else if (m === 'clean') { paintClean(); tick(); } else if (m === 'jongrye') { paintJongrye(); tick(); } else if (m === 'study') { paintStudy(); tick(); } else if (m === 'seat') paintSeat();
      else if (m === 'pick') paintPick(); else if (m === 'group') paintGroup();
    }

    // ---------- 원격 제어 (관리자·교사 폰 → 전자칠판) ----------
    function showAlert(text) {
      if (alertEl) { alertEl.remove(); alertEl = null; } alertText = text || ''; if (!alertText) return;
      alertEl = el('div', 'ks-alert'); alertEl.appendChild(el('div', 'ks-alert-t', alertText)); var x = el('button', 'ks-alert-x', '✕ 닫기'); x.addEventListener('click', function () { showAlert(''); }); alertEl.appendChild(x); root.appendChild(alertEl);
    }
    function runCmd(c) {
      var a = c.args || {};
      if (c.cmd === 'mode' && a.m) { if (a.m === 'board') return; if (a.m === 'jongrye' && (a.view === 'jo' || a.view === 'jong')) { jView = a.view; setMode('jongrye'); } else if (a.m !== mode) setMode(a.m); }
      else if (c.cmd === 'seat') { if (mode !== 'seat') setMode('seat'); var S = KAPI.seat; if (S && S[a.action]) S[a.action](); }
      else if (c.cmd === 'pick') { if (mode !== 'pick') setMode('pick'); if (KAPI.pick) (a.action === 'reset' ? KAPI.pick.reset : KAPI.pick.go)(); }
      else if (c.cmd === 'group') { if (mode !== 'group') setMode('group'); if (KAPI.group) KAPI.group.set(a.n); }
      else if (c.cmd === 'banner') showAlert(a.text ? String(a.text).slice(0, 120) : '');
      else if (c.cmd === 'cleansync') { if (mode === 'clean') pullLog(); else api('GET').then(function (j) { if (j && j.logs) CL = j.logs[j.today] || {}; }).catch(function () {}); }
      else if (c.cmd === 'jongryesync') { if (dictOn || jrPending) return; JR = a.rec || null; D.jongrye = JR; if (mode === 'jongrye') paintJrNote(true); paintSum(); }
      else if (c.cmd === 'outsync') { if (outBox) pullOut(); }
      else if (c.cmd === 'chime') chime();
      else if (c.cmd === 'reload') location.reload();
    }
    var rSince = null, rBusy = false;
    function remoteState() {
      var st = { mode: mode, at: Date.now(), alert: alertText };
      try { Object.keys(KAPI).forEach(function (k) { st[k] = KAPI[k].state(); }); } catch (e) {}
      if (mode === 'clean') { var all = {}; chips.forEach(function (b) { all[b.dataset.name] = !!CL[b.dataset.name]; }); st.clean = all; }
      return st;
    }
    function rpoll() {
      var hr = kst().getUTCHours(), delay = mode === 'jongrye' ? 800 : (hr >= 7 && hr < 22 ? 3000 : 15000);
      if (!rBusy) { rBusy = true;
        fetch('/api/kiosk/poll', { method: 'POST', headers: { authorization: 'Bearer ' + tok(), 'content-type': 'application/json' }, body: JSON.stringify({ since: rSince, state: remoteState() }), cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { rBusy = false; if (!j) return; rSince = j.last; (j.cmds || []).forEach(function (c) { try { runCmd(c); } catch (e) {} }); }).catch(function () { rBusy = false; });
      }
      setTimeout(rpoll, delay);
    }

    // ---------- 데이터 새로 고침 · 화면 켜짐 유지 ----------
    var wakeLock = null;
    function keepAwake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; w.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {}); } catch (e) {} }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !wakeLock) keepAwake(); });
    function refresh() { fetch('/api/data', { headers: { authorization: 'Bearer ' + tok() }, cache: 'no-store' }).then(function (r) { if (r.status === 401) { store('tok26', null); location.reload(); return null; } return r.ok ? r.json() : null; }).then(function (d) { if (d && d.me) { D = d; if (mode === 'today') { paintToday(true); } } }).catch(function () {}); }
    setInterval(tick, 1000); setInterval(refresh, 5 * 60 * 1000); keepAwake();
    document.body.appendChild(root);
    var startMode = 'today', hm0 = /^#k-(\w+)/.exec(location.hash || ''); try { var sm = JSON.parse(load('ks_mode') || 'null'); if (hm0) sm = { m: hm0[1], v: sm && sm.v, at: Date.now() }; /* 주소에 #k-화면이 있으면 우선 */ if (sm && sm.m && Date.now() - sm.at < 12 * 3600e3 && MODES.some(function (x) { return x[0] === sm.m && x[0] !== 'board' && x[0] !== 'game'; })) { startMode = sm.m; if (sm.v === 'jo' || sm.v === 'jong') jView = sm.v; } } catch (e) {}
    setMode(startMode); tick(); setTimeout(rpoll, 1500);
  }
  window.Kiosk26 = { start: start };
})();
