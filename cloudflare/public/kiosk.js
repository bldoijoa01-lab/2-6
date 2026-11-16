// 전자칠판 전용 화면 (role 'board' 계정으로 로그인했을 때): 교실에 띄워 두는 대시보드 + 수업 도구
// 오늘(알림장·일과·급식·일정·청소) / 의견 보드 / 타이머 / 발표자 뽑기 / 모둠 나누기
(function () {
  var DOW = ['일', '월', '화', '수', '목', '금', '토'], KIND = { pin: '⭐', notice: '📢', prep: '🎒', hw: '📝', time: '⏰' };
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
    try { var C = window.AudioContext || window.webkitAudioContext, a = new C(); for (var i = 0; i < (times || 3); i++) { (function (i) { var o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(a.destination); var t = a.currentTime + i * 0.55; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); o.start(t); o.stop(t + 0.5); })(i); } } catch (e) {}
  }

  function start(data) {
    var D = data, mode = 'today', timers = [], root = el('div', 'ks-root'), head = el('div', 'ks-head'), main = el('div', 'ks-main'), dock = el('div', 'ks-dock');
    var clockEl = el('div', 'ks-clock'), dateEl = el('div', 'ks-date'), periodEl = el('div', 'ks-period');
    var hl = el('div', 'ks-hl'); hl.appendChild(clockEl); var hr = el('div', 'ks-hr'); hr.appendChild(dateEl); hr.appendChild(periodEl);
    head.appendChild(hl); head.appendChild(hr);
    root.appendChild(head); root.appendChild(main); root.appendChild(dock);
    document.body.classList.add('kiosk'); document.body.classList.remove('locked');
    var scale = parseFloat(load('ks_scale') || '1'); root.style.setProperty('--ks', scale);
    var names = null;   // 학생 이름(뽑기·모둠)
    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function resetTimers() { timers.forEach(clearTimeout); timers = []; }

    // ---------- 공통: 시각·교시 ----------
    function curPeriod() {
      var k = kst(), dow = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes(), W = D.weekly;
      if (!W || dow < 1 || dow > 5) return { idx: -1, text: dow === 0 || dow === 6 ? '주말' : '' };
      var best = -1, st = [];
      W.rows.forEach(function (r, i) { var p = r.time.split(':'); st[i] = +p[0] * 60 + +p[1]; });
      for (var i = 0; i < st.length; i++) if (m >= st[i] && m < st[i] + 50) { best = i; break; }
      if (best >= 0) return { idx: best, text: W.rows[best].n + '교시 수업 중' };
      for (var j = 0; j < st.length; j++) if (m < st[j]) return { idx: -1, text: j === 0 ? '등교 전' : '쉬는 시간 · 다음 ' + W.rows[j].n + '교시 ' + W.rows[j].time };
      return { idx: -1, text: '수업 끝' };
    }
    function tick() {
      var k = kst(); clockEl.textContent = pad(k.getUTCHours()) + ':' + pad(k.getUTCMinutes());
      dateEl.textContent = (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일 ' + DOW[k.getUTCDay()] + '요일';
      var p = curPeriod(); periodEl.textContent = p.text; periodEl.style.display = p.text ? '' : 'none';
      if (mode === 'today' && p.idx !== lastIdx) { lastIdx = p.idx; paintToday(true); }
    }
    var lastIdx = -2;

    // ---------- 오늘 대시보드 ----------
    var todayEl = null;
    function card(title, emoji) { var c = el('div', 'ks-card'), h = el('div', 'ks-ch'); h.appendChild(el('span', 'ks-ce', emoji)); h.appendChild(el('b', null, title)); c.appendChild(h); return c; }
    function paintToday(keep) {
      if (!todayEl) { todayEl = el('div', 'ks-today'); }
      clear(todayEl); var k = kst(), iso = isoOf(k), dow = k.getUTCDay();
      var noSchool = (D.events || []).filter(function (e) { return e.noSchool && e.date <= iso && iso <= (e.end || e.date); })[0];
      // 알림장
      var daily = (D.daily || {})[iso], c1 = card('오늘의 알림장', '📒'); c1.classList.add('ks-a');
      var ul = el('ul', 'ks-list');
      ((daily && daily.items) || [{ k: 'notice', t: '오늘 알림장이 아직 없어요' }]).forEach(function (i) { var li = el('li'); li.appendChild(el('span', 'ks-k', KIND[i.k] || '📢')); li.appendChild(el('span', 'ks-t', i.t)); ul.appendChild(li); });
      c1.appendChild(ul); todayEl.appendChild(c1);
      // 일과
      var c2 = card('오늘 일과', '🕘'), W = D.weekly, p = curPeriod(); c2.classList.add('ks-b');
      if (noSchool) c2.appendChild(el('div', 'ks-empty', '오늘은 ' + noSchool.title.replace(/\(.*\)/, '') + '이라 학교에 안 가요 🙌'));
      else if (!W || dow < 1 || dow > 5) c2.appendChild(el('div', 'ks-empty', '주말이에요 😴'));
      else W.rows.forEach(function (r, i) {
        var cell = r.cells[dow - 1]; if (!cell) return;
        var name = cell.k === 'block' ? cell.b + ' 선택' : cell.t, row = el('div', 'ks-tt' + (i === p.idx ? ' now' : ''));
        row.appendChild(el('span', 'ks-tp', r.n + '교시')); row.appendChild(el('span', 'ks-tm', r.time)); row.appendChild(el('span', 'ks-ts', name)); c2.appendChild(row);
      });
      todayEl.appendChild(c2);
      // 급식
      var c3 = card('오늘 급식', '🍚'); c3.classList.add('ks-c'); var meals = (D.today && D.today.date === iso ? D.today.meals : []) || [], hm = k.getUTCHours() * 60 + k.getUTCMinutes();
      var now = hm < 540 ? '조식' : hm < 840 ? '중식' : '석식';
      if (!meals.length) c3.appendChild(el('div', 'ks-empty', '오늘 급식 정보가 없어요'));
      meals.forEach(function (m) { var b = el('div', 'ks-meal' + (m.name === now ? ' now' : '')); var h = el('div', 'ks-mh'); h.appendChild(el('b', null, m.name)); if (m.kcal) h.appendChild(el('small', null, m.kcal + 'kcal')); b.appendChild(h); b.appendChild(el('div', 'ks-md', m.dishes.join(' · '))); c3.appendChild(b); });
      todayEl.appendChild(c3);
      // 다가오는 일정
      var c4 = card('다가오는 일정', '📅'); c4.classList.add('ks-d'); var up = (D.events || []).filter(function (e) { return !e.calOnly && Math.round((toUTC(e.end || e.date) - toUTC(iso)) / 86400000) >= 0; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 6);
      if (!up.length) c4.appendChild(el('div', 'ks-empty', '예정된 일정이 없어요'));
      up.forEach(function (e) { var d = Math.round((toUTC(e.date) - toUTC(iso)) / 86400000), r = el('div', 'ks-ev'); r.appendChild(el('span', 'ks-evt', e.title)); var badge = el('span', 'ks-dd' + (d <= 1 ? ' hot' : ''), d < 0 ? '진행 중' : d === 0 ? 'D-DAY' : 'D-' + d); r.appendChild(badge); c4.appendChild(r); });
      todayEl.appendChild(c4);
      // 청소
      var C = D.clean; if (C && C.zones && !noSchool && dow >= 1 && dow <= 5 && (!C.until || iso <= C.until) && (!C.from || iso >= C.from)) {
        var c5 = card('청소 당번', '🧹'); c5.classList.add('ks-e');
        C.zones.forEach(function (z) { (z.rows || []).forEach(function (r) { var row = el('div', 'ks-cl'); row.appendChild(el('span', 'ks-clp', (z.zone + ' ' + (r.task || '')).replace(/\(\d+\)/g, '').trim())); row.appendChild(el('span', 'ks-clw', r.who.join(', '))); c5.appendChild(row); }); });
        todayEl.appendChild(c5);
      }
      if (!keep) { main.scrollTop = 0; }
    }

    // ---------- 타이머 ----------
    function paintTimer() {
      var box = el('div', 'ks-timer'), total = 300, left = total, running = false, iv = null, endAt = 0;
      var ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ring.setAttribute('viewBox', '0 0 200 200'); ring.setAttribute('class', 'ks-ring');
      var bg = document.createElementNS(ring.namespaceURI, 'circle'), fg = document.createElementNS(ring.namespaceURI, 'circle');
      [bg, fg].forEach(function (c) { c.setAttribute('cx', '100'); c.setAttribute('cy', '100'); c.setAttribute('r', '88'); c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '12'); ring.appendChild(c); });
      bg.setAttribute('stroke', 'rgba(255,255,255,.14)'); fg.setAttribute('stroke', '#7FE0FF'); fg.setAttribute('stroke-linecap', 'round'); fg.setAttribute('transform', 'rotate(-90 100 100)'); fg.setAttribute('stroke-dasharray', String(2 * Math.PI * 88));
      var wrap = el('div', 'ks-ringwrap'), time = el('div', 'ks-time'); wrap.appendChild(ring); wrap.appendChild(time);
      function show() { var m = Math.floor(left / 60), s = left % 60; time.textContent = pad(m) + ':' + pad(s); fg.setAttribute('stroke-dashoffset', String(2 * Math.PI * 88 * (1 - (total ? left / total : 0)))); box.classList.toggle('low', left <= 10 && running); }
      function stop() { running = false; clearInterval(iv); startBtn.textContent = left === 0 ? '▶ 다시' : '▶ 시작'; }
      function finish() { stop(); left = 0; show(); box.classList.add('done'); beep(4); }
      function go() { if (left <= 0) left = total; box.classList.remove('done'); running = true; endAt = Date.now() + left * 1000; startBtn.textContent = '⏸ 일시정지'; clearInterval(iv); iv = setInterval(function () { var l = Math.max(0, Math.round((endAt - Date.now()) / 1000)); if (l !== left) { left = l; show(); } if (l <= 0) finish(); }, 250); }
      var startBtn = el('button', 'ks-btn big', '▶ 시작'); startBtn.addEventListener('click', function () { if (running) stop(); else go(); });
      var reset = el('button', 'ks-btn', '↺ 처음으로'); reset.addEventListener('click', function () { stop(); left = total; box.classList.remove('done'); show(); });
      var presets = el('div', 'ks-presets');
      [1, 3, 5, 10, 15, 20, 30].forEach(function (m) { var b = el('button', 'ks-chip', m + '분'); b.addEventListener('click', function () { stop(); total = left = m * 60; box.classList.remove('done'); show(); }); presets.appendChild(b); });
      var adj = el('div', 'ks-adj'); [['-1분', -60], ['-10초', -10], ['+10초', 10], ['+1분', 60]].forEach(function (a) { var b = el('button', 'ks-chip', a[0]); b.addEventListener('click', function () { var was = running; if (was) stop(); total = left = Math.max(10, Math.min(5999, left + a[1])); show(); if (was) go(); }); adj.appendChild(b); });
      box.appendChild(wrap); box.appendChild(presets); box.appendChild(adj); var row = el('div', 'ks-row'); row.appendChild(startBtn); row.appendChild(reset); box.appendChild(row);
      show(); main.appendChild(box); cleanups.push(function () { clearInterval(iv); });
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
      var box = el('div', 'ks-pick'), stage = el('div', 'ks-pickstage'), big = el('div', 'ks-pickname', '🎲'), sub = el('div', 'ks-picksub', '버튼을 눌러 발표자를 뽑아요');
      stage.appendChild(big); stage.appendChild(sub);
      var excl = true, exBtn = el('button', 'ks-chip on', '뽑힌 사람 제외 ✓'); exBtn.addEventListener('click', function () { excl = !excl; exBtn.classList.toggle('on', excl); exBtn.textContent = '뽑힌 사람 제외' + (excl ? ' ✓' : ''); });
      var go = el('button', 'ks-btn big', '🎲 뽑기!'), clr = el('button', 'ks-btn', '↺ 처음부터'), hist = el('div', 'ks-hist'), busy = false;
      function paintHist() { clear(hist); picked.forEach(function (p) { hist.appendChild(el('span', 'ks-hchip', p.n + ' ' + p.name)); }); }
      go.addEventListener('click', function () {
        if (busy) return;
        getNames(function (all) {
          var pool = all.filter(function (s) { return !excl || !picked.some(function (p) { return p.n === s.n; }); });
          if (!pool.length) { sub.textContent = '모두 뽑았어요! "처음부터"를 눌러 주세요'; return; }
          busy = true; stage.classList.remove('hit'); var win = pool[Math.floor(Math.random() * pool.length)], i = 0, delay = 55, steps = 0;
          (function spin() { var s = pool[Math.floor(Math.random() * pool.length)]; big.textContent = s.name; sub.textContent = s.n + '번'; steps++; delay *= 1.085; if (delay < 420) { later(spin, delay); } else { big.textContent = win.name; sub.textContent = win.n + '번 🎉'; stage.classList.add('hit'); picked.push(win); paintHist(); busy = false; beep(1); } })();
        });
      });
      clr.addEventListener('click', function () { picked = []; paintHist(); big.textContent = '🎲'; sub.textContent = '버튼을 눌러 발표자를 뽑아요'; stage.classList.remove('hit'); });
      var row = el('div', 'ks-row'); row.appendChild(go); row.appendChild(exBtn); row.appendChild(clr);
      box.appendChild(stage); box.appendChild(row); box.appendChild(hist); main.appendChild(box); paintHist();
    }

    // ---------- 모둠 나누기 ----------
    var groupN = 6;
    function paintGroup() {
      var box = el('div', 'ks-group'), ctl = el('div', 'ks-row'), out = el('div', 'ks-groups');
      var minus = el('button', 'ks-chip', '－'), plus = el('button', 'ks-chip', '＋'), lab = el('b', 'ks-glab', groupN + '모둠'), go = el('button', 'ks-btn big', '🔀 섞기');
      function draw() { lab.textContent = groupN + '모둠'; }
      minus.addEventListener('click', function () { groupN = Math.max(2, groupN - 1); draw(); });
      plus.addEventListener('click', function () { groupN = Math.min(10, groupN + 1); draw(); });
      go.addEventListener('click', function () {
        getNames(function (all) {
          var sh = shuffle(all), groups = []; for (var g = 0; g < groupN; g++) groups.push([]);
          sh.forEach(function (s, i) { groups[i % groupN].push(s); });
          clear(out);
          groups.forEach(function (g, gi) { var c = el('div', 'ks-gcard'); c.style.animationDelay = (gi * 90) + 'ms'; c.appendChild(el('div', 'ks-gh', (gi + 1) + '모둠 · ' + g.length + '명')); g.forEach(function (s) { c.appendChild(el('div', 'ks-gn', s.name)); }); out.appendChild(c); });
        });
      });
      [minus, lab, plus, go].forEach(function (x) { ctl.appendChild(x); }); box.appendChild(ctl); box.appendChild(out); main.appendChild(box);
      go.click();
    }

    // ---------- 설정 ----------
    function openSettings() {
      var ov = el('div', 'ks-modal'), card = el('div', 'ks-mcard');
      card.appendChild(el('h2', null, '⚙ 전자칠판 설정'));
      var sz = el('div', 'ks-row'); sz.appendChild(el('span', 'ks-lbl', '글자 크기'));
      [['보통', 1], ['크게', 1.15], ['아주 크게', 1.3]].forEach(function (s) { var b = el('button', 'ks-chip' + (Math.abs(scale - s[1]) < 0.01 ? ' on' : ''), s[0]); b.addEventListener('click', function () { scale = s[1]; store('ks_scale', String(scale)); root.style.setProperty('--ks', scale); Array.prototype.forEach.call(sz.querySelectorAll('.ks-chip'), function (x) { x.classList.remove('on'); }); b.classList.add('on'); }); sz.appendChild(b); });
      card.appendChild(sz);
      var fs = el('button', 'ks-btn', '⛶ 전체화면'); fs.addEventListener('click', function () { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); });
      var wl = el('div', 'ks-note', wakeLock ? '✅ 화면이 꺼지지 않게 유지 중이에요' : '이 브라우저는 화면 꺼짐 방지를 지원하지 않거나 아직 켜지지 않았어요');
      var out = el('button', 'ks-btn danger', '로그아웃'); out.addEventListener('click', function () { if (window.confirm('전자칠판 계정을 로그아웃할까요? 다시 로그인하려면 비밀번호가 필요해요.')) { store('tok26', null); store('gk26', null); location.hash = ''; location.reload(); } });
      var close = el('button', 'ks-btn', '닫기'); close.addEventListener('click', function () { ov.remove(); });
      var row = el('div', 'ks-row'); row.appendChild(fs); row.appendChild(close); card.appendChild(wl); card.appendChild(row); card.appendChild(out);
      ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); }); root.appendChild(ov);
    }

    // ---------- 모드 전환 ----------
    var MODES = [['today', '🏠', '오늘'], ['board', '💬', '의견 보드'], ['timer', '⏱', '타이머'], ['pick', '🎲', '발표자 뽑기'], ['group', '👥', '모둠 나누기']];
    function paintDock() {
      clear(dock);
      MODES.forEach(function (m) { var b = el('button', 'ks-dbtn' + (mode === m[0] ? ' on' : '')); b.appendChild(el('span', 'ks-de', m[1])); b.appendChild(el('span', 'ks-dl', m[2])); b.addEventListener('click', function () { setMode(m[0]); }); dock.appendChild(b); });
      var s = el('button', 'ks-dbtn small'); s.appendChild(el('span', 'ks-de', '⚙')); s.addEventListener('click', openSettings); dock.appendChild(s);
    }
    function setMode(m) {
      if (m === 'board') { if (window.Board26) window.Board26.show({ power: true, onExit: function () { paintDock(); } }); return; }
      cleanups.forEach(function (f) { f(); }); cleanups = []; resetTimers(); mode = m; clear(main); main.scrollTop = 0; paintDock();
      if (m === 'today') { todayEl = null; paintToday(); main.appendChild(todayEl); lastIdx = -2; tick(); }
      else if (m === 'timer') paintTimer(); else if (m === 'pick') paintPick(); else if (m === 'group') paintGroup();
    }

    // ---------- 데이터 새로 고침 · 화면 켜짐 유지 ----------
    var wakeLock = null;
    function keepAwake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; w.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {}); } catch (e) {} }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !wakeLock) keepAwake(); });
    function refresh() { fetch('/api/data', { headers: { authorization: 'Bearer ' + tok() }, cache: 'no-store' }).then(function (r) { if (r.status === 401) { store('tok26', null); location.reload(); return null; } return r.ok ? r.json() : null; }).then(function (d) { if (d && d.me) { D = d; if (mode === 'today') { paintToday(true); } } }).catch(function () {}); }
    setInterval(tick, 1000); setInterval(refresh, 5 * 60 * 1000); keepAwake();
    document.body.appendChild(root); setMode('today'); tick();
  }
  window.Kiosk26 = { start: start };
})();
