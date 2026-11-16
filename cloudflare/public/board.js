// 수업 의견 보드 — 전자칠판에 띄우는 전체화면. 학생이 올린 의견이 말풍선으로 붕 떠올라 자리를 잡고 둥둥 떠 있음.
// 사용: Board26.show({ power: true|false }) / 교사·관리자만 power (질문 설정·열기/닫기·비우기·삭제)
(function () {
  var COLORS = [['#FFE08A', '#5A4300'], ['#FFB4C8', '#6B1230'], ['#B8E4FF', '#0B3B5C'], ['#C9F2C0', '#164A1A'], ['#E3CCFF', '#3F1A70'], ['#FFD0A8', '#6A3000'], ['#B5F0E6', '#0A4D44'], ['#FFC2F0', '#5E1550']];
  var cur = null;   // 이미 열려 있으면 중복 방지
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function tok() { try { return localStorage.getItem('tok26') || ''; } catch (e) { return ''; } }
  function api(act, body) {
    return fetch('/api/board/' + act, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + tok(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { j._ok = r.ok; j._st = r.status; return j; }); });
  }
  var reduce = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };

  function show(opts) {
    if (cur) return; opts = opts || {};
    var power = !!opts.power, root = el('div', 'bd-root'), stage = el('div', 'bd-stage'), empty = el('div', 'bd-empty');
    var topic = el('h1', 'bd-topic'), chip = el('span', 'bd-chip'), tools = el('div', 'bd-tools'), how = el('div', 'bd-how');
    how.appendChild(document.createTextNode('📱 폰으로 알림장 접속 → 홈의 ')); how.appendChild(el('b', null, '💬 수업 의견')); how.appendChild(document.createTextNode('에서 올려요'));
    var top = el('div', 'bd-top'), tl = el('div', 'bd-tl'); tl.appendChild(chip); tl.appendChild(topic); tl.appendChild(how); top.appendChild(tl); top.appendChild(tools);
    empty.appendChild(el('div', 'bd-empty-e', '💬')); empty.appendChild(el('div', 'bd-empty-t', '아직 의견이 없어요')); empty.appendChild(el('div', 'bd-empty-s', '폰에서 의견을 올리면 여기에 말풍선으로 떠올라요!'));
    root.appendChild(top); root.appendChild(stage); root.appendChild(empty);
    var bubbles = {}, order = [], slots = [], timer = null, state = { open: false, topic: '', msgs: [] }, alive = true, first = true;

    function layout() {   // 화면을 칸으로 나눠서 말풍선 자리를 정함 (가장자리·제목 영역에 걸리지 않게 안쪽 여백을 둠)
      var w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight * 0.8;
      var cols = w > 1500 ? 4 : w > 1000 ? 3 : w > 640 ? 3 : 2, rows = h > 1000 ? 4 : h > 480 ? 3 : 2, out = [];
      var px = 4, pw = 100 - px * 2, py = 12, ph = 76;   // 가로 4% 여백, 세로 12%~88% 안쪽
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) out.push({ x: px + (c + 0.5) / cols * pw, y: py + (r + 0.5) / rows * ph, w: w * pw / 100 / cols });
      var seed = 7; out.sort(function (a, b) { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280) - 0.5; });
      slots = out;
    }
    function freeSlot() {
      var used = {}; order.forEach(function (id) { var b = bubbles[id]; if (b) used[b.slot] = 1; });
      for (var i = 0; i < slots.length; i++) if (!used[i]) return i;
      return -1;
    }
    function retire(id, instant) {
      var b = bubbles[id]; if (!b) return; delete bubbles[id]; order = order.filter(function (x) { return x !== id; });
      if (instant || reduce() || !b.pos.animate) { b.pos.remove(); return; }
      var a = b.pos.animate([{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }, { opacity: 0, transform: 'translate3d(0,-40vh,0) scale(.7)' }], { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      a.onfinish = function () { b.pos.remove(); };
    }
    function spawn(m, instant) {
      var si = freeSlot();
      if (si < 0) { retire(order[0]); si = freeSlot(); if (si < 0) si = Math.floor(Math.random() * slots.length); }
      var s = slots[si] || { x: 50, y: 50, w: 300 }, col = COLORS[m.c % COLORS.length];
      var pos = el('div', 'bd-pos'), fl = el('div', 'bd-fl'), b = el('div', 'bd-b');
      var jx = (Math.random() - 0.5) * 2.5, jy = (Math.random() - 0.5) * 3;
      pos.style.left = (s.x + jx) + '%'; pos.style.top = (s.y + jy) + '%';
      b.style.background = col[0]; b.style.color = col[1]; b.style.maxWidth = Math.max(180, s.w * 0.86) + 'px';
      b.style.setProperty('--tail', col[0]); b.style.animationDuration = (3.4 + Math.random() * 2.4) + 's'; b.style.animationDelay = (-Math.random() * 3) + 's';
      var len = m.text.length; b.style.fontSize = (len <= 12 ? 'clamp(22px,2.6vw,42px)' : len <= 30 ? 'clamp(19px,2.05vw,32px)' : 'clamp(16px,1.75vw,27px)');
      b.appendChild(el('div', 'bd-n', m.name)); b.appendChild(el('div', 'bd-t', m.text));
      fl.appendChild(b); pos.appendChild(fl); stage.appendChild(pos);
      bubbles[m.id] = { pos: pos, slot: si, msg: m }; order.push(m.id);
      if (power) pos.addEventListener('click', function (ev) { ev.stopPropagation(); selectBubble(m.id); });
      if (!instant && !reduce() && pos.animate) {   // 아래에서 붕~ 떠올라 자리 잡기
        pos.animate([{ opacity: 0, transform: 'translate3d(0,62vh,0) scale(.35)' }, { opacity: 1, transform: 'translate3d(0,-1.5vh,0) scale(1.12)', offset: .72 }, { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }], { duration: 1250, easing: 'cubic-bezier(.22,1,.36,1)' });
        b.classList.add('new'); setTimeout(function () { b.classList.remove('new'); }, 2600);
      }
    }
    var selEl = null;
    function selectBubble(id) {
      if (selEl) { selEl.remove(); selEl = null; }
      var bb = bubbles[id]; if (!bb) return;
      var box = el('div', 'bd-sel'), who = el('span', null, '작성: ' + (bb.msg.by || bb.msg.name) + (bb.msg.anon ? ' (익명)' : '')), del = el('button', null, '🗑 삭제');
      del.type = 'button'; del.addEventListener('click', function (ev) { ev.stopPropagation(); box.remove(); selEl = null; api('ctl', { action: 'delete', id: id }).then(poll); });
      box.appendChild(who); box.appendChild(del); bb.pos.appendChild(box); selEl = box;
    }
    stage.addEventListener('click', function () { if (selEl) { selEl.remove(); selEl = null; } });

    function paintHead() {
      topic.textContent = state.topic || (power ? '질문을 정해 보세요 (⚙ 설정)' : '수업 의견을 올려 주세요');
      chip.textContent = state.open ? '🟢 의견 받는 중' : '⏸ 닫힘'; chip.className = 'bd-chip' + (state.open ? ' on' : '');
      empty.style.display = Object.keys(bubbles).length ? 'none' : 'flex';
      if (btnOpen) btnOpen.textContent = state.open ? '⏸ 받기 닫기' : '▶ 받기 열기';
    }
    function apply(j) {
      state = { open: j.open, topic: j.topic, msgs: j.msgs };
      var ids = {}; j.msgs.forEach(function (m) { ids[m.id] = m; });
      Object.keys(bubbles).forEach(function (id) { if (!ids[id]) retire(id); });   // 삭제·비우기
      var fresh = j.msgs.filter(function (m) { return !bubbles[m.id]; });
      if (first) { fresh = fresh.slice(-slots.length); first = false; fresh.forEach(function (m, i) { setTimeout(function () { if (alive && !bubbles[m.id]) { spawn(m, false); paintHead(); } }, i * 160); }); }
      else fresh.forEach(function (m, i) { setTimeout(function () { if (alive && !bubbles[m.id]) { spawn(m, false); paintHead(); } }, i * 450); });
      paintHead();
    }
    function poll() { return api('state').then(function (j) { if (!alive) return; if (j._ok) { root.classList.remove('off'); apply(j); } else root.classList.add('off'); }).catch(function () { root.classList.add('off'); }); }

    var btnOpen = null;
    function tbtn(label, fn) { var b = el('button', 'bd-btn', label); b.type = 'button'; b.addEventListener('click', fn); tools.appendChild(b); return b; }
    if (power) {
      tbtn('⚙ 질문', function () { var t = window.prompt('이번 수업 질문/주제 (60자까지)', state.topic || ''); if (t !== null) api('ctl', { action: 'topic', topic: t }).then(poll); });
      btnOpen = tbtn('▶ 받기 열기', function () { api('ctl', { action: state.open ? 'close' : 'open' }).then(poll); });
      tbtn('🧹 비우기', function () { if (window.confirm('보드의 의견을 모두 지울까요?')) api('ctl', { action: 'clear' }).then(poll); });
    }
    tbtn('⛶', function () { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen().catch(function () {}); }).setAttribute('aria-label', '전체화면');
    tbtn('✕ 나가기', close);
    function close() {
      alive = false; clearInterval(timer); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      root.remove(); cur = null; if (opts.onExit) opts.onExit();
    }
    function onKey(e) { if (e.key === 'Escape' && !document.fullscreenElement) close(); }
    function onResize() { layout(); }
    document.addEventListener('keydown', onKey); window.addEventListener('resize', onResize);
    document.body.appendChild(root); layout(); paintHead();
    poll(); timer = setInterval(poll, 1800);
    cur = { close: close };
  }
  window.Board26 = { show: show, api: api };
})();
