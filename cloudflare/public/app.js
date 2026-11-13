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
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { selectTab(t.getAttribute('data-tab')); }); });

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

  // ---------- 오늘 ----------
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
    p.appendChild(h('div', { class: 'card' }, [head('SCHEDULE', '수행·시험 일정'), h('div', { class: 'card-b' }, body)]));
  }

  // ---------- 기말 시간표 ----------
  function renderTable() {
    var p = document.getElementById('panel-table'); clear(p);
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

  // ---------- 이동교실 ----------
  function renderMove() {
    var p = document.getElementById('panel-move'); clear(p);
    var mv = DATA.move;

    // 1) 원반 이동 계산기
    var numIn = h('input', { class: 'field', id: 'numIn', type: 'number', inputmode: 'numeric', min: '1', max: '40', placeholder: '번호', 'aria-label': '내 번호' });
    var numOut = h('div', { class: 'result none', id: 'numOut', 'aria-live': 'polite', text: '내 번호를 넣어봐 👆' });
    function calcNum() {
      var n = parseInt(numIn.value, 10);
      numOut.className = 'result';
      clear(numOut);
      if (!n || n < 1) { numOut.className = 'result none'; numOut.textContent = '내 번호를 넣어봐 👆'; return; }
      if (n <= mv.frontCount) {
        numOut.classList.add('go');
        numOut.appendChild(h('strong', { text: n + '번 → ' + mv.otherRoom + ' 교실로 이동!' }));
        numOut.appendChild(document.createTextNode(mv.moveTime + ' 사이에 이동 (1교시 시작 10분 전까지 도착). 책상 번호순 착석.'));
        numOut.appendChild(h('div', { class: 'note-sm', style: 'margin-top:6px', text: '※ 빈 번호(자퇴·전출 등)가 있으면 앞번호 컷이 밀려요. 애매하면 담임쌤께 확인!' }));
      } else {
        numOut.classList.add('stay');
        numOut.appendChild(h('strong', { text: n + '번 → 우리 교실(' + mv.ownRoom + ') 그대로!' }));
        numOut.appendChild(document.createTextNode('1학년 6반 앞번호 ' + mv.frontCount + '명이 우리 교실로 와요.'));
      }
    }
    numIn.addEventListener('input', calcNum);

    p.appendChild(h('div', { class: 'card' }, [head('MOVING ROOM', '① 원반 이동 (2-6 ↔ 1-6)'), h('div', { class: 'card-b' }, [
      h('div', { class: 'field-row' }, [h('label', { class: 'field-lab', for: 'numIn', text: '내 번호' }), numIn]),
      numOut,
      h('ul', { class: 'rules' }, mv.rules.map(function (r) { return h('li', { text: r }); }))
    ])]));

    // 2) 특별실 조회
    var nameIn = h('input', { class: 'field wide', id: 'nameIn', type: 'search', placeholder: '내 이름 (예: 김가빈)', autocomplete: 'off', 'aria-label': '내 이름' });
    var nameOut = h('div', { class: 'result none', id: 'nameOut', 'aria-live': 'polite', text: '이름을 넣으면 특별실 응시 여부를 알려줘요.' });
    var list = h('div', { id: 'spList' });
    function spRows(q) {
      clear(list);
      DATA.special.forEach(function (s) {
        var hit = q && s.members.some(function (m) { return m.indexOf(q) !== -1; });
        var chipCls = s.room.indexOf('외국어') === 0 ? 'ext' : 'pub';
        list.appendChild(h('div', { class: 'sp-row' }, [
          h('div', { class: 'sp-top' }, [h('span', { class: 'sp-sub', text: s.subject }), h('span', { class: 'chip ' + chipCls, text: s.room })]),
          h('div', { class: 'sp-when', text: s.label + ' 시작' }),
          h('div', { class: 'sp-names' }, s.members.map(function (m, i) {
            var on = q && m.indexOf(q) !== -1;
            return h('span', { class: on ? 'hl' : '' }, [m + (i < s.members.length - 1 ? ' ' : '')]);
          }))
        ]));
      });
    }
    function calcName() {
      var q = nameIn.value.trim();
      spRows(q);
      clear(nameOut);
      if (!q) { nameOut.className = 'result none'; nameOut.textContent = '이름을 넣으면 특별실 응시 여부를 알려줘요.'; return; }
      var mine = DATA.special.filter(function (s) { return s.members.some(function (m) { return m.indexOf(q) !== -1; }); });
      if (!mine.length) { nameOut.className = 'result none'; nameOut.textContent = q + ' → 특별실 응시 과목 없음 (원반 이동 규칙만 확인!)'; return; }
      nameOut.className = 'result sp';
      mine.forEach(function (s) {
        nameOut.appendChild(h('strong', { text: s.subject + ' → 4층 ' + s.room }));
        nameOut.appendChild(h('div', { text: s.label + ' 시작' }));
      });
    }
    nameIn.addEventListener('input', calcName);
    spRows('');

    p.appendChild(h('div', { class: 'card' }, [head('SPECIAL ROOM', '② 특별실(4층) 응시 · 우리 반 명단'), h('div', { class: 'card-b' }, [
      nameIn, nameOut, list, h('div', { class: 'callout', text: DATA.specialNote })
    ])]));
  }

  // ---------- 유의사항 ----------
  function renderCaution() {
    var p = document.getElementById('panel-caution'); clear(p);
    p.appendChild(h('div', { class: 'card' }, [head('NOTICE', '시험 유의사항'), h('div', { class: 'card-b' },
      DATA.cautions.map(function (c) {
        return h('div', { class: 'cau' }, [h('div', null, [h('div', { class: 'cau-t', text: c.t }), h('div', { class: 'cau-s', text: c.s })])]);
      }))]));
  }

  // ---------- init ----------
  function init(data) {
    DATA = data;
    document.body.classList.remove('locked');
    var d = new Date(TODAY);
    document.getElementById('todayLabel').textContent = (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '(' + DOW[d.getUTCDay()] + ')';
    document.getElementById('updated').textContent = DATA.className + ' 알림장 · 마지막 업데이트 ' + fmt(DATA.updated);
    renderToday(); renderTable(); renderMove(); renderCaution();
    var start = (location.hash || '').replace('#', '');
    selectTab(['today', 'table', 'move', 'caution'].indexOf(start) >= 0 ? start : 'today');
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
        else if (j.setup) showSetup(j.token);
        else { store('tok26', j.token); loadData(); }
      }).catch(function () { btn.disabled = false; err.textContent = '연결에 실패했어요. 다시 시도하세요.'; });
    }
    btn.addEventListener('click', go);
    pwIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    card([h('div', { class: 'login-brand' }, [h('span', { class: 'logo', text: '6' }), h('b', { text: '2-6 알림장' })]), h('div', { class: 'login-sub', text: '우리 반 전용이에요. 이름·번호·비밀번호를 입력하세요. 처음이면 비밀번호 칸에 반 코드를 넣으세요.' }), nameIn, numIn, pwIn, btn, err]);
  }

  function showSetup(setupToken) {
    var p1 = h('input', { type: 'password', class: 'login-in', placeholder: '새 비밀번호 (6자 이상)', autocomplete: 'new-password' });
    var p2 = h('input', { type: 'password', class: 'login-in', placeholder: '새 비밀번호 확인', autocomplete: 'new-password' });
    var err = h('div', { class: 'empty', text: '' });
    var btn = h('button', { class: 'btn', type: 'button', text: '비밀번호 정하고 입장' });
    function go() {
      if (p1.value.length < 6) { err.textContent = '6자 이상으로 정하세요.'; return; }
      if (p1.value !== p2.value) { err.textContent = '두 번 입력한 비밀번호가 달라요.'; return; }
      btn.disabled = true;
      api('/api/setpw', { token: setupToken, password: p1.value }).then(function (j) {
        if (j.status === 200) { store('tok26', j.token); loadData(); }
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
