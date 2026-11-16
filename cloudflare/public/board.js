// 수업 의견 보드 — 전자칠판에 띄우는 전체화면.
// 학생이 올린 의견이 말풍선이 되어 아래에서 "부력"으로 떠올라 천장에서부터 차곡차곡 쌓입니다.
// 위에 다른 말풍선이 있으면 그 아래에서 멈추고, 화면이 가득 차면 가장 오래된 것이 터져서 나머지가 다시 떠오릅니다.
// 사용: Board26.show({ power: true|false }) / 교사·관리자·전자칠판 계정만 power (질문 설정·열기/닫기·비우기·삭제)
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

  // ---- 물리 상수 (px, 초 단위) ----
  var BUOY = 620, DRAG = 2.6, GAP = 12, MARGIN = 14, MAXLIST = 40, FLING = 2600;

  function show(opts) {
    if (cur) return; opts = opts || {};
    var power = !!opts.power, root = el('div', 'bd-root'), stage = el('div', 'bd-stage'), empty = el('div', 'bd-empty');
    var topic = el('h1', 'bd-topic'), chip = el('span', 'bd-chip'), tools = el('div', 'bd-tools'), how = el('div', 'bd-how');
    how.appendChild(document.createTextNode('📱 폰으로 알림장 접속 → 홈의 ')); how.appendChild(el('b', null, '💬 수업 의견')); how.appendChild(document.createTextNode('에서 올려요'));
    var top = el('div', 'bd-top'), tl = el('div', 'bd-tl'); tl.appendChild(chip); tl.appendChild(topic); tl.appendChild(how); top.appendChild(tl); top.appendChild(tools);
    empty.appendChild(el('div', 'bd-empty-e', '💬')); empty.appendChild(el('div', 'bd-empty-t', '아직 의견이 없어요')); empty.appendChild(el('div', 'bd-empty-s', '폰에서 의견을 올리면 여기로 떠올라요!'));
    root.appendChild(top); root.appendChild(stage); root.appendChild(empty);
    var bubbles = {}, list = [], timer = null, state = { open: false, topic: '', msgs: [] }, alive = true, first = true, raf = 0, lastT = 0, lastRetire = 0, selEl = null;

    function size() { return { w: stage.clientWidth || window.innerWidth, h: stage.clientHeight || Math.round(window.innerHeight * 0.8) }; }

    // ---------- 말풍선 만들기 ----------
    function spawn(m, instant) {
      var S = size(), col = COLORS[m.c % COLORS.length], b = el('div', 'bd-b'), len = m.text.length;
      b.style.background = col[0]; b.style.color = col[1]; b.style.setProperty('--tail', col[0]);
      b.style.maxWidth = Math.max(200, Math.min(S.w * 0.3, 560)) + 'px';
      b.style.fontSize = (len <= 12 ? 'clamp(22px,2.6vw,42px)' : len <= 30 ? 'clamp(19px,2.05vw,32px)' : 'clamp(16px,1.75vw,27px)');
      b.appendChild(el('div', 'bd-n', m.name)); b.appendChild(el('div', 'bd-t', m.text));
      stage.appendChild(b);
      var w = b.offsetWidth, h = b.offsetHeight + 14;   // 꼬리 높이만큼 여유
      var o = { id: m.id, msg: m, el: b, w: w, h: h, x: w / 2 + MARGIN + Math.random() * Math.max(1, S.w - w - MARGIN * 2), y: S.h + h / 2 + 30, vx: (Math.random() - 0.5) * 60, vy: -140 - Math.random() * 80, ph: Math.random() * 6.28, born: performance.now(), dead: false };
      if (instant || reduce()) { o.y = h / 2 + MARGIN; o.vy = 0; }
      bubbles[m.id] = o; list.push(o);
      b.classList.add('new'); setTimeout(function () { b.classList.remove('new'); }, 2600);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (o.moved) { o.moved = false; return; } if (power) selectBubble(m.id); });
      grab(o); place(o); kick();
    }
    // 끌어서 날리기: 잡으면 손가락을 따라오고, 놓으면 손의 속도로 날아가 벽에 튕기다가 다시 부력으로 떠오름
    function grab(o) {
      var b = o.el, id = null, ox = 0, oy = 0, sx = 0, sy = 0, hist = [];
      b.style.touchAction = 'none';
      b.addEventListener('pointerdown', function (ev) {
        if (id !== null || (ev.button && ev.button !== 0) || ev.target.closest('.bd-sel')) return;
        id = ev.pointerId; try { b.setPointerCapture(id); } catch (e) {}
        var r = stage.getBoundingClientRect(); ox = ev.clientX - r.left - o.x; oy = ev.clientY - r.top - o.y; sx = ev.clientX; sy = ev.clientY;
        o.drag = true; o.moved = false; o.sa = 'y'; o.sqv = 6; o.vx = 0; o.vy = 0; hist = [[performance.now(), ev.clientX, ev.clientY]]; b.classList.add('held'); kick();
      });
      b.addEventListener('pointermove', function (ev) {
        if (ev.pointerId !== id) return;
        var r = stage.getBoundingClientRect(), S = size(), now = performance.now();
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 8) o.moved = true;
        o.x = Math.max(MARGIN + o.w / 2, Math.min(S.w - MARGIN - o.w / 2, ev.clientX - r.left - ox));
        o.y = Math.max(MARGIN + o.h / 2, Math.min(S.h - MARGIN - o.h / 2, ev.clientY - r.top - oy));
        hist.push([now, ev.clientX, ev.clientY]); while (hist.length > 2 && now - hist[0][0] > 90) hist.shift();
        place(o);
      });
      function release(ev) {
        if (ev.pointerId !== id) return; id = null; o.drag = false; b.classList.remove('held');
        var f = hist[0], l = hist[hist.length - 1], dt = Math.max(16, l[0] - f[0]) / 1000;
        if (o.moved && hist.length > 1 && performance.now() - l[0] < 120) {
          o.vx = Math.max(-FLING, Math.min(FLING, (l[1] - f[1]) / dt)); o.vy = Math.max(-FLING, Math.min(FLING, (l[2] - f[2]) / dt)); o.entered = true; o.sa = Math.abs(o.vx) > Math.abs(o.vy) ? 'x' : 'y'; o.sqv = -9;   // 놓는 순간 쭉 늘어났다가 출발
        } else { o.vx = 0; o.vy = 0; o.sqv = -5; }
        kick();
      }
      b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release);
    }
    function place(o) {
      var sx = 1, sy = 1, q = Math.max(-0.5, Math.min(0.5, o.sq || 0));   // 찌부: q>0이면 부딪힌 축으로 납작해지고 반대로 퉁퉁해짐 (부피 유지)
      if (o.sa === 'x') { sx = 1 - q * 0.55; sy = 1 + q * 0.55; } else { sy = 1 - q * 0.55; sx = 1 + q * 0.55; }
      o.el.style.transform = 'translate3d(' + (o.x - o.w / 2).toFixed(1) + 'px,' + (o.y - o.h / 2).toFixed(1) + 'px,0) rotate(' + Math.max(-9, Math.min(9, o.vx * 0.04)).toFixed(2) + 'deg) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    }
    function hit(o, axis, v) {   // 부딪힘 → 찌부러졌다가 통통 튀며 돌아옴
      v = Math.abs(v); if (v < 60) return; o.sa = axis; o.sqv = Math.max(o.sqv || 0, 0) + Math.min(8, v * 0.016);
    }
    function pop(id) {   // 터지며 사라짐
      var o = bubbles[id]; if (!o || o.dead) return; o.dead = true; delete bubbles[id];
      list = list.filter(function (x) { return x !== o; }); o.el.classList.add('pop');
      setTimeout(function () { o.el.remove(); }, 520);
    }

    // ---------- 물리 루프 ----------
    function kick() { if (!raf && alive) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
    function frame(t) {
      raf = 0; if (!alive) return;
      var dt = Math.min(0.05, Math.max(0.001, (t - lastT) / 1000)); lastT = t;
      step(dt, t);
      // 움직임이 남아 있거나 새 말풍선이 있으면 계속
      var busy = list.some(function (o) { return Math.abs(o.vy) > 2 || Math.abs(o.vx) > 2; });
      if (busy || list.length) raf = requestAnimationFrame(frame);
    }
    function step(dt, t) {
      var mv = 0, n, i; for (i = 0; i < list.length; i++) mv = Math.max(mv, Math.abs(list[i].vx), Math.abs(list[i].vy));
      n = Math.max(1, Math.min(6, Math.ceil(mv * dt / 30)));   // 빨리 날아가는 말풍선이 다른 걸 뚫고 지나가지 않게 잘게 나눠 계산
      for (i = 0; i < n; i++) sub(dt / n, t);
      var S = size(); list.forEach(place);
      list.forEach(function (o) { if (!o.drag && Math.abs(o.vy) < 12 && o.y + o.h / 2 > S.h - 18) o.low = (o.low || 0) + dt; else o.low = 0; });
      // 더미가 화면 아래까지 막혀서 1.6초 넘게 내려와 있으면 가장 오래된 말풍선이 터지고 나머지가 떠오름 (바닥에 잠깐 튕긴 건 제외)
      var blocked = list.some(function (o) { return o.low > 1.6; });
      if ((list.length > MAXLIST || blocked) && t - lastRetire > 700) {
        var oldest = list.filter(function (o) { return !o.drag; }).sort(function (p, q) { return p.id - q.id; })[0]; if (oldest) { lastRetire = t; pop(oldest.id); paintHead(); list.forEach(function (o) { o.low = 0; }); }
      }
    }
    function sub(dt, t) {
      var S = size(), top = MARGIN, i, j, a, b;
      for (i = 0; i < list.length; i++) {
        a = list[i]; if (a.drag) continue;
        a.vy -= BUOY * dt; a.vy -= a.vy * DRAG * dt;                                        // 부력 + 항력
        a.vx += Math.sin(t / 700 + a.ph) * 18 * dt - a.vx * (Math.abs(a.vx) > 120 ? 0.7 : 1.8) * dt;   // 좌우로 살랑살랑 (세게 날린 건 오래 날아감)
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (!a.entered && a.y + a.h / 2 < S.h) a.entered = true;
        a.sqv = (a.sqv || 0) + (-170 * (a.sq || 0) - 9 * (a.sqv || 0)) * dt; a.sq = (a.sq || 0) + a.sqv * dt;   // 찌부 스프링(출렁출렁)
      }
      for (var pass = 0; pass < 3; pass++) {
        for (i = 0; i < list.length; i++) {
          a = list[i]; if (a.drag) continue;
          if (a.y < top + a.h / 2) { a.y = top + a.h / 2; if (a.vy < 0) { hit(a, 'y', a.vy); a.vy = a.vy < -120 ? -a.vy * 0.55 : 0; } }       // 천장: 쿵 하고 튕김
          if (a.entered && a.y > S.h - MARGIN - a.h / 2) { a.y = S.h - MARGIN - a.h / 2; if (a.vy > 0) { hit(a, 'y', a.vy); a.vy = -a.vy * 0.6; } }   // 바닥
          if (a.x < MARGIN + a.w / 2) { a.x = MARGIN + a.w / 2; hit(a, 'x', a.vx); a.vx = Math.abs(a.vx) * 0.72; }
          if (a.x > S.w - MARGIN - a.w / 2) { a.x = S.w - MARGIN - a.w / 2; hit(a, 'x', a.vx); a.vx = -Math.abs(a.vx) * 0.72; }
        }
        for (i = 0; i < list.length; i++) for (j = i + 1; j < list.length; j++) {
          a = list[i]; b = list[j];
          var dx = b.x - a.x, dy = b.y - a.y, ox = (a.w + b.w) / 2 + GAP - Math.abs(dx), oy = (a.h + b.h) / 2 + GAP - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          if (oy <= ox * 1.15) {                                // 위아래로 겹침
            var lo = dy > 0 ? b : a, up = dy > 0 ? a : b, vn = lo.vy - up.vy;   // vn<0: 서로 다가오는 중
            if (lo.drag) { up.y -= oy; if (up.vy < 0) up.vy = 0; continue; }
            if (up.drag) { lo.y += oy; if (lo.vy < 0) lo.vy *= 0.15; continue; }
            if (vn < -90) { var jv = -(1 + 0.55) * vn / 2; lo.vy += jv; up.vy -= jv; hit(lo, 'y', vn); hit(up, 'y', vn); lo.y += oy / 2; up.y -= oy / 2; }   // 세게 부딪히면 통! 하고 서로 튕김
            else { lo.y += oy; if (lo.vy < 0) lo.vy *= 0.15; }
            var side = lo.x - up.x; if (Math.abs(side) < (lo.w + up.w) * 0.25) lo.vx += (side >= 0 ? 1 : -1) * 40 * (1 + Math.random());
          } else {                                              // 좌우로 겹침
            var sg = dx >= 0 ? 1 : -1, vr = (b.vx - a.vx) * sg;   // vr<0: 다가오는 중
            if (a.drag) { b.x += sg * ox; continue; } if (b.drag) { a.x -= sg * ox; continue; }
            a.x -= sg * ox / 2; b.x += sg * ox / 2;
            if (vr < -60) { var jh = -(1 + 0.7) * vr / 2 * sg; b.vx += jh; a.vx -= jh; hit(a, 'x', vr); hit(b, 'x', vr); } else { a.vx = a.vx * 0.4 - sg * 12; b.vx = b.vx * 0.4 + sg * 12; }
          }
        }
      }
    }
    function settleNow() { for (var k = 0; k < 160; k++) step(0.03, k * 30); }   // 애니메이션 줄이기 설정: 바로 쌓인 상태로

    // ---------- 선택(삭제) ----------
    function selectBubble(id) {
      if (selEl) { selEl.remove(); selEl = null; }
      var o = bubbles[id]; if (!o) return;
      var box = el('div', 'bd-sel'), who = el('span', null, '작성: ' + (o.msg.by || o.msg.name) + (o.msg.anon ? ' (익명)' : '')), del = el('button', null, '🗑 삭제');
      del.type = 'button'; del.addEventListener('click', function (ev) { ev.stopPropagation(); box.remove(); selEl = null; api('ctl', { action: 'delete', id: id }).then(poll); });
      box.appendChild(who); box.appendChild(del); o.el.appendChild(box); selEl = box;
    }
    stage.addEventListener('click', function () { if (selEl) { selEl.remove(); selEl = null; } });

    // ---------- 상태 반영 ----------
    function paintHead() {
      topic.textContent = state.topic || (power ? '질문을 정해 보세요 (⚙ 질문)' : '수업 의견을 올려 주세요');
      chip.textContent = state.open ? '🟢 의견 받는 중' : '⏸ 닫힘'; chip.className = 'bd-chip' + (state.open ? ' on' : '');
      empty.style.display = list.length ? 'none' : 'flex';
      if (btnOpen) btnOpen.textContent = state.open ? '⏸ 받기 닫기' : '▶ 받기 열기';
    }
    function apply(j) {
      state = { open: j.open, topic: j.topic, msgs: j.msgs };
      var ids = {}; j.msgs.forEach(function (m) { ids[m.id] = m; });
      Object.keys(bubbles).forEach(function (id) { if (!ids[id]) pop(id); });   // 삭제·비우기
      var fresh = j.msgs.filter(function (m) { return !bubbles[m.id] && !gone[m.id]; });
      if (first) {
        first = false; fresh = fresh.slice(-18);
        fresh.forEach(function (m, i) { setTimeout(function () { if (alive && !bubbles[m.id]) { spawn(m, false); paintHead(); } }, i * 230); });
      } else fresh.forEach(function (m, i) { setTimeout(function () { if (alive && !bubbles[m.id]) { spawn(m, false); paintHead(); } }, i * 600); });
      paintHead();
    }
    var gone = {};   // 가득 차서 터진 말풍선이 다음 폴링에서 되살아나지 않게
    var origPop = pop; pop = function (id) { gone[id] = 1; origPop(id); };
    function poll() { return api('state').then(function (j) { if (!alive) return; if (j._ok) { root.classList.remove('off'); apply(j); } else root.classList.add('off'); }).catch(function () { root.classList.add('off'); }); }

    var btnOpen = null;
    function tbtn(label, fn) { var b = el('button', 'bd-btn', label); b.type = 'button'; b.addEventListener('click', fn); tools.appendChild(b); return b; }
    if (power) {
      tbtn('⚙ 질문', function () { var t = window.prompt('이번 수업 질문/주제 (60자까지)', state.topic || ''); if (t !== null) api('ctl', { action: 'topic', topic: t }).then(poll); });
      btnOpen = tbtn('▶ 받기 열기', function () { api('ctl', { action: state.open ? 'close' : 'open' }).then(poll); });
      tbtn('🧹 비우기', function () { if (window.confirm('보드의 의견을 모두 지울까요?')) api('ctl', { action: 'clear' }).then(function () { gone = {}; poll(); }); });
    }
    tbtn('⛶', function () { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen().catch(function () {}); }).setAttribute('aria-label', '전체화면');
    tbtn('✕ 나가기', close);
    function close() {
      alive = false; clearInterval(timer); cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      root.remove(); cur = null; if (opts.onExit) opts.onExit();
    }
    function onKey(e) { if (e.key === 'Escape' && !document.fullscreenElement) close(); }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(root); paintHead();
    poll(); timer = setInterval(poll, 1800);
    cur = { close: close };
    window.Board26._debug = { list: function () { return list; }, settle: settleNow };
  }
  window.Board26 = { show: show, api: api };
})();
