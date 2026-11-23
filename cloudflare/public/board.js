// 수업 의견 보드 — 전자칠판에 띄우는 전체화면.
// 학생이 올린 의견이 말풍선이 되어 아래에서 부드럽게 떠올라 빈틈없이 차곡차곡 쌓입니다.
// 화면이 다 차도 아래로 스크롤해 모든 의견을 볼 수 있습니다.
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

    // ---------- 배치·물리 상수 (px, 초 단위) ----
  var GAP_X = 16, GAP_Y = 20, MARGIN_X = 28, MARGIN_Y = 24, FLING = 2400;

  function show(opts) {
    if (cur) return; opts = opts || {};
    var power = !!opts.power, root = el('div', 'bd-root'), stageWrap = el('div', 'bd-stage-wrap'), stage = el('div', 'bd-stage'), canvas = el('div', 'bd-canvas'), empty = el('div', 'bd-empty');
    var topic = el('h1', 'bd-topic'), chip = el('span', 'bd-chip'), tools = el('div', 'bd-tools'), how = el('div', 'bd-how');
    how.appendChild(document.createTextNode('📱 폰으로 알림장 접속 → 홈의 ')); how.appendChild(el('b', null, '💬 수업 의견')); how.appendChild(document.createTextNode('에서 올려요'));
    var top = el('div', 'bd-top'), tl = el('div', 'bd-tl'); tl.appendChild(chip); tl.appendChild(topic); tl.appendChild(how); top.appendChild(tl); top.appendChild(tools);
    empty.appendChild(el('div', 'bd-empty-e', '💬')); empty.appendChild(el('div', 'bd-empty-t', '아직 의견이 없어요')); empty.appendChild(el('div', 'bd-empty-s', '폰에서 의견을 올리면 여기로 떠올라요!'));
    var nav = el('div', 'bd-nav'), btnMore = el('button', 'bd-nav-btn pulse'), btnTop = el('button', 'bd-nav-btn', '⬆ 맨 위로');
    btnMore.type = 'button'; btnTop.type = 'button'; btnMore.hidden = true; btnTop.hidden = true;
    nav.appendChild(btnMore); nav.appendChild(btnTop);
    var rail = el('div', 'bd-rail'), railUp = el('button', 'bd-rail-btn', '▲'), railTrack = el('div', 'bd-rail-track'), railThumb = el('div', 'bd-rail-thumb'), railDown = el('button', 'bd-rail-btn', '▼');
    railUp.type = 'button'; railDown.type = 'button'; railUp.setAttribute('aria-label', '위로 스크롤'); railDown.setAttribute('aria-label', '아래로 스크롤');
    rail.hidden = true;
    railTrack.appendChild(railThumb); rail.appendChild(railUp); rail.appendChild(railTrack); rail.appendChild(railDown);
    stage.appendChild(canvas);
    stageWrap.appendChild(stage); stageWrap.appendChild(rail);
    root.appendChild(top); root.appendChild(stageWrap); root.appendChild(empty); root.appendChild(nav);

    var bubbles = {}, list = [], timer = null, state = { open: false, topic: '', msgs: [] }, alive = true, first = true, loaded = false, raf = 0, lastT = 0, selEl = null, selBubble = null, canvasH = 0;
    var loader = el('div', 'bd-loading'), ldBubs = el('div', 'bd-ld-bubbles');
    ldBubs.appendChild(el('div', 'bd-ld-b')); ldBubs.appendChild(el('div', 'bd-ld-b')); ldBubs.appendChild(el('div', 'bd-ld-b'));
    loader.appendChild(ldBubs); loader.appendChild(el('div', 'bd-ld-t', '의견 불러오는 중…'));
    root.appendChild(loader);
    function hideLoader() {
      if (loaded) return; loaded = true;
      loader.classList.add('out');
      setTimeout(function () { loader.remove(); }, 380);
    }

    function size() { return { w: stage.clientWidth || window.innerWidth, h: stage.clientHeight || Math.round(window.innerHeight * 0.8) }; }

    function updateScrollUI() {
      var S = size(), st = stage.scrollTop, maxScroll = Math.max(0, canvasH - S.h), belowCount = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i].ty - list[i].h / 4 > st + S.h) belowCount++;
      }
      var remain = maxScroll - st;
      if (remain > 24 && list.length > 0) {
        btnMore.textContent = belowCount > 0 ? '⬇ 아래 의견 더 보기 (' + belowCount + '개)' : '⬇ 아래로 내려 보기';
        btnMore.hidden = false;
      } else {
        btnMore.hidden = true;
      }
      btnTop.hidden = !(st > 40);

      var scrollable = maxScroll > 24 && list.length > 0;
      rail.hidden = !scrollable;
      if (scrollable) {
        railUp.disabled = st <= 2;
        railDown.disabled = st >= maxScroll - 2;
        var trackH = railTrack.clientHeight;
        if (trackH > 0) {
          var thumbH = Math.max(36, Math.round(trackH * (S.h / canvasH)));
          var ratio = Math.min(1, Math.max(0, st / maxScroll));
          var thumbTop = Math.round((trackH - thumbH) * ratio);
          railThumb.style.height = thumbH + 'px';
          railThumb.style.transform = 'translateX(-50%) translateY(' + thumbTop + 'px)';
        }
      }
    }

    btnMore.addEventListener('click', function () { stage.scrollBy({ top: Math.round(size().h * 0.72), behavior: 'smooth' }); });
    btnTop.addEventListener('click', function () { stage.scrollTo({ top: 0, behavior: 'smooth' }); });
    railUp.addEventListener('click', function () { stage.scrollBy({ top: -Math.round(size().h * 0.65), behavior: 'smooth' }); });
    railDown.addEventListener('click', function () { stage.scrollBy({ top: Math.round(size().h * 0.65), behavior: 'smooth' }); });
    stage.addEventListener('scroll', updateScrollUI, { passive: true });

    // 전용 스크롤 레일: 썸 드래그 + 트랙 클릭으로 바로 이동
    var thumbDrag = null;
    railThumb.addEventListener('pointerdown', function (ev) {
      if (ev.button && ev.button !== 0) return;
      ev.stopPropagation();
      thumbDrag = { id: ev.pointerId, sy: ev.clientY, st: stage.scrollTop };
      railThumb.classList.add('drag');
      try { railThumb.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    railThumb.addEventListener('pointermove', function (ev) {
      if (!thumbDrag || ev.pointerId !== thumbDrag.id) return;
      var dy = ev.clientY - thumbDrag.sy;
      var trackRange = Math.max(1, railTrack.clientHeight - railThumb.offsetHeight);
      var maxScroll = Math.max(0, canvasH - size().h);
      var target = Math.max(0, Math.min(maxScroll, thumbDrag.st + (dy / trackRange) * maxScroll));
      try { stage.scrollTo({ top: target, behavior: 'auto' }); } catch (e) { stage.scrollTop = target; }
    });
    function endThumbDrag(ev) {
      if (!thumbDrag || ev.pointerId !== thumbDrag.id) return;
      thumbDrag = null; railThumb.classList.remove('drag');
    }
    railThumb.addEventListener('pointerup', endThumbDrag);
    railThumb.addEventListener('pointercancel', endThumbDrag);
    railTrack.addEventListener('pointerdown', function (ev) {
      if (ev.target === railThumb || (ev.button && ev.button !== 0)) return;
      var r = railTrack.getBoundingClientRect(), thumbH = railThumb.offsetHeight || 36;
      var ratio = Math.max(0, Math.min(1, (ev.clientY - r.top - thumbH / 2) / Math.max(1, r.height - thumbH)));
      var maxScroll = Math.max(0, canvasH - size().h);
      stage.scrollTo({ top: Math.round(ratio * maxScroll), behavior: 'smooth' });
    });

    // 빈 배경을 마우스/펜으로 끌어 위아래 스크롤
    var bgPan = null;
    stage.addEventListener('pointerdown', function (ev) {
      if ((ev.button && ev.button !== 0) || ev.target.closest('.bd-b') || ev.target.closest('.bd-sel')) return;
      if (canvasH <= size().h + 8) return;
      bgPan = { id: ev.pointerId, sy: ev.clientY, st: stage.scrollTop, moved: false };
      try { stage.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    stage.addEventListener('pointermove', function (ev) {
      if (!bgPan || ev.pointerId !== bgPan.id) return;
      var dy = ev.clientY - bgPan.sy;
      if (Math.abs(dy) > 4) bgPan.moved = true;
      try { stage.scrollTo({ top: bgPan.st - dy, behavior: 'auto' }); } catch (e) { stage.scrollTop = bgPan.st - dy; }
    });
    function endBgPan(ev) {
      if (!bgPan || ev.pointerId !== bgPan.id) return;
      if (bgPan.moved) stage._panMoved = true;
      bgPan = null;
    }
    stage.addEventListener('pointerup', endBgPan);
    stage.addEventListener('pointercancel', endBgPan);

    // ---------- 빈틈없는 행 배정 + 스카이라인 배치 ----------
    function relayout(measure) {
      var S = size(), i, j, k;
      if (measure) {
        var maxW = Math.max(200, Math.min(S.w * 0.3, 560));
        for (i = 0; i < list.length; i++) {
          list[i].el.style.maxWidth = maxW + 'px';
          list[i].w = list[i].el.offsetWidth;
          list[i].h = list[i].el.offsetHeight + 14;
        }
      }
      var rightPad = 56, availW = Math.max(240, S.w - MARGIN_X - rightPad);
      var rows = [];
      for (i = 0; i < list.length; i++) {
        var o = list[i];
        if (o.free) {
          o.x = Math.max(MARGIN_X + o.w / 2, Math.min(S.w - rightPad - o.w / 2, o.x));
          o.y = Math.max(MARGIN_Y + o.h / 2, o.y);
          continue;
        }
        var placedRow = null;
        for (j = 0; j < rows.length; j++) {
          var r = rows[j];
          if (r.items.length === 0 || r.width + GAP_X + o.w <= availW) { placedRow = r; break; }
        }
        if (!placedRow) { placedRow = { items: [], width: 0 }; rows.push(placedRow); }
        placedRow.width += (placedRow.items.length ? GAP_X : 0) + o.w;
        placedRow.items.push(o);
      }

      for (i = 0; i < rows.length; i++) {
        var row = rows[i];
        var slack = Math.max(0, availW - row.width);
        var extraGap = row.items.length > 1 ? Math.min(20, slack * 0.22 / (row.items.length - 1)) : 0;
        var rowW = row.width + extraGap * (row.items.length - 1);
        var shift = (i % 2 === 1 ? 1 : -1) * Math.min(16, Math.max(0, availW - rowW) * 0.14);
        var curX = MARGIN_X + (availW - rowW) / 2 + shift;
        for (j = 0; j < row.items.length; j++) {
          var item = row.items[j];
          item.tx = curX + item.w / 2;
          curX += item.w + GAP_X + extraGap;
        }
      }

      var placed = [], prevRowMinTop = MARGIN_Y;
      for (i = 0; i < rows.length; i++) {
        var rw = rows[i], rowMinTop = Infinity;
        for (j = 0; j < rw.items.length; j++) {
          var b = rw.items[j], topY = i === 0 ? MARGIN_Y : prevRowMinTop + 28;
          for (k = 0; k < placed.length; k++) {
            var u = placed[k];
            if (Math.min(b.tx + b.w / 2 - 4, u.tx + u.w / 2 + 4) > Math.max(b.tx - b.w / 2 + 4, u.tx - u.w / 2 - 4)) {
              topY = Math.max(topY, u.ty + u.h / 2 + GAP_Y);
            }
          }
          var wave = Math.sin(b.id * 1.9) * 2.5;
          b.ty = Math.max(MARGIN_Y + b.h / 2, topY + wave + b.h / 2);
          rowMinTop = Math.min(rowMinTop, b.ty - b.h / 2);
        }
        for (j = 0; j < rw.items.length; j++) placed.push(rw.items[j]);
        prevRowMinTop = isFinite(rowMinTop) ? rowMinTop : prevRowMinTop;
      }

      var maxBottom = 0;
      for (i = 0; i < list.length; i++) maxBottom = Math.max(maxBottom, (list[i].free ? list[i].y : list[i].ty) + list[i].h / 2);
      canvasH = list.length ? Math.max(S.h, Math.ceil(maxBottom + 84)) : S.h;
      canvas.style.height = canvasH + 'px';
      var scrollable = canvasH > S.h + 8;
      for (i = 0; i < list.length; i++) list[i].el.style.touchAction = 'none';
      updateScrollUI();
    }

    function reorderAndRelayout() {
      list.sort(function (a, b) {
        var ra = Math.round(a.y / 70), rb = Math.round(b.y / 70);
        if (ra !== rb) return ra - rb;
        return a.x - b.x;
      });
      relayout(false);
    }

    // ---------- 말풍선 만들기 ----------
    function spawn(m, instant) {
      var S = size(), col = COLORS[m.c % COLORS.length], b = el('div', 'bd-b'), len = m.text.length;
      b.style.background = col[0]; b.style.color = col[1]; b.style.setProperty('--tail', col[0]);
      b.style.maxWidth = Math.max(200, Math.min(S.w * 0.3, 560)) + 'px';
      b.style.fontSize = (len <= 12 ? 'clamp(22px,2.6vw,42px)' : len <= 30 ? 'clamp(19px,2.05vw,32px)' : 'clamp(16px,1.75vw,27px)');
      b.appendChild(el('div', 'bd-n', m.name)); b.appendChild(el('div', 'bd-t', m.text));
      canvas.appendChild(b);
      var w = b.offsetWidth, h = b.offsetHeight + 14;   // 꼬리 높이만큼 여유
      var prevCanvasH = canvasH || S.h, wasNearBottom = stage.scrollTop > 20 && (prevCanvasH - (stage.scrollTop + S.h) < 220);
      var o = { id: m.id, msg: m, el: b, w: w, h: h, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, rot: 0, sq: 0, sqv: 0, sa: 'y', ph: Math.random() * 6.28, rising: true, freeTime: 0, drag: false, moved: false, dead: false };
      bubbles[m.id] = o; list.push(o);
      relayout(false);
      o.x = Math.max(MARGIN_X + o.w / 2, Math.min(S.w - MARGIN_X - o.w / 2, o.tx + (Math.random() - 0.5) * 80));
      o.y = Math.max(o.ty + 260, stage.scrollTop + S.h + o.h / 2 + 30);
      o.vx = (o.tx - o.x) * 0.6; o.vy = -260; o.rising = true;
      if (instant || reduce()) { o.x = o.tx; o.y = o.ty; o.vx = 0; o.vy = 0; o.rising = false; }
      if (!instant && !reduce() && wasNearBottom && canvasH > stage.scrollTop + S.h) {
        stage.scrollTo({ top: Math.max(0, canvasH - S.h), behavior: 'smooth' });
      }
      b.style.zIndex = String(1 + (m.id % 1000)); b.classList.add('new'); setTimeout(function () { b.classList.remove('new'); }, 2600);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (o.moved) { o.moved = false; return; } if (power) selectBubble(m.id); });
      grab(o); place(o); kick();
    }

    // 끌어서 날리기 / 자리 옮기기
    function grab(o) {
      var b = o.el, id = null, ox = 0, oy = 0, sx = 0, sy = 0, hist = [];
      b.addEventListener('pointerdown', function (ev) {
        if (id !== null || (ev.button && ev.button !== 0) || ev.target.closest('.bd-sel')) return;
        id = ev.pointerId; try { b.setPointerCapture(id); } catch (e) {}
        var r = canvas.getBoundingClientRect(); ox = ev.clientX - r.left - o.x; oy = ev.clientY - r.top - o.y; sx = ev.clientX; sy = ev.clientY;
        o.drag = true; o.rising = false; o.moved = false; o.sa = 'y'; o.sqv = 4.5; o.vx = 0; o.vy = 0; hist = [[performance.now(), ev.clientX, ev.clientY]]; b.classList.add('held'); kick();
      });
      b.addEventListener('pointermove', function (ev) {
        if (ev.pointerId !== id) return;
        var r = canvas.getBoundingClientRect(), S = size(), ch = Math.max(S.h, canvasH), now = performance.now();
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 8) o.moved = true;
        o.x = Math.max(MARGIN_X + o.w / 2, Math.min(S.w - MARGIN_X - o.w / 2, ev.clientX - r.left - ox));
        o.y = Math.max(MARGIN_Y + o.h / 2, Math.min(ch - MARGIN_Y - o.h / 2, ev.clientY - r.top - oy));
        hist.push([now, ev.clientX, ev.clientY]); while (hist.length > 2 && now - hist[0][0] > 90) hist.shift();
        place(o, now);
      });
      function release(ev) {
        if (ev.pointerId !== id) return; id = null; o.drag = false; b.classList.remove('held');
        var f = hist[0], l = hist[hist.length - 1], dt = Math.max(16, l[0] - f[0]) / 1000;
        if (o.moved) {
          o.free = true;
          if (hist.length > 1 && performance.now() - l[0] < 120) {
            o.vx = Math.max(-FLING, Math.min(FLING, (l[1] - f[1]) / dt));
            o.vy = Math.max(-FLING, Math.min(FLING, (l[2] - f[2]) / dt));
            if (Math.hypot(o.vx, o.vy) > 120) { o.sa = Math.abs(o.vx) > Math.abs(o.vy) ? 'x' : 'y'; o.sqv = -3.5; }
          } else { o.vx = 0; o.vy = 0; o.sqv = -2.5; }
          relayout(false);
        } else {
          o.vx = 0; o.vy = 0; o.sqv = -3.5;
        }
        kick();
      }
      b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release);
    }

    function place(o, t) {
      var now = t || performance.now();
      var dist = Math.hypot((o.tx || 0) - o.x, (o.ty || 0) - o.y);
      var calm = (o.drag || reduce()) ? 0 : (o.free ? Math.max(0, 1 - Math.hypot(o.vx, o.vy) / 60) : Math.max(0, 1 - dist / 40));
      var bobX = calm * Math.sin(now / 1500 + o.ph) * 2.2;
      var bobY = calm * Math.cos(now / 1200 + o.ph * 1.3) * 2.8;
      var bobRot = calm * Math.sin(now / 1800 + o.ph * 0.7) * 0.85;
      var sx = 1, sy = 1, q = Math.max(-0.36, Math.min(0.36, o.sq || 0));
      if (o.sa === 'x') { sx = 1 - q * 0.65; sy = 1 + q * 0.45; } else { sy = 1 - q * 0.65; sx = 1 + q * 0.45; }
      o.el.style.transform = 'translate3d(' + (o.x + bobX - o.w / 2).toFixed(1) + 'px,' + (o.y + bobY - o.h / 2).toFixed(1) + 'px,0) rotate(' + ((o.rot || 0) + bobRot).toFixed(2) + 'deg) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    }
    function hit(o, axis, v) {   // 부딪힘 → 부드럽게 찌부러졌다가 복귀
      v = Math.abs(v); if (v < 80) return; o.sa = axis; o.sqv = Math.max(o.sqv || 0, 0) + Math.min(4.5, v * 0.008);
    }
    function spongeHit(o, axis, v) {   // 스펀지 벽: 튕기지 않고 푹 눌렸다가 스르르 복귀
      v = Math.abs(v); if (v < 20) return;
      o.sa = axis;
      o.sq = Math.max(o.sq || 0, Math.min(0.36, 0.16 + v * 0.00024));
      o.sqv = 0;
    }
    function clearSel() {
      if (selEl) { selEl.remove(); selEl = null; }
      if (selBubble) { selBubble.el.classList.remove('selected'); selBubble = null; }
    }
    function pop(id) {   // 터지며 사라짐
      var o = bubbles[id]; if (!o || o.dead) return; o.dead = true; delete bubbles[id];
      if (selBubble === o) clearSel();
      list = list.filter(function (x) { return x !== o; }); o.el.classList.add('pop');
      setTimeout(function () { o.el.remove(); }, 520);
      relayout(false); kick();
    }

    // ---------- 물리 루프 ----------
    function kick() { if (!raf && alive) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
    var lastDraw = 0;
    function frame(t) {
      raf = 0; if (!alive) return;
      if (window.KS_LITE && t - lastDraw < 30 && !(list.some(function (o) { return o.drag; }))) { raf = requestAnimationFrame(frame); return; }   // 가벼운 화면: 30fps
      lastDraw = t;
      var dt = Math.min(0.05, Math.max(0.001, (t - lastT) / 1000)); lastT = t;
      step(dt, t);
      var busy = list.some(function (o) {
        return o.drag || Math.abs(o.vy) > 1.5 || Math.abs(o.vx) > 1.5 || (!o.free && (Math.abs(o.tx - o.x) > 1.5 || Math.abs(o.ty - o.y) > 1.5)) || Math.abs(o.sq) > 0.005 || Math.abs(o.sqv) > 0.02;
      });
      if (busy || (list.length && !reduce() && !window.KS_LITE)) raf = requestAnimationFrame(frame);   // 가벼운 화면에서는 다 가라앉으면 루프를 멈춤
    }
    function step(dt, t) {
      sub(dt, t);
      for (var i = 0; i < list.length; i++) place(list[i], t);
    }
    function sub(dt, t) {
      var S = size(), ch = Math.max(S.h, canvasH), draggedBubble = null, needRelayout = false, i, j, a, b;
      for (i = 0; i < list.length; i++) { if (list[i].drag) { draggedBubble = list[i]; break; } }
      for (i = 0; i < list.length; i++) {
        a = list[i];
        var inWall = false;
        if (a.drag) {
          a.sqv = (a.sqv || 0) + (-180 * (a.sq || 0) - 14 * (a.sqv || 0)) * dt;
          a.sq = Math.max(-0.2, Math.min(0.2, (a.sq || 0) + a.sqv * dt));
          a.rot = (a.rot || 0) + (0 - (a.rot || 0)) * Math.min(1, dt * 14);
          continue;
        }
        if (a.free) {
          a.vy -= 45 * dt;
          a.vx -= a.vx * 2.5 * dt; a.vy -= a.vy * 2.6 * dt;
          a.x += a.vx * dt; a.y += a.vy * dt;
          var rightWall = rail.hidden ? MARGIN_X : 56;
          var minX = MARGIN_X + a.w / 2, maxX = S.w - rightWall - a.w / 2;
          var minY = MARGIN_Y + a.h / 2, maxY = ch - 40 - a.h / 2;
          var pen, limL = MARGIN_X + a.w / 3, limR = rightWall + a.w / 3, limT = MARGIN_Y + a.h / 3, limB = 40 + a.h / 3;
          var wallSq = 0;
          if (a.x < minX) {
            pen = minX - a.x; if (pen > limL) { a.x = minX - limL; pen = limL; }
            a.vx += (pen * 34 - a.vx * 2.2) * dt;
            a.sa = 'x'; wallSq = Math.max(wallSq, Math.min(0.22, pen * 0.004)); inWall = true;
          } else if (a.x > maxX) {
            pen = a.x - maxX; if (pen > limR) { a.x = maxX + limR; pen = limR; }
            a.vx -= (pen * 34 + a.vx * 2.2) * dt;
            a.sa = 'x'; wallSq = Math.max(wallSq, Math.min(0.22, pen * 0.004)); inWall = true;
          }
          if (a.y < minY) {
            pen = minY - a.y; if (pen > limT) { a.y = minY - limT; pen = limT; }
            a.vy += (pen * 32 - a.vy * 2.4) * dt;
            a.sa = 'y'; wallSq = Math.max(wallSq, Math.min(0.2, pen * 0.0045)); inWall = true;
          } else if (a.y > maxY) {
            pen = a.y - maxY; if (pen > limB) { a.y = maxY + limB; pen = limB; }
            a.vy -= (pen * 32 + a.vy * 2.4) * dt;
            a.sa = 'y'; wallSq = Math.max(wallSq, Math.min(0.2, pen * 0.0045)); inWall = true;
          }
          if (inWall) {
            a.sq = (a.sq || 0) + (wallSq - (a.sq || 0)) * Math.min(1, dt * 16);
            a.sqv = 0;
          }
          for (j = 0; j < list.length; j++) {
            b = list[j]; if (b === a || b.drag) continue;
            var dx0 = b.x - a.x, dy0 = b.y - a.y;
            var ox = (a.w + b.w) / 2 + 10 - Math.abs(dx0), oy = (a.h + b.h) / 2 + 10 - Math.abs(dy0);
            if (ox > 0 && oy > 0) {
              var share = b.free ? 0.35 : 0.65;
              if (ox < oy) {
                var sg = dx0 >= 0 ? 1 : -1;
                a.x -= sg * ox * share; if (b.free) b.x += sg * ox * 0.35;
                if (a.vx * sg > 0) a.vx *= 0.4;
              } else {
                var sy0 = dy0 >= 0 ? 1 : -1;
                if (sy0 < 0 && b.y <= MARGIN_Y + b.h / 2 + 8) {
                  a.y += oy * 0.7; if (a.vy < 0) a.vy = 0;
                } else {
                  a.y -= sy0 * oy * share; if (b.free) b.y += sy0 * oy * 0.35;
                  if (a.vy * sy0 > 0) a.vy = 0;
                }
              }
            }
          }
        } else {
          var dx = a.tx - a.x, dy = a.ty - a.y;
          a.vx += (dx * 20 - a.vx * 9.0) * dt;
          a.vy += (dy * 20 - a.vy * 9.0) * dt;
          if (draggedBubble) {
            var rx = a.x - draggedBubble.x, ry = a.y - draggedBubble.y;
            var needX = (a.w + draggedBubble.w) / 2 + 14, needY = (a.h + draggedBubble.h) / 2 + 14;
            if (Math.abs(rx) < needX && Math.abs(ry) < needY) {
              var px = needX - Math.abs(rx), py = needY - Math.abs(ry);
              if (px < py) a.vx += (rx >= 0 ? 1 : -1) * px * 16 * dt;
              else a.vy += (ry >= 0 ? 1 : -1) * py * 16 * dt;
            }
          }
          var spd = Math.hypot(a.vx, a.vy);
          if (spd > 560) { var sc = 560 / spd; a.vx *= sc; a.vy *= sc; }
          a.x += a.vx * dt; a.y += a.vy * dt;
          if (a.rising && Math.hypot(dx, dy) < 24) {
            a.rising = false; a.sa = 'y'; a.sqv = Math.min(3.0, Math.abs(a.vy) * 0.01);
          }
        }
        if (!inWall) {
          a.sqv = (a.sqv || 0) + (-95 * (a.sq || 0) - 15 * (a.sqv || 0)) * dt;
          a.sq = Math.max(-0.36, Math.min(0.36, (a.sq || 0) + a.sqv * dt));
        }
        var targetRot = Math.max(-7, Math.min(7, a.vx * 0.018));
        a.rot = (a.rot || 0) + (targetRot - (a.rot || 0)) * Math.min(1, dt * 14);
      }
      if (needRelayout) reorderAndRelayout();
    }
    function settleNow() { relayout(false); for (var k = 0; k < 120; k++) step(0.03, k * 30); }   // 애니메이션 줄이기 설정: 바로 쌓인 상태로

    // ---------- 선택(삭제) ----------
    function selectBubble(id) {
      clearSel();
      var o = bubbles[id]; if (!o) return;
      var box = el('div', 'bd-sel'), who = el('span', null, '작성: ' + (o.msg.by || o.msg.name) + (o.msg.anon ? ' (익명)' : '')), del = el('button', null, '🗑 삭제');
      del.type = 'button'; del.addEventListener('click', function (ev) { ev.stopPropagation(); clearSel(); api('ctl', { action: 'delete', id: id }).then(poll); });
      box.appendChild(who); box.appendChild(del); o.el.appendChild(box); o.el.classList.add('selected'); selEl = box; selBubble = o;
    }
    stage.addEventListener('click', function () {
      if (stage._panMoved) { stage._panMoved = false; return; }
      clearSel();
    });

    // ---------- 상태 반영 ----------
    function paintHead() {
      topic.textContent = state.topic || (power ? '질문을 정해 보세요 (⚙ 질문)' : '수업 의견을 올려 주세요');
      chip.textContent = state.open ? '🟢 의견 받는 중' : '⏸ 닫힘'; chip.className = 'bd-chip' + (state.open ? ' on' : '');
      empty.style.display = (loaded && !list.length) ? 'flex' : 'none';
      if (btnOpen) btnOpen.textContent = state.open ? '⏸ 받기 닫기' : '▶ 받기 열기';
    }
    function apply(j) {
      state = { open: j.open, topic: j.topic, msgs: j.msgs };
      var ids = {}; j.msgs.forEach(function (m) { ids[m.id] = m; });
      Object.keys(bubbles).forEach(function (id) { if (!ids[id]) pop(id); });   // 삭제·비우기
      var fresh = j.msgs.filter(function (m) { return !bubbles[m.id] && !gone[m.id]; });
      if (first) {
        first = false;
        fresh.forEach(function (m, i) {
          setTimeout(function () {
            if (alive && !bubbles[m.id] && state.msgs.some(function (x) { return x.id === m.id; })) { spawn(m, false); paintHead(); }
          }, Math.min(i * 110, 2200));
        });
      } else {
        fresh.forEach(function (m, i) {
          setTimeout(function () {
            if (alive && !bubbles[m.id] && state.msgs.some(function (x) { return x.id === m.id; })) { spawn(m, false); paintHead(); }
          }, i * 350);
        });
      }
      paintHead();
    }
    var gone = {};   // MAXLIST 초과로 사라진 말풍선이 다음 폴링에서 되살아나지 않게
    var origPop = pop; pop = function (id) { gone[id] = 1; origPop(id); };
    function poll() { return api('state').then(function (j) { if (!alive) return; hideLoader(); if (j._ok) { root.classList.remove('off'); apply(j); } else { root.classList.add('off'); paintHead(); } }).catch(function () { hideLoader(); root.classList.add('off'); paintHead(); }); }

    var btnOpen = null;
    function tbtn(label, fn) { var b = el('button', 'bd-btn', label); b.type = 'button'; b.addEventListener('click', fn); tools.appendChild(b); return b; }
    if (power) {
      tbtn('⚙ 질문', function () { var t = window.prompt('이번 수업 질문/주제 (60자까지)', state.topic || ''); if (t !== null) api('ctl', { action: 'topic', topic: t }).then(poll); });
      btnOpen = tbtn('▶ 받기 열기', function () { api('ctl', { action: state.open ? 'close' : 'open' }).then(poll); });
      tbtn('🧹 비우기', function () { if (window.confirm('보드의 의견을 모두 지울까요?')) api('ctl', { action: 'clear' }).then(function () { gone = {}; poll(); }); });
    }
    tbtn('⛶', function () { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen().catch(function () {}); }).setAttribute('aria-label', '전체화면');
    tbtn('✕ 나가기', close);
    function onResize() { relayout(true); kick(); }
    window.addEventListener('resize', onResize);
    function close() {
      alive = false; clearInterval(timer); cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      root.remove(); cur = null; if (opts.onExit) opts.onExit();
    }
    function onKey(e) { if (e.key === 'Escape' && !document.fullscreenElement) close(); }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(root); paintHead();
    poll(); timer = setInterval(poll, 1800);
    cur = { close: close };
    window.Board26._debug = { list: function () { return list; }, settle: settleNow, relayout: relayout };
  }
  window.Board26 = { show: show, api: api };
})();
