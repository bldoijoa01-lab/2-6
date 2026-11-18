// 미니게임: 2인 대전 슈팅 (한 화면을 좌우로 나눠 서로 마주 보고 싸움)
// - 같은 전장을 두 번 그림: 왼쪽 칸은 1P 시점, 오른쪽 칸은 180° 돌려 2P 시점 → 각자 화면에서 '나는 아래, 상대는 위'
// - 총알은 정해진 간격으로 자동 발사(내가 보는 화면의 위쪽으로). 손가락(터치)을 끌어서 자유롭게 이동, 키보드는 1P: WASD / 2P: 방향키
// - 아이템: ❤ 체력 회복, ⚡ 빠른 연사, ✴ 3갈래 총알
(function () {
  var W = 360, H = 640, R = 16, HP = 15, cur = null;
  var COL = [['#5BE7FF', '#0A5A73'], ['#FF6BD6', '#6E0F55']];
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function show(opts) {
    if (cur) return; opts = opts || {};
    var root = el('div', 'gm-root'), cv = el('canvas', 'gm-cv'), ctx = cv.getContext('2d'), bar = el('div', 'gm-bar');
    var btnX = el('button', 'gm-btn', '✕ 나가기'), btnR = el('button', 'gm-btn', '🔁 다시'), btnS = el('button', 'gm-btn', '🔇 소리 꺼짐');
    [btnR, btnS, btnX].forEach(function (b) { b.type = 'button'; bar.appendChild(b); });
    root.appendChild(cv); root.appendChild(bar); document.body.appendChild(root);
    var DPR = Math.min(2, window.devicePixelRatio || 1), SW = 0, SH = 0, sound = false, ac = null, raf = 0, last = 0, alive = true;
    var wins = [0, 0], st, stars = [];
    for (var i = 0; i < 70; i++) stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.3]);

    function beep(f, d, v) {
      if (!sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); var o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f; o.connect(g); g.connect(ac.destination); var t = ac.currentTime; g.gain.setValueAtTime(v || 0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.start(t); o.stop(t + d + 0.02); } catch (e) {}
    }
    function newRound() {
      st = { phase: 'ready', t: 3.2, over: 0, winner: -1, time: 0, nextItem: 6,
        ships: [{ x: W / 2, y: H - 80, hp: HP, cd: 0.2, flash: 0, rapid: 0, triple: 0, vx: 0, vy: 0 }, { x: W / 2, y: 80, hp: HP, cd: 0.2, flash: 0, rapid: 0, triple: 0, vx: 0, vy: 0 }],
        bullets: [], items: [], parts: [], shake: 0 };
    }
    newRound();

    function fitWorld() {   // 전장 가로폭을 칸 비율에 맞춤(넓은 전자칠판에선 넓게, 세로 폰에선 좁게)
      var asp = (SW / 2 - 14) / Math.max(200, SH - 64); W = Math.round(clamp(H * asp, 300, 700));
      stars = []; for (var i = 0; i < 80; i++) stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.3]);
      if (st) st.ships.forEach(function (sh) { sh.x = clamp(sh.x, R, W - R); });
    }
    function resize() { SW = window.innerWidth; SH = window.innerHeight; fitWorld(); cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR); cv.style.width = SW + 'px'; cv.style.height = SH + 'px'; }
    function pane(p) {   // 칸 위치·배율 (p=0 왼쪽, 1 오른쪽)
      var pw = SW / 2, ph = SH, s = Math.min((pw - 14) / W, (ph - 64) / H), ox = p * pw + (pw - W * s) / 2, oy = (ph - H * s) / 2;
      return { x: p * pw, w: pw, h: ph, s: s, ox: ox, oy: oy };
    }
    function toWorldDelta(p, dx, dy) { var s = pane(p).s; return p === 0 ? [dx / s, dy / s] : [-dx / s, -dy / s]; }

    // ---------- 입력 ----------
    var ptrs = {}, keys = {};
    function down(e) { var p = e.clientX < SW / 2 ? 0 : 1; ptrs[e.pointerId] = { p: p, x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); }
    function move(e) {
      var q = ptrs[e.pointerId]; if (!q || st.phase === 'over') { if (q) { q.x = e.clientX; q.y = e.clientY; } return; }
      var d = toWorldDelta(q.p, (e.clientX - q.x) * 1.35, (e.clientY - q.y) * 1.35), sh = st.ships[q.p];
      sh.x = clamp(sh.x + d[0], R, W - R); sh.y = clamp(sh.y + d[1], R, H - R); q.x = e.clientX; q.y = e.clientY;
    }
    function up(e) { delete ptrs[e.pointerId]; }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function kd(e) { if (e.key === 'Escape') { close(); return; } keys[e.key.toLowerCase()] = true; if (e.key.indexOf('Arrow') === 0) e.preventDefault(); }
    function ku(e) { keys[e.key.toLowerCase()] = false; }
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); window.addEventListener('resize', resize);

    // ---------- 게임 로직 ----------
    function fire(i) {
      var s = st.ships[i], dir = i === 0 ? -1 : 1, sp = 470;
      st.bullets.push({ x: s.x, y: s.y + dir * (R + 2), vx: 0, vy: dir * sp, o: i });
      if (s.triple > 0) { st.bullets.push({ x: s.x - 8, y: s.y + dir * R, vx: -95, vy: dir * sp, o: i }); st.bullets.push({ x: s.x + 8, y: s.y + dir * R, vx: 95, vy: dir * sp, o: i }); }
      beep(i ? 520 : 440, 0.05, 0.015);
    }
    function burst(x, y, c, n, v) { for (var k = 0; k < n; k++) { var a = Math.random() * 6.28, sp = (0.3 + Math.random()) * (v || 160); st.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.35, c: c }); } }
    function update(dt) {
      var i, j, s;
      if (st.phase === 'ready') { st.t -= dt; if (st.t <= 0) st.phase = 'play'; }
      if (st.phase === 'over') { st.over += dt; }
      // 키보드 이동 (1P: WASD, 2P: 방향키) — 각자 화면 기준(2P는 화면이 뒤집혀 있어 부호 반대)
      if (st.phase !== 'over') {
        var m = [[(keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0)], [(keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0), (keys.arrowdown ? 1 : 0) - (keys.arrowup ? 1 : 0)]];
        for (i = 0; i < 2; i++) { var sg = i === 0 ? 1 : -1; s = st.ships[i]; s.x = clamp(s.x + m[i][0] * sg * 240 * dt, R, W - R); s.y = clamp(s.y + m[i][1] * sg * 240 * dt, R, H - R); }
      }
      if (st.phase === 'play') {
        st.time += dt;
        for (i = 0; i < 2; i++) { s = st.ships[i]; s.cd -= dt; if (s.rapid > 0) s.rapid -= dt; if (s.triple > 0) s.triple -= dt; if (s.cd <= 0) { fire(i); s.cd = s.rapid > 0 ? 0.17 : 0.34; } }
        st.nextItem -= dt;
        if (st.nextItem <= 0) { st.nextItem = 7 + Math.random() * 5; st.items.push({ x: 40 + Math.random() * (W - 80), y: H * 0.3 + Math.random() * H * 0.4, k: ['heart', 'rapid', 'triple'][Math.floor(Math.random() * 3)], life: 12 }); }
        for (i = st.bullets.length - 1; i >= 0; i--) {
          var b = st.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { st.bullets.splice(i, 1); continue; }
          var tg = st.ships[1 - b.o], dx = b.x - tg.x, dy = b.y - tg.y;
          if (dx * dx + dy * dy < (R + 5) * (R + 5)) {
            st.bullets.splice(i, 1); tg.hp--; tg.flash = 0.25; st.shake = 0.18; burst(b.x, b.y, COL[1 - b.o][0], 9); beep(120, 0.12, 0.05);
            if (tg.hp <= 0) { st.phase = 'over'; st.winner = b.o; wins[b.o]++; burst(tg.x, tg.y, COL[1 - b.o][0], 50, 300); beep(70, 0.5, 0.07); }
          }
        }
        for (i = st.items.length - 1; i >= 0; i--) {
          var it = st.items[i]; it.life -= dt; if (it.life <= 0) { st.items.splice(i, 1); continue; }
          for (j = 0; j < 2; j++) {
            s = st.ships[j]; var ex = it.x - s.x, ey = it.y - s.y;
            if (ex * ex + ey * ey < 28 * 28) {
              if (it.k === 'heart') s.hp = Math.min(HP, s.hp + 2); else if (it.k === 'rapid') s.rapid = 6; else s.triple = 6;
              burst(it.x, it.y, '#FFE08A', 14, 130); beep(880, 0.12, 0.03); st.items.splice(i, 1); break;
            }
          }
        }
      }
      for (i = 0; i < 2; i++) { st.ships[i].flash = Math.max(0, st.ships[i].flash - dt); }
      for (i = st.parts.length - 1; i >= 0; i--) { var p = st.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) st.parts.splice(i, 1); }
      st.shake = Math.max(0, st.shake - dt);
    }

    // ---------- 그리기 ----------
    function drawShip(i, rot) {
      var s = st.ships[i], c = COL[i], dir = i === 0 ? -1 : 1;
      ctx.save(); ctx.translate(s.x, s.y); if (dir > 0) ctx.rotate(Math.PI);
      if (s.flash > 0 && Math.floor(s.flash * 40) % 2 === 0) ctx.globalAlpha = 0.35;
      ctx.shadowColor = c[0]; ctx.shadowBlur = 16; ctx.fillStyle = c[0];
      ctx.beginPath(); ctx.moveTo(0, -R - 2); ctx.lineTo(R * 0.85, R * 0.9); ctx.lineTo(0, R * 0.45); ctx.lineTo(-R * 0.85, R * 0.9); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(0, 1, 4.5, 0, 6.28); ctx.fill();
      if (s.rapid > 0 || s.triple > 0) { ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R + 6, 0, 6.28); ctx.stroke(); }
      ctx.restore();
    }
    function drawWorld(rot) {
      var i, k;
      ctx.fillStyle = '#0B0F2A'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; stars.forEach(function (t) { var y = (t[1] + st.time * 18 * t[2]) % H; ctx.fillRect(t[0], y, t[2], t[2]); });
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);
      st.items.forEach(function (it) {
        var pulse = 1 + Math.sin(st.time * 6) * 0.08; ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(rot); ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(255,224,138,.22)'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = '18px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.k === 'heart' ? '❤️' : it.k === 'rapid' ? '⚡' : '✴️', 0, 1); ctx.restore();
      });
      st.bullets.forEach(function (b) { ctx.fillStyle = COL[b.o][0]; ctx.shadowColor = COL[b.o][0]; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, 6.28); ctx.fill(); }); ctx.shadowBlur = 0;
      for (i = 0; i < 2; i++) drawShip(i, rot);
      st.parts.forEach(function (p) { ctx.globalAlpha = clamp(p.life * 2.2, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }); ctx.globalAlpha = 1;
    }
    function hearts(x, y, hp, c, align) {   // 체력 막대
      var w = 18, gap = 4, total = HP * (w + gap) - gap, x0 = x - total / 2;
      for (var i = 0; i < HP; i++) { ctx.fillStyle = i < hp ? c : 'rgba(255,255,255,.14)'; ctx.fillRect(x0 + i * (w + gap), y, w, 8); }
    }
    function frame(now) {
      raf = 0; if (!alive) return; var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      update(dt); endBox.style.display = st.phase === 'over' && st.over > 1.0 ? '' : 'none';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#05071a'; ctx.fillRect(0, 0, SW, SH);
      for (var p = 0; p < 2; p++) {
        var P = pane(p), me = p, op = 1 - p;
        ctx.save(); ctx.beginPath(); ctx.rect(P.x + 3, 3, P.w - 6, P.h - 6); ctx.clip();
        ctx.save();
        var sx = st.shake > 0 ? (Math.random() - 0.5) * 8 * st.shake * 5 : 0, sy = st.shake > 0 ? (Math.random() - 0.5) * 8 * st.shake * 5 : 0;
        if (p === 0) ctx.translate(P.ox + sx, P.oy + sy); else { ctx.translate(P.ox + W * P.s + sx, P.oy + H * P.s + sy); ctx.rotate(Math.PI); }
        ctx.scale(P.s, P.s);
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); drawWorld(p === 0 ? 0 : Math.PI);
        ctx.restore();
        // 화면 좌표 HUD (항상 정방향)
        ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = COL[op][0]; ctx.fillText((op === 0 ? '1P' : '2P') + ' · 적', P.x + P.w / 2, 22); hearts(P.x + P.w / 2, 28, st.ships[op].hp, COL[op][0]);
        ctx.fillStyle = COL[me][0]; ctx.fillText((me === 0 ? '1P' : '2P') + ' · 나  (' + wins[me] + '승)', P.x + P.w / 2, SH - 30); hearts(P.x + P.w / 2, SH - 24, st.ships[me].hp, COL[me][0]);
        // 상태 안내
        ctx.textBaseline = 'middle';
        if (st.phase === 'ready') { var n = Math.ceil(st.t - 0.2); ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(P.s * 120) + 'px system-ui,sans-serif'; ctx.fillText(n > 0 ? String(n) : 'GO!', P.x + P.w / 2, SH / 2); ctx.font = '700 ' + Math.round(P.s * 22) + 'px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText('손가락을 끌어서 움직여요 · 총알은 자동 발사!', P.x + P.w / 2, SH / 2 + P.s * 100); }
        if (st.phase === 'over') { var win = st.winner === me; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(P.x + 3, 3, P.w - 6, SH - 6); ctx.fillStyle = win ? '#FFE08A' : '#fff'; ctx.font = '900 ' + Math.round(P.s * 70) + 'px system-ui,sans-serif'; ctx.fillText(win ? '🏆 승리!' : '💥 패배', P.x + P.w / 2, SH / 2 - 10); if (st.over > 1.2) { ctx.font = '700 ' + Math.round(P.s * 24) + 'px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('화면을 눌러 다시 하기', P.x + P.w / 2, SH / 2 + P.s * 70); } }
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(SW / 2 - 1, 0, 2, SH);
      raf = requestAnimationFrame(frame);
    }

    function close() { if (!alive) return; alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); root.remove(); cur = null; if (opts.onExit) opts.onExit(); }
    var armed = 0;   // 게임 중 실수로 나가지 않게: 처음 누르면 확인 문구, 3초 안에 한 번 더 누르면 나감 (끝난 뒤엔 바로)
    btnX.addEventListener('click', function () {
      if (st.phase === 'over' || st.phase === 'ready' && st.t > 2.5) { close(); return; }
      if (armed) { close(); return; } armed = setTimeout(function () { armed = 0; btnX.textContent = '✕ 나가기'; btnX.classList.remove('warn'); }, 3000); btnX.textContent = '정말 나갈까요? 한 번 더'; btnX.classList.add('warn');
    });
    btnR.addEventListener('click', newRound);
    var endBox = el('div', 'gm-end'), eAgain = el('button', 'gm-big', '🔁 다시 하기'), eExit = el('button', 'gm-big out', '🚪 게임 나가기'); eAgain.type = eExit.type = 'button';
    eAgain.addEventListener('click', function (e) { e.stopPropagation(); newRound(); }); eExit.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    ['pointerdown', 'pointerup'].forEach(function (t) { endBox.addEventListener(t, function (e) { e.stopPropagation(); }); });
    endBox.appendChild(eAgain); endBox.appendChild(eExit); root.appendChild(endBox); endBox.style.display = 'none';
    btnS.addEventListener('click', function () { sound = !sound; btnS.textContent = sound ? '🔊 소리 켜짐' : '🔇 소리 꺼짐'; if (sound) beep(660, 0.08, 0.03); });
    cv.addEventListener('dblclick', function () { if (st.phase === 'over') newRound(); });
    cv.addEventListener('pointerdown', function () { if (st.phase === 'over' && st.over > 1.2) newRound(); });   // 끝난 뒤 화면을 한 번 누르면 다시 시작
    resize(); newRound(); cur = { close: close }; raf = requestAnimationFrame(frame);
    window.Game26._debug = { state: function () { return st; }, wins: wins };
  }
  window.Game26 = { show: show };
})();
