// 미니게임: 2인 대전 슈팅 (한 화면을 좌우로 나눠 서로 마주 보고 싸움)
// - 같은 전장을 두 번 그림: 왼쪽 칸은 1P 시점, 오른쪽 칸은 180° 돌려 2P 시점 → 각자 화면에서 '나는 아래, 상대는 위'
// - 총알은 정해진 간격으로 자동 발사(내가 보는 화면의 위쪽으로). 손가락(터치)을 끌어서 자유롭게 이동, 키보드는 1P: WASD / 2P: 방향키
// - 아이템: ❤ 체력 회복, ⚡ 빠른 연사, ✴ 3갈래 총알
(function () {
  var W = 360, H = 640, R = 16, HP = 8, AMMO = 5, cur = null;
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
        ships: [{ x: W / 2, y: H - 80, hp: HP, cd: 0, ammo: AMMO, rt: 0, flash: 0, rapid: 0, triple: 0, vx: 0, vy: 0, empty: 0 }, { x: W / 2, y: 80, hp: HP, cd: 0, ammo: AMMO, rt: 0, flash: 0, rapid: 0, triple: 0, vx: 0, vy: 0, empty: 0 }],
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
    function yr(i) { return i === 0 ? [H / 2 + R + 6, H - R] : [R, H / 2 - R - 6]; }   // 각자 자기 진영(가운데 선을 넘을 수 없음)
    function fireBtn(p) { var P = pane(p); return { x: P.x + P.w - 74, y: SH - 92, r: 50 }; }
    function toWorldDelta(p, dx, dy) { var s = pane(p).s; return p === 0 ? [dx / s, dy / s] : [-dx / s, -dy / s]; }

    // ---------- 입력 ----------
    var ptrs = {}, keys = {};
    var fireReq = [false, false];
    function down(e) { var p = e.clientX < SW / 2 ? 0 : 1, fb = fireBtn(p), onBtn = Math.hypot(e.clientX - fb.x, e.clientY - fb.y) < fb.r + 8; ptrs[e.pointerId] = { p: p, x: e.clientX, y: e.clientY, fire: onBtn }; if (onBtn) fireReq[p] = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); }
    function move(e) {
      var q = ptrs[e.pointerId]; if (!q || q.fire || st.phase === 'over') { if (q) { q.x = e.clientX; q.y = e.clientY; } return; }
      var d = toWorldDelta(q.p, (e.clientX - q.x) * 1.35, (e.clientY - q.y) * 1.35), sh = st.ships[q.p];
      var yb = yr(q.p); sh.x = clamp(sh.x + d[0], R, W - R); sh.y = clamp(sh.y + d[1], yb[0], yb[1]); q.x = e.clientX; q.y = e.clientY;
    }
    function up(e) { delete ptrs[e.pointerId]; }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function kd(e) { if (e.key === 'Escape') { close(); return; } if (!e.repeat) { if (e.key === 'f' || e.key === 'F') fireReq[0] = true; if (e.key === 'Enter') fireReq[1] = true; } keys[e.key.toLowerCase()] = true; if (e.key.indexOf('Arrow') === 0) e.preventDefault(); }
    function ku(e) { keys[e.key.toLowerCase()] = false; }
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); window.addEventListener('resize', resize);

    // ---------- 게임 로직 ----------
    function fire(i) {
      var s = st.ships[i], dir = i === 0 ? -1 : 1, sp = 340;
      st.bullets.push({ x: s.x, y: s.y + dir * (R + 2), vx: 0, vy: dir * sp, o: i });
      if (s.triple > 0) { st.bullets.push({ x: s.x - 8, y: s.y + dir * R, vx: -95, vy: dir * sp, o: i }); st.bullets.push({ x: s.x + 8, y: s.y + dir * R, vx: 95, vy: dir * sp, o: i }); }
      beep(i ? 520 : 440, 0.05, 0.015);
    }
    function burst(x, y, c, n, v) { for (var k = 0; k < n; k++) { var a = Math.random() * 6.28, sp = (0.3 + Math.random()) * (v || 160); st.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.35, c: c }); } }
    function update(dt) {
      var i, j, s;
      if (st.phase === 'ready') { st.t -= dt; fireReq[0] = fireReq[1] = false; if (st.t <= 0) st.phase = 'play'; }
      if (st.phase === 'over') { st.over += dt; }
      // 키보드 이동 (1P: WASD, 2P: 방향키) — 각자 화면 기준(2P는 화면이 뒤집혀 있어 부호 반대)
      if (st.phase !== 'over') {
        var m = [[(keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0)], [(keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0), (keys.arrowdown ? 1 : 0) - (keys.arrowup ? 1 : 0)]];
        for (i = 0; i < 2; i++) { var sg = i === 0 ? 1 : -1; s = st.ships[i]; var yb2 = yr(i); s.x = clamp(s.x + m[i][0] * sg * 240 * dt, R, W - R); s.y = clamp(s.y + m[i][1] * sg * 240 * dt, yb2[0], yb2[1]); }
      }
      if (st.phase === 'play') {
        st.time += dt;
        for (i = 0; i < 2; i++) {
          s = st.ships[i]; s.cd -= dt; s.empty = Math.max(0, s.empty - dt); if (s.rapid > 0) s.rapid -= dt; if (s.triple > 0) s.triple -= dt;
          if (s.ammo < AMMO) { s.rt -= dt; if (s.rt <= 0) { s.ammo++; s.rt = s.rapid > 0 ? 0.4 : 0.85; } }   // 탄창 재장전
          if (fireReq[i]) { fireReq[i] = false; if (s.ammo > 0 && s.cd <= 0) { fire(i); if (s.ammo === AMMO) s.rt = s.rapid > 0 ? 0.4 : 0.85; s.ammo--; s.cd = 0.14; } else if (s.ammo <= 0) { s.empty = 0.25; beep(150, 0.06, 0.02); } }
        }
        st.nextItem -= dt;
        if (st.nextItem <= 0) { st.nextItem = 7 + Math.random() * 5; st.items.push({ x: 40 + Math.random() * (W - 80), y: Math.random() < 0.5 ? 40 + Math.random() * (H / 2 - 90) : H / 2 + 50 + Math.random() * (H / 2 - 90), k: ['heart', 'rapid', 'triple'][Math.floor(Math.random() * 3)], life: 12 }); }
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
      ctx.save(); ctx.shadowColor = '#FFE08A'; ctx.shadowBlur = 14; ctx.strokeStyle = 'rgba(255,224,138,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.restore();
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
        // 발사 버튼 (탄창 5발, 비면 재장전 링)
        var fb = fireBtn(me), sh2 = st.ships[me], rdy = sh2.ammo > 0;
        ctx.save(); ctx.beginPath(); ctx.arc(fb.x, fb.y, fb.r, 0, 6.28); ctx.fillStyle = sh2.empty > 0 ? 'rgba(255,90,90,.55)' : rdy ? COL[me][0] + 'cc' : 'rgba(255,255,255,.12)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
        if (sh2.ammo < AMMO) { ctx.beginPath(); ctx.arc(fb.x, fb.y, fb.r + 7, -Math.PI / 2, -Math.PI / 2 + 6.28 * (1 - Math.max(0, sh2.rt) / (sh2.rapid > 0 ? 0.4 : 0.85)), false); ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 4; ctx.stroke(); }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#06303d'; ctx.font = '900 ' + Math.round(fb.r * 0.62) + 'px system-ui,sans-serif'; ctx.fillText('🔥', fb.x, fb.y - 6);
        for (var ai = 0; ai < AMMO; ai++) { ctx.beginPath(); ctx.arc(fb.x - (AMMO - 1) * 5.5 + ai * 11, fb.y + fb.r * 0.62, 3.6, 0, 6.28); ctx.fillStyle = ai < sh2.ammo ? '#fff' : 'rgba(0,0,0,.3)'; ctx.fill(); }
        ctx.restore();
        // 상태 안내
        ctx.textBaseline = 'middle';
        if (st.phase === 'ready') { var n = Math.ceil(st.t - 0.2); ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(P.s * 120) + 'px system-ui,sans-serif'; ctx.fillText(n > 0 ? String(n) : 'GO!', P.x + P.w / 2, SH / 2); ctx.font = '700 ' + Math.round(P.s * 22) + 'px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText('끌어서 이동 · 🔥 버튼을 눌러 발사! (가운데 선은 못 넘어요)', P.x + P.w / 2, SH / 2 + P.s * 100); }
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

  // ================= 원 그리기 (정확도 채점) =================
  // 손가락/마우스로 한 번에 원을 그리면 최소제곱으로 맞춘 '가장 가까운 원'과 비교해 정확도(%)를 계산: 반지름 흔들림 + 시작·끝 이어짐 + 끝까지 한 바퀴 그렸는지
  var curC = null;
  function scoreCircle(pts, cx, cy) {   // 중심은 화면 가운데 점으로 고정 (cx, cy)
    var n = pts.length; if (n < 12) return { err: '조금 더 길게 그려 주세요' };
    var rs = [], rm = 0, i; for (i = 0; i < n; i++) { var r = Math.hypot(pts[i][0] - cx, pts[i][1] - cy); rs.push(r); rm += r; } rm /= n;
    if (rm < 40) return { err: '조금 더 크게 그려 주세요' };
    // 한 바퀴를 얼마나 돌았는지(누적 각도)
    var tot = 0, prev = Math.atan2(pts[0][1] - cy, pts[0][0] - cx); for (i = 1; i < n; i++) { var a = Math.atan2(pts[i][1] - cy, pts[i][0] - cx), d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; tot += d; prev = a; }
    var turns = Math.abs(tot) / (2 * Math.PI); if (turns < 0.85) return { err: '원을 한 바퀴 이상 그려 주세요' };
    var dev = 0; for (i = 0; i < n; i++) dev += Math.abs(rs[i] - rm) / rm; dev /= n;
    var gap = Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) / (2 * Math.PI * rm);   // 시작-끝 간격(둘레 대비)
    var over = Math.max(0, turns - 1.25) * 12;   // 너무 여러 번 덧그리면 감점
    var acc = 100 - dev * 330 - gap * 50 - over; acc = Math.max(0, Math.min(100, acc));
    return { acc: acc, cx: cx, cy: cy, r: rm, rs: rs, dev: dev, gap: gap };
  }
  function circle(opts) {
    if (curC) return; opts = opts || {};
    var root = el('div', 'gm-root cg-root'), cv = el('canvas', 'gm-cv'), ctx = cv.getContext('2d'), bar = el('div', 'gm-bar'), msgEl = el('div', 'cg-msg'), bestEl = el('div', 'cg-best');
    var btnX = el('button', 'gm-btn', '✕ 나가기'); btnX.type = 'button'; bar.appendChild(btnX);
    root.appendChild(cv); root.appendChild(bar); root.appendChild(bestEl); root.appendChild(msgEl); document.body.appendChild(root);
    var DPR = Math.min(2, window.devicePixelRatio || 1), SW = 0, SH = 0, pts = [], drawing = false, res = null, shown = 0, raf = 0, alive = true, tries = 0;
    var rank = [], best = 0, rankEl = el('div', 'cg-rank'); root.appendChild(rankEl); try { localStorage.removeItem('circle_best'); } catch (e) {}   // 예전 기기별 최고 기록은 더 이상 쓰지 않음
    function tk() { try { return localStorage.getItem('tok26') || ''; } catch (e) { return ''; } }
    function rapi(body) { return fetch('/api/rank/circle', { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + tk(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }).then(function (r) { return r.json().then(function (j) { j._st = r.status; return j; }); }); }
    function paintBest() {
      best = rank.length ? rank[0].acc : 0; bestEl.textContent = rank.length ? '🏆 최고 ' + best.toFixed(1) + '% · ' + rank[0].name + '  ·  도전 ' + tries + '회' : '🏆 아직 기록이 없어요 · 도전 ' + tries + '회';
      clear2(rankEl); rankEl.appendChild(el('div', 'cg-rt', '🏆 랭킹'));
      if (!rank.length) rankEl.appendChild(el('div', 'cg-rn', '첫 기록의 주인공이 되어 보세요!'));
      rank.slice(0, 8).forEach(function (r, i) { var row = el('div', 'cg-rr' + (i === 0 ? ' top' : '')); row.appendChild(el('span', 'cg-rk', i === 0 ? '👑' : String(i + 1))); row.appendChild(el('b', null, r.name)); row.appendChild(el('span', 'cg-ra', r.acc.toFixed(1) + '%')); rankEl.appendChild(row); });
    }
    function clear2(e) { while (e.firstChild) e.removeChild(e.firstChild); }
    function loadRank() { rapi().then(function (j) { if (j && j.list) { rank = j.list; paintBest(); } }).catch(function () {}); }
    paintBest(); loadRank();
    function askName(acc) {   // 최고 기록을 깼을 때 이름을 써서 랭킹에 기록
      var ov = el('div', 'cg-ask'), card = el('div', 'cg-askc'); card.appendChild(el('h2', null, '🏆 새 최고 기록 ' + acc.toFixed(1) + '%!')); card.appendChild(el('div', 'cg-asks', '이름을 써서 랭킹에 남겨요'));
      var inp = el('input', 'cg-in'); inp.type = 'text'; inp.maxLength = 10; inp.placeholder = '이름 (10자까지)'; try { inp.value = localStorage.getItem('circle_name') || ''; } catch (e) {} card.appendChild(inp);
      var chips = el('div', 'cg-chips'); card.appendChild(chips);
      fetch('/api/classmates', { headers: { authorization: 'Bearer ' + tk() }, cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { (j.students || []).forEach(function (st) { var b = el('button', 'cg-chip', st.name); b.type = 'button'; b.addEventListener('click', function () { inp.value = st.name; }); chips.appendChild(b); }); }).catch(function () {});
      var msg = el('div', 'cg-askm'), row = el('div', 'cg-askr'), ok = el('button', 'gm-big', '기록하기'), skip = el('button', 'gm-big out', '건너뛰기'); ok.type = skip.type = 'button';
      skip.addEventListener('click', function () { ov.remove(); });
      ok.addEventListener('click', function () {
        var nm = inp.value.trim(); if (!nm) { msg.textContent = '이름을 써 주세요'; return; } ok.disabled = true;
        rapi({ name: nm, acc: acc }).then(function (j) { if (j && j.list) { rank = j.list; try { localStorage.setItem('circle_name', nm); } catch (e) {} paintBest(); ov.remove(); say('👑 ' + nm + ' 님이 랭킹 1위!', 'best'); } else { ok.disabled = false; if (j && j.list === undefined && j._st === 409) { msg.textContent = '그 사이에 더 높은 기록이 나왔어요'; loadRank(); } else msg.textContent = '기록하지 못했어요 (로그인이 필요해요)'; } }).catch(function () { ok.disabled = false; msg.textContent = '연결이 불안정해요'; });
      });
      row.appendChild(ok); row.appendChild(skip); card.appendChild(msg); card.appendChild(row); ov.appendChild(card); ov.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); root.appendChild(ov); setTimeout(function () { try { inp.focus(); } catch (e) {} }, 100);
    }
    function resize() { SW = window.innerWidth; SH = window.innerHeight; cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR); cv.style.width = SW + 'px'; cv.style.height = SH + 'px'; }
    function say(t, cls) { msgEl.textContent = t; msgEl.className = 'cg-msg' + (cls ? ' ' + cls : ''); }
    function start() { pts = []; res = null; shown = 0; say('가운데 점을 중심으로 원을 한 번에 그려 보세요 ✏️', 'hint'); }
    function dcol(d) { var t = Math.max(0, Math.min(1, d / 0.12)); return 'hsl(' + Math.round(130 - 130 * t) + ',90%,60%)'; }   // 잘 그린 곳 초록 → 벗어난 곳 빨강
    function down(e) { if (res && shown < 0.98 * res.acc) return; start(); drawing = true; pts.push([e.clientX, e.clientY]); try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); }
    function move(e) { if (!drawing) return; var l = pts[pts.length - 1]; if (Math.hypot(e.clientX - l[0], e.clientY - l[1]) > 1.5) pts.push([e.clientX, e.clientY]); }
    function up() {
      if (!drawing) return; drawing = false; tries++;
      var r = scoreCircle(pts, SW / 2, SH / 2); if (r.err) { res = null; say(r.err + ' 🙂', 'err'); paintBest(); return; }
      res = r; shown = 0; var newBest = r.acc > best; paintBest();
      var a = r.acc; say(a >= 99 ? '🤯 소름… 거의 완벽한 원!' : a >= 95 ? '😲 엄청나요! 컴퍼스급' : a >= 90 ? '😎 아주 잘 그렸어요' : a >= 80 ? '👍 꽤 둥글어요' : a >= 60 ? '🙂 조금만 더!' : a >= 35 ? '🥔 감자 모양… 다시 도전' : '🎯 가운데 점이 원의 중심이에요! 점을 감싸며 그려 보세요', (newBest ? 'best' : '') + ' res');
      if (newBest) { msgEl.textContent += '  ⭐ 최고 기록!'; setTimeout(function () { if (alive && res && res === r) askName(r.acc); }, 1400); }
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function kd(e) { if (e.key === 'Escape') close(); } document.addEventListener('keydown', kd); window.addEventListener('resize', resize);
    function frame() {
      raf = 0; if (!alive) return;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); var g = ctx.createRadialGradient(SW / 2, SH / 2, 50, SW / 2, SH / 2, Math.max(SW, SH) * 0.7); g.addColorStop(0, '#16204d'); g.addColorStop(1, '#05071a'); ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(SW / 2, SH / 2, 5, 0, 6.28); ctx.fill();   // 기준점(가운데)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (res) {
        ctx.strokeStyle = 'rgba(120,255,170,.7)'; ctx.lineWidth = 3; ctx.setLineDash([10, 9]); ctx.beginPath(); ctx.arc(res.cx, res.cy, res.r, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
        for (var i = 1; i < pts.length; i++) { ctx.strokeStyle = dcol(Math.abs(res.rs[i] - res.r) / res.r); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
        shown += (res.acc - shown) * 0.12 + 0.05; if (shown > res.acc) shown = res.acc;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18;
        ctx.font = '900 ' + Math.round(Math.min(SW, SH) * 0.2) + 'px system-ui,sans-serif'; ctx.fillText(shown.toFixed(1) + '%', res.cx, res.cy); ctx.shadowBlur = 0;
      } else if (pts.length > 1) {
        ctx.strokeStyle = '#7FE0FF'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    function close() { if (!alive) return; alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); window.removeEventListener('resize', resize); root.remove(); curC = null; if (opts.onExit) opts.onExit(); }
    btnX.addEventListener('click', close);
    resize(); start(); curC = { close: close }; raf = requestAnimationFrame(frame);
    window.Game26._debugC = { score: scoreCircle, state: function () { return { res: res, best: best, tries: tries }; } };
  }

  // ================= 포트리스 (턴제 대포 게임) =================
  // 한 화면에서 좌(1P)·우(2P)가 번갈아: 손가락을 '당겼다 놓으면' 당긴 반대 방향으로 발사 (각도=당긴 방향, 파워=당긴 길이). 바람·지형 파괴·체력 100
  var curF = null;
  function fortress(opts) {
    if (curF) return; opts = opts || {};
    var root = el('div', 'gm-root fg-root'), cv = el('canvas', 'gm-cv'), ctx = cv.getContext('2d'), bar = el('div', 'gm-bar');
    var btnR = el('button', 'gm-btn', '🔁 다시'), btnS = el('button', 'gm-btn', '🔇 소리 꺼짐'), btnX = el('button', 'gm-btn', '✕ 나가기'); [btnR, btnS, btnX].forEach(function (b) { b.type = 'button'; bar.appendChild(b); });
    root.appendChild(cv); root.appendChild(bar); document.body.appendChild(root);
    var DPR = Math.min(2, window.devicePixelRatio || 1), SW = 0, SH = 0, FW = 1600, FH = 800, sc = 1, ox = 0, oy = 0, alive = true, raf = 0, last = 0, sound = false, ac = null, wins = [0, 0], g, aim = null, T;
    var CR = 40, GRAV = 620, MAXV = 1050, MOVE = 160;
    function beep(f, d, v) { if (!sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); var o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(gn); gn.connect(ac.destination); var t = ac.currentTime; gn.gain.setValueAtTime(v || 0.04, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }
    function topAt(x) { x = Math.max(0, Math.min(FW - 1, Math.round(x))); return g.h[x]; }
    function newGame() {
      var h = [], ph = [Math.random() * 6, Math.random() * 6, Math.random() * 6], base = FH * 0.62;
      for (var x = 0; x < FW; x++) { var u = x / FW, hill = Math.sin(u * 6.28 + ph[0]) * 60 + Math.sin(u * 14 + ph[1]) * 30 + Math.sin(u * 31 + ph[2]) * 9; hill += -Math.cos(u * 6.28 * 1) * 0; h.push(base + hill + Math.sin(u * 3.14) * -50); }
      g = { h: h, phase: 'aim', turn: Math.floor(Math.random() * 2), wind: 0, tanks: [{ x: FW * 0.13, y: 0, hp: 100, a: 45, p: 0.6, fuel: MOVE, drop: 0 }, { x: FW * 0.87, y: 0, hp: 100, a: 135, p: 0.6, fuel: MOVE, drop: 0 }], shot: null, parts: [], expl: [], msg: '', msgT: 0, over: 0, winner: -1, trail: [], t: 0 };
      g.tanks.forEach(function (t) { t.y = topAt(t.x); }); newWind(); say('1P'.replace('1', g.turn + 1) + ' 차례');
    }
    function newWind() { g.wind = Math.round((Math.random() * 2 - 1) * 8); }
    function say(t) { g.msg = t; g.msgT = 1.6; }
    function resize() { SW = window.innerWidth; SH = window.innerHeight; cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR); cv.style.width = SW + 'px'; cv.style.height = SH + 'px'; sc = Math.min(SW / FW, (SH - 70) / FH); ox = (SW - FW * sc) / 2; oy = Math.max(60, (SH - FH * sc) / 2 + 20); }
    function toW(px, py) { return [(px - ox) / sc, (py - oy) / sc]; }
    // 입력: 현재 차례인 사람의 칸(좌/우 절반)에서 당겼다 놓기
    var drag = null;
    function down(e) {
      if (g.phase !== 'aim') { if (g.phase === 'over' && g.over > 1.2) newGame(); return; }
      var side = e.clientX < SW / 2 ? 0 : 1; if (side !== g.turn) { say((g.turn + 1) + 'P 차례예요!'); return; }
      var bt = moveBtnAt(e.clientX, e.clientY); if (bt) { drag = { id: e.pointerId, move: bt }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} return; }
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
    }
    function move(e) { if (drag && drag.id === e.pointerId && !drag.move) { drag.cx = e.clientX; drag.cy = e.clientY; applyAim(); } }
    function up(e) {
      if (!drag || drag.id !== e.pointerId) return; var d = drag; drag = null; if (d.move) return;
      var t = g.tanks[g.turn]; if (g.phase !== 'aim') return;
      if (t.p < 0.14) { say('더 길게 당겨요!'); return; } fire();
    }
    function applyAim() {
      var t = g.tanks[g.turn], dx = (drag.sx - drag.cx) / sc, dy = (drag.sy - drag.cy) / sc, L = Math.hypot(dx, dy);
      t.p = Math.min(1, L / 260); if (L > 6) { var ang = Math.atan2(-dy, dx) * 180 / Math.PI; t.a = (ang + 360) % 360; if (t.a > 180 && t.a < 270) t.a = 180; else if (t.a >= 270) t.a = 0; }
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    var keys = {};
    function kd(e) { if (e.key === 'Escape') close(); keys[e.key.toLowerCase()] = true; }
    function ku(e) { keys[e.key.toLowerCase()] = false; }
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); window.addEventListener('resize', resize);
    // 이동 버튼(차례인 쪽 아래): ◀ ▶ 누르고 있으면 연료만큼 이동
    function moveBtnRects() { var base = g.turn === 0 ? 40 : SW - 40 - 150; return [{ x: base, y: SH - 90, w: 70, h: 56, d: -1 }, { x: base + 80, y: SH - 90, w: 70, h: 56, d: 1 }]; }
    function moveBtnAt(px, py) { var r = moveBtnRects(); for (var i = 0; i < r.length; i++) if (px >= r[i].x && px <= r[i].x + r[i].w && py >= r[i].y && py <= r[i].y + r[i].h) return r[i].d; return 0; }

    function fire() {
      var t = g.tanks[g.turn], rad = t.a * Math.PI / 180, v = t.p * MAXV, bx = t.x + Math.cos(rad) * 28, by = t.y - 16 - Math.sin(rad) * 28;
      g.shot = { x: bx, y: by, vx: Math.cos(rad) * v, vy: -Math.sin(rad) * v, o: g.turn, age: 0 }; g.trail = []; g.phase = 'fly'; beep(200, 0.2, 0.06);
    }
    function explode(x, y, owner) {
      for (var cx = Math.max(0, Math.floor(x - CR)); cx <= Math.min(FW - 1, Math.ceil(x + CR)); cx++) { var dx = cx - x, dy = Math.sqrt(Math.max(0, CR * CR - dx * dx)); if (g.h[cx] >= y - dy) g.h[cx] = Math.max(g.h[cx], Math.min(FH, y + dy)); }
      g.expl.push({ x: x, y: y, t: 0 }); for (var k = 0; k < 30; k++) { var a = Math.random() * 6.28, sp = 80 + Math.random() * 320; g.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.5 + Math.random() * 0.5, c: Math.random() < 0.5 ? '#FFB347' : '#7A5B3A' }); }
      g.tanks.forEach(function (t, i) { var d = Math.hypot(t.x - x, t.y - 14 - y); if (d < CR * 1.9) { var dm = Math.round(Math.max(4, 46 * (1 - d / (CR * 1.9)))); t.hp = Math.max(0, t.hp - dm); t.hit = { v: dm, t: 1.2 }; } });
      beep(90, 0.35, 0.08); g.settle = 0.9;
    }
    function nextTurn() {
      var dead = g.tanks.filter(function (t) { return t.hp <= 0; });
      if (dead.length) { g.phase = 'over'; g.over = 0; g.winner = g.tanks[0].hp > 0 ? 0 : g.tanks[1].hp > 0 ? 1 : -1; if (g.winner >= 0) wins[g.winner]++; return; }
      g.turn = 1 - g.turn; g.tanks[g.turn].fuel = MOVE; newWind(); g.phase = 'aim'; say((g.turn + 1) + 'P 차례');
    }
    function update(dt) {
      g.t += dt; g.msgT = Math.max(0, g.msgT - dt); if (g.phase === 'over') g.over += dt;
      var i; for (i = g.expl.length - 1; i >= 0; i--) { g.expl[i].t += dt; if (g.expl[i].t > 0.5) g.expl.splice(i, 1); }
      for (i = g.parts.length - 1; i >= 0; i--) { var p = g.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; if (p.life <= 0) g.parts.splice(i, 1); }
      g.tanks.forEach(function (t) { if (t.hit) { t.hit.t -= dt; if (t.hit.t <= 0) t.hit = null; } var gy = topAt(t.x); if (t.y < gy) { t.y = Math.min(gy, t.y + 500 * dt); } else t.y = gy; });   // 땅이 사라지면 떨어짐
      if (g.phase === 'aim') {   // 이동
        var tk = g.tanks[g.turn], dir = 0; if (drag && drag.move) dir = drag.move; if (g.turn === 0) { if (keys.a) dir = -1; if (keys.d) dir = 1; } else { if (keys.arrowleft) dir = -1; if (keys.arrowright) dir = 1; }
        if (dir && tk.fuel > 0) { var nx = Math.max(30, Math.min(FW - 30, tk.x + dir * 90 * dt)), slope = Math.abs(topAt(nx) - topAt(tk.x)); if (slope < 12) { tk.fuel -= Math.abs(nx - tk.x); tk.x = nx; } }
        if (g.turn === 0) { if (keys.w) { tk.a = Math.min(180, tk.a + 40 * dt); } } 
      }
      if (g.phase === 'fly' && g.shot) {
        var s = g.shot, steps = 4;
        for (var k = 0; k < steps; k++) {
          var h = dt / steps; s.vx += g.wind * 30 * h; s.vy += GRAV * h; s.x += s.vx * h; s.y += s.vy * h; s.age += h;
          if (g.trail.length === 0 || Math.hypot(s.x - g.trail[g.trail.length - 1][0], s.y - g.trail[g.trail.length - 1][1]) > 10) g.trail.push([s.x, s.y]);
          var hitT = -1; g.tanks.forEach(function (t, ti) { if (s.age > 0.12 && Math.hypot(s.x - t.x, s.y - 14 - t.y) < 24) hitT = ti; });
          if (s.x < -60 || s.x > FW + 60 || s.y > FH + 40) { g.shot = null; g.phase = 'wait'; g.waitT = 0.9; say('빗나감!'); break; }
          if (hitT >= 0 || (s.y >= topAt(s.x) && s.x >= 0 && s.x < FW)) { explode(s.x, s.y, s.o); g.shot = null; g.phase = 'settle'; g.waitT = 1.2; break; }
        }
      } else if (g.phase === 'wait' || g.phase === 'settle') { g.waitT -= dt; if (g.waitT <= 0) nextTurn(); }
    }
    // ---------- 그리기 ----------
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var sky = ctx.createLinearGradient(0, 0, 0, SH); sky.addColorStop(0, '#16296b'); sky.addColorStop(1, '#6b8fd8'); ctx.fillStyle = sky; ctx.fillRect(0, 0, SW, SH);
      ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; [[300, 120, 70], [820, 80, 50], [1280, 150, 80]].forEach(function (c) { ctx.beginPath(); ctx.ellipse(c[0] + Math.sin(g.t * 0.1 + c[0]) * 10, c[1], c[2], c[2] * 0.4, 0, 0, 6.28); ctx.fill(); });
      // 지형
      var gr = ctx.createLinearGradient(0, FH * 0.4, 0, FH); gr.addColorStop(0, '#5a8f3a'); gr.addColorStop(0.15, '#6b4f2d'); gr.addColorStop(1, '#3a2a18'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, FH); for (var x = 0; x < FW; x += 2) ctx.lineTo(x, g.h[x]); ctx.lineTo(FW, FH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8fd15a'; ctx.lineWidth = 4; ctx.beginPath(); for (var x2 = 0; x2 < FW; x2 += 2) { if (x2 === 0) ctx.moveTo(0, g.h[0]); else ctx.lineTo(x2, g.h[x2]); } ctx.stroke();
      // 탱크
      g.tanks.forEach(function (t, i) {
        var col = COL[i][0], ang = t.a * Math.PI / 180; ctx.save(); ctx.translate(t.x, t.y);
        if (t.hit && Math.floor(t.hit.t * 20) % 2 === 0) ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#222'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(Math.cos(ang) * 30, -16 - Math.sin(ang) * 30); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(Math.cos(ang) * 30, -16 - Math.sin(ang) * 30); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(20, -14); ctx.lineTo(-20, -14); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(-28, -2, 56, 6);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -16, 11, Math.PI, 0); ctx.fill();
        ctx.restore();
        // 체력 막대 + 이름
        var bw = 70; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(t.x - bw / 2, t.y - 58, bw, 9); ctx.fillStyle = t.hp > 50 ? '#7CFF8A' : t.hp > 25 ? '#FFD36B' : '#FF6B6B'; ctx.fillRect(t.x - bw / 2, t.y - 58, bw * t.hp / 100, 9);
        ctx.fillStyle = '#fff'; ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText((i + 1) + 'P ' + t.hp, t.x, t.y - 64);
        if (t.hit) { ctx.fillStyle = '#FFE08A'; ctx.font = '900 22px system-ui,sans-serif'; ctx.fillText('-' + t.hit.v, t.x, t.y - 86 - (1.2 - t.hit.t) * 30); }
        if (g.phase === 'aim' && g.turn === i) { ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.moveTo(t.x, t.y - 100); ctx.lineTo(t.x - 9, t.y - 114); ctx.lineTo(t.x + 9, t.y - 114); ctx.closePath(); ctx.fill(); }
      });
      // 조준 선(가이드: 짧게)과 파워
      if (g.phase === 'aim') {
        var t0 = g.tanks[g.turn], rad = t0.a * Math.PI / 180, v0 = t0.p * MAXV, px = t0.x + Math.cos(rad) * 28, py = t0.y - 16 - Math.sin(rad) * 28, vx = Math.cos(rad) * v0, vy = -Math.sin(rad) * v0;
        if (t0.p > 0.05) { ctx.fillStyle = 'rgba(255,255,255,.8)'; for (var n = 1; n <= 9; n++) { var tt = n * 0.07, qx = px + vx * tt + 0.5 * g.wind * 30 * tt * tt, qy = py + vy * tt + 0.5 * GRAV * tt * tt; ctx.beginPath(); ctx.arc(qx, qy, 3.2 - n * 0.2, 0, 6.28); ctx.fill(); } }
      }
      if (g.shot) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.beginPath(); g.trail.forEach(function (q, i) { if (!i) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }); ctx.stroke(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(g.shot.x, g.shot.y, 7, 0, 6.28); ctx.fill(); ctx.fillStyle = COL[g.shot.o][0]; ctx.beginPath(); ctx.arc(g.shot.x, g.shot.y, 4.5, 0, 6.28); ctx.fill(); }
      g.expl.forEach(function (e) { var r = CR * (0.5 + e.t * 2.2); ctx.globalAlpha = Math.max(0, 1 - e.t * 2); ctx.fillStyle = '#FFD36B'; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 6.28); ctx.fill(); ctx.fillStyle = '#FF7A3D'; ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.6, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; });
      g.parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); ctx.fillStyle = p.c; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }); ctx.globalAlpha = 1;
      ctx.restore();
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(0, oy + FH * sc - 1, SW, SH);   // 지형 아래 빈 띠 메우기
      // HUD (화면 좌표)
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(SW / 2 - 130, 52, 260, 46); ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui,sans-serif';
      var wtxt = g.wind === 0 ? '바람 없음' : (g.wind < 0 ? '◀ ' : '') + '바람 ' + Math.abs(g.wind) + (g.wind > 0 ? ' ▶' : ''); ctx.fillText(wtxt, SW / 2, 75);
      ctx.font = '700 15px system-ui,sans-serif'; ctx.fillStyle = COL[0][0]; ctx.textAlign = 'left'; ctx.fillText('1P ' + wins[0] + '승', 20, 76); ctx.fillStyle = COL[1][0]; ctx.textAlign = 'right'; ctx.fillText('2P ' + wins[1] + '승', SW - 20, 76);
      if (g.phase === 'aim') {
        var tk = g.tanks[g.turn], bx = g.turn === 0 ? 40 : SW - 40 - 150, rr = moveBtnRects();
        ctx.textAlign = 'center'; rr.forEach(function (r) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#fff'; ctx.font = '900 26px system-ui,sans-serif'; ctx.fillText(r.d < 0 ? '◀' : '▶', r.x + r.w / 2, r.y + r.h / 2); });
        ctx.font = '700 14px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('이동 ' + Math.round(tk.fuel / MOVE * 100) + '%', bx + 75, SH - 100);
        var ang = tk.a > 90 ? 180 - tk.a : tk.a; ctx.textAlign = g.turn === 0 ? 'left' : 'right'; ctx.font = '800 20px system-ui,sans-serif'; ctx.fillStyle = '#fff'; var tx = g.turn === 0 ? 40 : SW - 40;
        ctx.fillText('각도 ' + Math.round(ang) + '° · 파워 ' + Math.round(tk.p * 100) + '%', tx, SH - 120);
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(g.turn === 0 ? 40 : SW - 40 - 220, SH - 136 - 18, 220, 8); ctx.fillStyle = '#FFE08A'; ctx.fillRect(g.turn === 0 ? 40 : SW - 40 - 220, SH - 154, 220 * tk.p, 8);
        ctx.textAlign = 'center'; ctx.font = '700 16px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('내 쪽 화면을 손가락으로 당겼다가 놓으면 발사! (당긴 반대 방향으로 날아가요)', SW / 2, SH - 24);
      }
      if (g.msgT > 0 && g.phase !== 'over') { ctx.globalAlpha = Math.min(1, g.msgT * 2); ctx.fillStyle = '#fff'; ctx.font = '900 44px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.msg, SW / 2, SH * 0.3); ctx.globalAlpha = 1; }
      if (g.phase === 'over') { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = '#FFE08A'; ctx.font = '900 64px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.winner < 0 ? '무승부!' : '🏆 ' + (g.winner + 1) + 'P 승리!', SW / 2, SH / 2 - 20); if (g.over > 1.2) { ctx.fillStyle = '#fff'; ctx.font = '700 24px system-ui,sans-serif'; ctx.fillText('화면을 눌러 다시 하기', SW / 2, SH / 2 + 40); } }
    }
    function frame(now) { raf = 0; if (!alive) return; var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; update(dt); draw(); raf = requestAnimationFrame(frame); }
    function close() { if (!alive) return; alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); root.remove(); curF = null; if (opts.onExit) opts.onExit(); }
    btnX.addEventListener('click', close); btnR.addEventListener('click', newGame);
    btnS.addEventListener('click', function () { sound = !sound; btnS.textContent = sound ? '🔊 소리 켜짐' : '🔇 소리 꺼짐'; if (sound) beep(500, 0.08, 0.04); });
    resize(); newGame(); curF = { close: close }; raf = requestAnimationFrame(frame);
    window.Game26._debugF = { state: function () { return g; }, aimTo: function (a, p) { var t = g.tanks[g.turn]; t.a = a; t.p = p; }, fire: fire, wins: wins };
  }

  // ================= 게임 고르기 =================
  var hubOpen = null;
  function hub(opts) {
    if (hubOpen) return; opts = opts || {};
    var root = el('div', 'gm-hub'), card = el('div', 'gm-hubc'); card.appendChild(el('h2', null, '🎮 미니게임'));
    var row = el('div', 'gm-hubrow');
    [['⚔️', '2인 대전', '한 화면을 반으로 나눠 마주 보고 결투 (🔥 눌러서 발사)', function () { show({}); }], ['⭕', '원 그리기', '한 번에 원을 그려 정확도(%) 도전!', function () { circle({}); }], ['💣', '포트리스', '번갈아 대포를 쏴서 상대 탱크를 맞혀요 (바람·지형 파괴)', function () { fortress({}); }]].forEach(function (g) {
      var b = el('button', 'gm-hubb'); b.type = 'button'; b.appendChild(el('div', 'gm-hube', g[0])); b.appendChild(el('b', null, g[1])); b.appendChild(el('small', null, g[2])); b.addEventListener('click', g[3]); row.appendChild(b);
    });
    var x = el('button', 'gm-btn', '✕ 닫기'); x.type = 'button'; x.addEventListener('click', function () { root.remove(); hubOpen = null; if (opts.onExit) opts.onExit(); });
    card.appendChild(row); card.appendChild(x); root.appendChild(card); document.body.appendChild(root); hubOpen = root;
  }
  window.Game26 = { show: show, circle: circle, fortress: fortress, hub: hub };
})();
