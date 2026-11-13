// 2-6 알림장 웹앱 v1 — 정적 사이트 (GitHub Pages). 데이터는 data.json 만 고치면 됨.
(function () {
  'use strict';

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
  function selectTab(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById('panel-' + t.getAttribute('data-tab')).hidden = !on;
    });
        if (name === 'grade') loadGrade();
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { selectTab(t.getAttribute('data-tab')); }); });

  document.getElementById('logoutBtn').addEventListener('click', function () { store('tok26', null); store('gk26', null); store('gcscore26', null); location.hash = ''; location.reload(); });

  // ---------- 테마 ----------
  (function () {
    var btn = document.getElementById('themeBtn'), root = document.documentElement;
    function apply(t) { if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme'); }
    try { apply(localStorage.getItem('theme26')); } catch (e) {}
    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      var t = dark ? 'light' : 'dark'; apply(t); try { localStorage.setItem('theme26', t); } catch (e) {}
    });
  })();

  // ---------- 홈 ----------
  function goTab(name) { selectTab(name); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function renderHome() {
    var p = document.getElementById('panel-home'); clear(p);
    var me = DATA.me, mv = DATA.move;
    var upcoming = DATA.events.filter(function (e) { return diffDays(e.end || e.date, TODAY) >= 0; })
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
    var moveTxt = me.n <= mv.frontCount ? mv.otherRoom + '로 이동' : '우리 교실 그대로';
    grid.push(stat('내 원반', moveTxt, me.n + '번 · ' + (me.n <= mv.frontCount ? '앞번호 ' + mv.frontCount + '명 이동' : mv.ownRoom + ' 응시'), function () { goTab('exam'); setTimeout(function () { jumpTo('sec-move'); }, 60); }));
    grid.push(stat('특별실 응시', DATA.special.length ? DATA.special.length + '과목' : '없음',
      DATA.special.length ? DATA.special[0].label.split(' ')[0] + ' 시작' : '원반에서 응시', function () { goTab('exam'); setTimeout(function () { jumpTo('sec-special'); }, 60); }));
    grid.push(stat('예정 일정', upcoming.length + '개', others[0] ? '다음: ' + others[0].title : '예정 없음', function () { goTab('today'); }));
    grid.push(stat('등급컷 아카이브', '등급컷 보기', '과목별 컷 · 내 예상 등급', function () { goTab('grade'); }));
    p.appendChild(h('div', { class: 'stats' }, grid));

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
    var t = new Date(TODAY), year = t.getUTCFullYear(), month = t.getUTCMonth(), sel = null;
    var wrap = h('div', { class: 'card' });
    function iso(y, m, d) { return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2); }
    function eventsOn(key) {
      return DATA.events.filter(function (e) { return key >= e.date && key <= (e.end || e.date); });
    }
    function draw() {
      clear(wrap);
      var prev = h('button', { class: 'cal-nav', type: 'button', 'aria-label': '이전 달', text: '‹' });
      var next = h('button', { class: 'cal-nav', type: 'button', 'aria-label': '다음 달', text: '›' });
      prev.addEventListener('click', function () { month--; if (month < 0) { month = 11; year--; } sel = null; draw(); });
      next.addEventListener('click', function () { month++; if (month > 11) { month = 0; year++; } sel = null; draw(); });
      var top = h('div', { class: 'cal-top' }, [prev, h('div', { class: 'cal-title' }, [h('div', { class: 'eyebrow', text: 'CALENDAR' }), h('h2', { text: year + '년 ' + (month + 1) + '월' })]), next]);
      var grid = h('div', { class: 'cal-grid' });
      DOW.forEach(function (d, i) { grid.appendChild(h('div', { class: 'cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), text: d })); });
      var first = new Date(Date.UTC(year, month, 1)).getUTCDay(), days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      for (var i = 0; i < first; i++) grid.appendChild(h('div', { class: 'cal-cell empty' }));
      for (var d = 1; d <= days; d++) (function (d) {
        var key = iso(year, month, d), evs = eventsOn(key), dow = (first + d - 1) % 7;
        var cls = 'cal-cell' + (key === iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) ? ' today' : '') + (key === sel ? ' sel' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');
        var cell = h('button', { class: cls, type: 'button' }, [h('span', { class: 'cal-d', text: String(d) })]);
        if (evs.length) {
          var dots = h('span', { class: 'cal-dots' });
          evs.slice(0, 3).forEach(function (e) { dots.appendChild(h('i', { class: (/기말|중간|고사/.test(e.title) ? 'exam' : diffDays(e.date, TODAY) <= 7 && diffDays(e.date, TODAY) >= 0 ? 'hot' : '') })); });
          cell.appendChild(dots);
        }
        cell.addEventListener('click', function () { sel = key === sel ? null : key; draw(); });
        grid.appendChild(cell);
      })(d);
      var shown = sel ? eventsOn(sel) : DATA.events.filter(function (e) { var m = iso(year, month, 1), n = iso(year, month, days); return (e.end || e.date) >= m && e.date <= n; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var title = sel ? fmt(sel) : (month + 1) + '월 일정';
      var rows = shown.length ? shown.map(function (e) {
        var when = e.end ? fmt(e.date) + '~' + fmt(e.end) : fmt(e.date);
        return h('div', { class: 'ev' }, [h('div', { class: 'ev-main' }, [h('div', { class: 'ev-title', text: e.title }), h('div', { class: 'ev-sub' }, [h('b', { text: when }), e.note ? ' · ' + e.note : ''])]), ddayBadge(e)]);
      }) : [h('div', { class: 'empty', text: '이 날은 일정이 없어요.' })];
      wrap.appendChild(top);
      wrap.appendChild(h('div', { class: 'card-b' }, [grid, h('div', { class: 'cal-list-t', text: title })].concat(rows)));
    }
    draw();
    return wrap;
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
  var pushTimer = null;
  function pushScores() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      storedKey().then(function (key) {
        if (!key) return;
        return encryptJSON(key, gcLoad()).then(function (blob) {
          return fetch('/api/scores', { method: 'PUT', headers: { authorization: 'Bearer ' + (load('tok26') || ''), 'content-type': 'application/json' }, body: JSON.stringify(blob) });
        });
      }).catch(function () {});
    }, 800);
  }
  function syncScores() {
    return storedKey().then(function (key) {
      if (!key) return false;
      return fetch('/api/scores', { headers: { authorization: 'Bearer ' + (load('tok26') || '') }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return false;
          if (!j.blob) { if (Object.keys(gcLoad()).length) pushScores(); return true; }
          return decryptJSON(key, j.blob).then(function (srv) {
            var merged = Object.assign({}, gcLoad(), srv); gcSave(merged);
            if (JSON.stringify(merged) !== JSON.stringify(srv)) pushScores();
            return true;
          });
        }).catch(function () { return false; });
    });
  }

  // ---------- 등급컷 (gradecut 계산 로직을 내장) ----------
  var GC = null, GC_STATE = 'idle', GC_SYNC = false, GKEY = 'gcscore26';
  function gcLoad() { try { return JSON.parse(localStorage.getItem(GKEY) || '{}'); } catch (e) { return {}; } }
  function gcSave(o) { try { localStorage.setItem(GKEY, JSON.stringify(o)); } catch (e) {} }
  function loadGrade() {
    var p = document.getElementById('panel-grade');
    if (GC_STATE === 'loading' || GC_STATE === 'done') return;
    GC_STATE = 'loading'; clear(p);
    p.appendChild(h('div', { class: 'card' }, [h('div', { class: 'card-b' }, [h('div', { class: 'empty', text: '등급컷을 불러오는 중이에요…' })])]));
    fetch('/api/cuts', { headers: { authorization: 'Bearer ' + (load('tok26') || '') }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { GC = j; return syncScores().then(function (ok) { GC_SYNC = ok; GC_STATE = 'done'; renderGrade(); }); })
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
      h('div', { class: 'note-sm', text: (GC_SYNC ? '🔒 내 점수는 내 비밀번호로 암호화돼 저장돼요. 다른 기기에서도 보이고, 서버·관리자는 내용을 읽을 수 없어요.' : '내 점수는 이 기기에만 저장돼요. (다시 로그인하면 암호화 저장·동기화가 켜져요)') + (asof ? ' · 업데이트 ' + asof : '') }),
      h('a', { class: 'linkbtn', href: 'https://bldoijoa01-lab.github.io/gradecut/', target: '_blank', rel: 'noopener', text: '기말 목표 계산기 등 전체 기능은 원본 사이트 ↗' })
    ])]));
    var chips = null;
    if (exams.length > 1) {
      chips = h('div', { class: 'jump' });
      exams.forEach(function (ex) {
        var b = h('button', { class: 'jump-b', type: 'button', text: ex, 'aria-pressed': ex === exam ? 'true' : 'false' });
        b.addEventListener('click', function () { exam = ex; Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); drawList(); });
        chips.appendChild(b);
      });
      p.appendChild(chips);
    }
    p.appendChild(summary); p.appendChild(list);

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
      var subs = GC.subjects.filter(function (s) { return s.exam === exam; })
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
    var upcoming = DATA.events.filter(function (e) { return diffDays(e.end || e.date, TODAY) >= 0; })
      .sort(function (a, b) { return toUTC(a.date) - toUTC(b.date); });
    var hot = upcoming.filter(function (e) { return diffDays(e.date, TODAY) <= 7; });
    var rest = upcoming.filter(function (e) { return diffDays(e.date, TODAY) > 7; });

    // 포스터식 요소: 오늘 체크 띠 + 스타버스트(가장 가까운 일정)
    var nx = upcoming[0], burst = document.getElementById('burst');
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
      var main = h('div', { class: 'ev-main' }, [h('div', { class: 'ev-title', text: e.title }), sub]);
      if (e.tracks) {
        main.appendChild(h('div', { class: 'tracks' }, e.tracks.map(function (t) {
          var cls = { '물리': 'phys', '의생명': 'bio', '화학': 'chem' }[t.name] || 'phys';
          return h('div', { class: 'track' }, [h('span', { class: 'chip ' + cls, text: t.name }),
            h('div', null, [h('div', { text: t.topic }), h('div', { class: 'names', text: t.members.join(' ') })])]);
        })));
      }
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
    calCard.hidden = true;
    var seg = h('div', { class: 'seg' });
    [['목록', listCard], ['캘린더', calCard]].forEach(function (v, i) {
      var b = h('button', { class: 'seg-b', type: 'button', text: v[0], 'aria-pressed': i === 0 ? 'true' : 'false' });
      b.addEventListener('click', function () {
        listCard.hidden = v[1] !== listCard; calCard.hidden = v[1] !== calCard;
        Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
      seg.appendChild(b);
    });
    p.appendChild(seg); p.appendChild(listCard); p.appendChild(calCard);
  }

  // ---------- 기말 시간표 ----------
  function renderTable() {
    var p = document.getElementById('panel-exam');
    var ex = DATA.exam;
    var thead = h('tr', null, [h('th', { text: '' })].concat(ex.days.map(function (d) {
      return h('th', { class: diffDays(d.date, TODAY) === 0 ? 'today' : '', text: d.label });
    })));
    var rows = ex.periods.map(function (per, pi) {
      var tr = h('tr', null, [h('th', null, [per.name, h('small', { text: per.time })])]);
      ex.days.forEach(function (d) {
        var c = d.cells[pi];
        tr.appendChild(h('td', { class: 'k-' + c.k + (diffDays(d.date, TODAY) === 0 ? ' today' : ''), text: c.t }));
      });
      return tr;
    });
    var table = h('table', { class: 'tt' }, [h('thead', null, [thead]), h('tbody', null, rows)]);
    var morning = ex.morning.map(function (m) { return m.name + ' ' + m.time; }).join(' · ');
    var body = [
      h('div', { class: 'scroll-hint', text: '← 옆으로 밀어서 보기 →' }),
      h('div', { class: 'tt-wrap' }, [table]),
      h('div', { class: 'legend' }, [
        h('span', { class: 'lg' }, [h('i', { style: 'background:var(--blue-t)' }), '공통']),
        h('span', { class: 'lg' }, [h('i', { style: 'background:var(--green-t)' }), '선택 ( / = 둘 중 내 과목 )']),
        h('span', { class: 'lg' }, [h('i', { style: 'background:var(--gray-t)' }), '자습'])
      ]),
      h('div', { class: 'note-sm' }, [morning + ' · 점심 있음 (', h('b', { text: fmt(ex.noLunchDate) + '만 점심 없음' }), ')'])
    ];
    p.appendChild(h('div', { class: 'card' }, [head('EXAM TIMETABLE', '2학기 기말고사 시간표 (2학년)'), h('div', { class: 'card-b' }, body)]));
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
      numOut,
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
    var who = document.getElementById('who'); who.hidden = false; who.textContent = DATA.me.name + ' · ' + DATA.me.n + '번';
    var d = new Date(TODAY);
    document.getElementById('todayLabel').textContent = (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + DOW[d.getUTCDay()] + ')';
    document.getElementById('updated').textContent = DATA.className + ' 알림장 · 마지막 업데이트 ' + fmt(DATA.updated);
    clear(document.getElementById('panel-exam'));
    renderHome(); renderToday(); renderExamJump(); renderTable(); renderMove(); renderCaution();
    tagExamCards();
    var start = (location.hash || '').replace('#', '');
    start = { table: 'exam', move: 'exam', caution: 'exam' }[start] || start;
    selectTab(['home', 'today', 'exam', 'grade'].indexOf(start) >= 0 ? start : 'home');
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
        else { store('tok26', j.token); rememberKey(pwIn.value, parseInt(numIn.value, 10)).then(loadData); }
      }).catch(function () { btn.disabled = false; err.textContent = '연결에 실패했어요. 다시 시도하세요.'; });
    }
    btn.addEventListener('click', go);
    pwIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    card([h('div', { class: 'login-brand' }, [h('span', { class: 'logo', text: '6' }), h('b', { text: '2-6 알림장' })]), h('div', { class: 'login-sub', text: '우리 반 전용이에요. 이름·번호·비밀번호를 입력하세요. 처음이면 비밀번호 칸에 반 코드를 넣으세요.' }), nameIn, numIn, pwIn, btn, err]);
  }

  function showSetup(setupToken, num) {
    var p1 = h('input', { type: 'password', class: 'login-in', placeholder: '새 비밀번호 (6자 이상)', autocomplete: 'new-password' });
    var p2 = h('input', { type: 'password', class: 'login-in', placeholder: '새 비밀번호 확인', autocomplete: 'new-password' });
    var err = h('div', { class: 'empty', text: '' });
    var btn = h('button', { class: 'btn', type: 'button', text: '비밀번호 정하고 입장' });
    function go() {
      if (p1.value.length < 6) { err.textContent = '6자 이상으로 정하세요.'; return; }
      if (p1.value !== p2.value) { err.textContent = '두 번 입력한 비밀번호가 달라요.'; return; }
      btn.disabled = true;
      api('/api/setpw', { token: setupToken, password: p1.value }).then(function (j) {
        if (j.status === 200) { store('tok26', j.token); rememberKey(p1.value, num).then(loadData); }
        else { btn.disabled = false; err.textContent = '시간이 지났어요. 처음부터 다시 입장하세요.'; }
      }).catch(function () { btn.disabled = false; err.textContent = '연결에 실패했어요.'; });
    }
    btn.addEventListener('click', go);
    p2.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    card([h('div', { class: 'login-brand' }, [h('span', { class: 'logo', text: '6' }), h('b', { text: '비밀번호 설정' })]), h('div', { class: 'login-sub', text: '반 코드 확인 완료! 나만의 비밀번호를 정하세요. 다음부터는 이 비밀번호로 입장해요. (잊어버리면 담당자에게 초기화 요청)' }), p1, p2, btn, err]);
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
