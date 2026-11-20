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
  // 한 화면에서 좌(1P)·우(2P)가 번갈아: 손가락을 '당겼다 놓으면' 당긴 반대 방향으로 발사 (각도=당긴 방향, 파워=당긴 길이). 바람·2D 지형 파괴·체력 100
  var curF = null;
  function fortress(opts) {
    if (curF) return; opts = opts || {};
    var root = el('div', 'gm-root fg-root'), cv = el('canvas', 'gm-cv'), ctx = cv.getContext('2d'), bar = el('div', 'gm-bar');
    var btnM = el('button', 'gm-btn', '🗺 맵 변경'), btnR = el('button', 'gm-btn', '🔁 다시'), btnS = el('button', 'gm-btn', '🔇 소리 꺼짐'), btnX = el('button', 'gm-btn', '✕ 나가기');
    [btnM, btnR, btnS, btnX].forEach(function (b) { b.type = 'button'; bar.appendChild(b); });
    root.appendChild(cv); root.appendChild(bar); document.body.appendChild(root);

    var DPR = Math.min(2, window.devicePixelRatio || 1), SW = 0, SH = 0, FW = 1600, FH = 800, sc = 1, ox = 0, oy = 0, alive = true, raf = 0, last = 0, sound = false, ac = null, wins = [0, 0], g;
    var CR = 46, GRAV = 620, MAXV = 1120, MOVE = 170, BEDROCK = 24, MS = 2, MW = FW / MS, MH = FH / MS;
    var TCOL = [['#38BDF8', '#0284C7', '#BAE6FD'], ['#FB7185', '#E11D48', '#FECDD3']];
    var terCv = document.createElement('canvas'); terCv.width = FW; terCv.height = FH;
    var terCtx = terCv.getContext('2d'), solid = new Uint8Array(MW * MH);
    var mapIdx = Math.floor(Math.random() * 4);

    function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function bump(x, cx, w, h) { var d = (x - cx) / w; return h * Math.exp(-d * d); }
    function roundRect(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }

    var MAPS = [
      {
        name: '⛰️ 황혼의 거대 산맥',
        sky: ['#16183E', '#4B285A', '#AD4C5A', '#F29D63'],
        stars: 0.3,
        celestial: { x: 1180, y: 200, r: 60, c: '#FFE49E', glow: 'rgba(255,190,110,.38)' },
        farCol: '#2B1F48', midCol: '#3F274B',
        crust: '#63C448', crustHi: '#9EE870',
        earth: ['#9B5B38', '#6D3A24', '#391E16'],
        dirt: ['#FFB347', '#9B5B38', '#63C448', '#FFE08A'],
        gen: function (ph) {
          var h = new Float32Array(FW);
          for (var x = 0; x < FW; x++) {
            var u = x / FW, w1 = Math.sin(u * 12 + ph[0]) * 18 + Math.sin(u * 28 + ph[1]) * 7;
            var ledge = (1 - smoothstep(100, 290, x)) + smoothstep(1310, 1500, x);
            var y = 545 + w1 * (1 - ledge * 0.85) - bump(x, 800, 175, 330) - bump(x, 635, 85, 115) - bump(x, 965, 85, 115);
            h[x] = clamp(y, 170, FH - BEDROCK - 35);
          }
          return { h: h };
        }
      },
      {
        name: '🏰 성벽 요새',
        sky: ['#090E24', '#16244C', '#2E457B', '#5E75AA'],
        stars: 0.85,
        celestial: { x: 270, y: 145, r: 42, c: '#FFF5CC', glow: 'rgba(210,230,255,.28)', crescent: true },
        farCol: '#131C3E', midCol: '#1E2C56',
        crust: '#599C6B', crustHi: '#8CD19B',
        earth: ['#697387', '#495264', '#292F3B'],
        dirt: ['#9AA5BA', '#697387', '#599C6B', '#CBD5E1'],
        castle: true,
        gen: function (ph) {
          var h = new Float32Array(FW);
          for (var x = 0; x < FW; x++) {
            var u = x / FW, w1 = Math.sin(u * 10 + ph[0]) * 12 + Math.sin(u * 24 + ph[1]) * 5;
            var ledge = (1 - smoothstep(100, 285, x)) + smoothstep(1315, 1500, x);
            var moat = bump(x, 515, 120, 75) + bump(x, 1085, 120, 75);
            var y = 520 + w1 * (1 - ledge * 0.85) + moat - bump(x, 800, 145, 55);
            h[x] = clamp(y, 180, FH - BEDROCK - 30);
          }
          return { h: h, wall: { x1: 718, x2: 882, top: 222 } };
        }
      },
      {
        name: '🌉 하늘 다리 협곡',
        sky: ['#123A70', '#296CB0', '#6EB0E6', '#D9ECFF'],
        stars: 0,
        celestial: { x: 800, y: 145, r: 50, c: '#FFF8DC', glow: 'rgba(255,245,205,.45)' },
        farCol: '#376BA4', midCol: '#29578B',
        crust: '#59BF6E', crustHi: '#96EB9E',
        earth: ['#8C6D4F', '#5E4632', '#35251A'],
        dirt: ['#B48E68', '#8C6D4F', '#59BF6E', '#E2C9A8'],
        gen: function (ph) {
          var h = new Float32Array(FW);
          for (var x = 0; x < FW; x++) {
            var u = x / FW, w1 = Math.sin(u * 11 + ph[0]) * 16 + Math.sin(u * 25 + ph[1]) * 6;
            var ledge = (1 - smoothstep(100, 285, x)) + smoothstep(1315, 1500, x);
            var y = 550 + w1 * (1 - ledge * 0.85) + bump(x, 470, 110, 48) + bump(x, 1130, 110, 48) - bump(x, 800, 130, 40);
            h[x] = clamp(y, 180, FH - BEDROCK - 32);
          }
          return { h: h, island: { x1: 540, x2: 1060, yTop: 245, yBot: 390 } };
        }
      },
      {
        name: '🌋 쌍둥이 첨탑',
        sky: ['#160818', '#41112B', '#8C2338', '#DE5D3D'],
        stars: 0.4,
        celestial: { x: 800, y: 470, r: 84, c: '#FFB046', glow: 'rgba(255,95,45,.38)' },
        farCol: '#341023', midCol: '#4B162B',
        crust: '#D96636', crustHi: '#FF9D5C',
        earth: ['#5A383A', '#3B2226', '#211216'],
        dirt: ['#FF8A47', '#5A383A', '#D96636', '#FFD080'],
        volcano: true,
        gen: function (ph) {
          var h = new Float32Array(FW);
          for (var x = 0; x < FW; x++) {
            var u = x / FW, w1 = Math.sin(u * 13 + ph[0]) * 14 + Math.sin(u * 29 + ph[1]) * 6;
            var ledge = (1 - smoothstep(100, 285, x)) + smoothstep(1315, 1500, x);
            var spires = bump(x, 570, 74, 328) + bump(x, 1030, 74, 328);
            var y = 562 + w1 * (1 - ledge * 0.85) + bump(x, 800, 105, 88) - spires;
            h[x] = clamp(y, 175, FH - BEDROCK - 28);
          }
          return { h: h };
        }
      }
    ];

    function beep(f, d, v) { if (!sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); var o = ac.createOscillator(), gn = ac.createGain(); o.type = 'triangle'; o.frequency.value = f; o.connect(gn); gn.connect(ac.destination); var t = ac.currentTime; gn.gain.setValueAtTime(v || 0.04, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }
    function playBoom() {
      if (!sound) return;
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        var len = Math.floor(ac.sampleRate * 0.36), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
        for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
        var src = ac.createBufferSource(), flt = ac.createBiquadFilter(), gn = ac.createGain();
        src.buffer = buf; flt.type = 'lowpass'; flt.frequency.setValueAtTime(540, ac.currentTime); flt.frequency.exponentialRampToValueAtTime(90, ac.currentTime + 0.34);
        gn.gain.setValueAtTime(0.22, ac.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
        src.connect(flt); flt.connect(gn); gn.connect(ac.destination); src.start();
      } catch (e) {}
    }

    function isSolid(x, y) {
      if (x < 0 || x >= FW || y < 0) return false;
      if (y >= FH - BEDROCK) return true;
      var mx = (x / MS) | 0, my = (y / MS) | 0;
      if (mx < 0 || mx >= MW || my < 0 || my >= MH) return false;
      return solid[my * MW + mx] === 1;
    }
    function surfaceY(x) {
      x = clamp(Math.round(x), 0, FW - 1);
      for (var y = 0; y < FH - BEDROCK; y += 2) if (isSolid(x, y)) return y;
      return FH - BEDROCK;
    }
    function groundNear(x, refY) {
      x = clamp(Math.round(x), 0, FW - 1);
      var y0 = Math.max(0, Math.round(refY - 24)), y1 = Math.min(FH - BEDROCK, Math.round(refY + 24));
      for (var y = y0; y <= y1; y += 2) if (isSolid(x, y)) return y;
      return refY;
    }
    function syncSolidFromCanvas() {
      var img = terCtx.getImageData(0, 0, FW, FH).data;
      solid.fill(0);
      for (var my = 0; my < MH; my++) {
        var py = my * MS;
        if (py >= FH - BEDROCK) { for (var mx0 = 0; mx0 < MW; mx0++) solid[my * MW + mx0] = 1; continue; }
        var rowOff = py * FW;
        for (var mx = 0; mx < MW; mx++) if (img[(rowOff + mx * MS) * 4 + 3] > 128) solid[my * MW + mx] = 1;
      }
    }

    function buildMap(idx) {
      var map = MAPS[idx], ph = [Math.random() * 6.28, Math.random() * 6.28], geo = map.gen(ph), h = geo.h;
      terCtx.clearRect(0, 0, FW, FH);

      // 1. 기본 지형 외곽선
      terCtx.save();
      terCtx.beginPath();
      terCtx.moveTo(0, FH);
      for (var x = 0; x < FW; x += 2) terCtx.lineTo(x, h[x]);
      terCtx.lineTo(FW, FH); terCtx.closePath();

      // 성벽 요새: 중앙 성벽과 흉벽
      if (geo.wall) {
        var w = geo.wall, bw = 26, gap = 16;
        terCtx.moveTo(w.x1, FH); terCtx.lineTo(w.x1, w.top);
        for (var cx = w.x1; cx < w.x2; cx += bw + gap) {
          var cw = Math.min(bw, w.x2 - cx);
          terCtx.lineTo(cx, w.top - 22); terCtx.lineTo(cx + cw, w.top - 22); terCtx.lineTo(cx + cw, w.top);
        }
        terCtx.lineTo(w.x2, w.top); terCtx.lineTo(w.x2, FH); terCtx.closePath();
      }
      // 하늘 다리 협곡: 중앙 공중 바위 다리
      if (geo.island) {
        var isl = geo.island, mid = (isl.x1 + isl.x2) / 2, hw = (isl.x2 - isl.x1) / 2;
        terCtx.moveTo(isl.x1, (isl.yTop + isl.yBot) / 2);
        for (var ix = isl.x1; ix <= isl.x2; ix += 4) {
          var u = (ix - isl.x1) / (isl.x2 - isl.x1), arch = Math.sin(u * Math.PI);
          terCtx.lineTo(ix, isl.yTop + (1 - arch) * 18 + Math.sin(u * 18 + ph[0]) * 4);
        }
        for (var ix2 = isl.x2; ix2 >= isl.x1; ix2 -= 4) {
          var u2 = (ix2 - isl.x1) / (isl.x2 - isl.x1), arch2 = Math.sin(u2 * Math.PI);
          var jag = Math.abs(Math.sin(u2 * 22 + ph[1])) * 16;
          terCtx.lineTo(ix2, isl.yBot - (1 - arch2) * 32 + jag);
        }
        terCtx.closePath();
      }
      var gr = terCtx.createLinearGradient(0, 180, 0, FH);
      gr.addColorStop(0, map.earth[0]); gr.addColorStop(0.42, map.earth[1]); gr.addColorStop(1, map.earth[2]);
      terCtx.fillStyle = gr; terCtx.fill();

      // 2. 지층·질감·성벽 벽돌·암반(기저층) 클리핑 합성
      terCtx.globalCompositeOperation = 'source-atop';
      for (var s = 0; s < 5; s++) {
        terCtx.fillStyle = s % 2 === 0 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.09)';
        terCtx.beginPath(); var sy = 260 + s * 96; terCtx.moveTo(0, FH);
        for (var sx = 0; sx <= FW; sx += 24) terCtx.lineTo(sx, sy + Math.sin(sx * 0.008 + s + ph[0]) * 18);
        terCtx.lineTo(FW, FH); terCtx.closePath(); terCtx.fill();
      }
      if (geo.wall) {
        terCtx.strokeStyle = 'rgba(20,24,36,.42)'; terCtx.lineWidth = 2;
        for (var by = geo.wall.top; by < FH - BEDROCK; by += 22) {
          terCtx.beginPath(); terCtx.moveTo(geo.wall.x1 - 4, by); terCtx.lineTo(geo.wall.x2 + 4, by); terCtx.stroke();
          var off = ((by / 22) | 0) % 2 ? 18 : 0;
          for (var bx = geo.wall.x1 + off; bx < geo.wall.x2; bx += 36) { terCtx.beginPath(); terCtx.moveTo(bx, by); terCtx.lineTo(bx, by + 22); terCtx.stroke(); }
        }
      }
      if (map.volcano) {
        terCtx.strokeStyle = 'rgba(255,110,45,.26)'; terCtx.lineWidth = 3;
        for (var v = 0; v < 5; v++) {
          var vx0 = 460 + v * 170; terCtx.beginPath(); terCtx.moveTo(vx0, FH);
          for (var vy = FH; vy > 260; vy -= 36) terCtx.lineTo(vx0 + Math.sin(vy * 0.04 + v) * 18, vy);
          terCtx.stroke();
        }
      }
      for (var p = 0; p < 420; p++) {
        terCtx.fillStyle = p % 3 === 0 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.13)';
        terCtx.beginPath(); terCtx.arc(Math.random() * FW, 180 + Math.random() * (FH - 200), 1.5 + Math.random() * 4.5, 0, 6.283); terCtx.fill();
      }
      // 파괴 불가 기저암(바닥)
      var brg = terCtx.createLinearGradient(0, FH - BEDROCK, 0, FH);
      brg.addColorStop(0, '#262333'); brg.addColorStop(1, '#12101A');
      terCtx.fillStyle = brg; terCtx.fillRect(0, FH - BEDROCK, FW, BEDROCK);
      terCtx.fillStyle = 'rgba(255,255,255,.15)'; terCtx.fillRect(0, FH - BEDROCK, FW, 2);

      // 3. 상단 잔디·표층 크러스트 (2D 픽셀 스캔으로 공중 섬 윗면까지 전부 커버)
      var raw = terCtx.getImageData(0, 0, FW, FH).data;
      terCtx.fillStyle = map.crust;
      for (var tx = 0; tx < FW; tx += 2) {
        for (var ty = 1; ty < FH - BEDROCK - 4; ty++) {
          var aNow = raw[(ty * FW + tx) * 4 + 3], aUp = raw[((ty - 1) * FW + tx) * 4 + 3];
          if (aNow > 128 && aUp <= 128) {
            terCtx.fillStyle = map.crust; terCtx.fillRect(tx, ty, 3, 12);
            terCtx.fillStyle = map.crustHi; terCtx.fillRect(tx, ty, 3, 3);
            ty += 14;
          }
        }
      }
      terCtx.restore();
      syncSolidFromCanvas();

      // 4. 작은 나무·풀 장식 (스폰 지점 제외, 지형 파괴 시 같이 사라짐)
      var props = [];
      for (var px = 80; px < FW - 80; px += 46 + ((Math.random() * 38) | 0)) {
        if (Math.abs(px - FW * 0.12) < 95 || Math.abs(px - FW * 0.88) < 95) continue;
        var py = surfaceY(px);
        if (py > 180 && py < FH - BEDROCK - 20 && Math.abs(surfaceY(px + 8) - surfaceY(px - 8)) < 10) {
          props.push({ x: px, y: py, kind: Math.random() < 0.45 ? 'tree' : 'tuft', h: 16 + Math.random() * 14 });
        }
      }
      return props;
    }

    function newGame(keepIdx) {
      if (typeof keepIdx === 'number') mapIdx = keepIdx; else mapIdx = (mapIdx + 1) % MAPS.length;
      var props = buildMap(mapIdx);
      var clouds = []; for (var i = 0; i < 6; i++) clouds.push({ x: Math.random() * FW, y: 65 + Math.random() * 155, s: 0.75 + Math.random() * 0.65, spd: 8 + Math.random() * 10 });
      var stars = []; for (var j = 0; j < 75; j++) stars.push([Math.random() * FW, Math.random() * FH * 0.62, Math.random() * 1.6 + 0.5, Math.random() * 6.28]);
      var windPts = []; for (var w = 0; w < 26; w++) windPts.push([Math.random() * FW, Math.random() * FH * 0.78, 18 + Math.random() * 26]);
      g = {
        map: MAPS[mapIdx], props: props, clouds: clouds, stars: stars, windPts: windPts,
        phase: 'aim', turn: Math.floor(Math.random() * 2), wind: 0, shake: 0,
        tanks: [
          { x: FW * 0.12, y: 0, vy: 0, tilt: 0, wheelRot: 0, recoil: 0, hp: 100, a: 55, p: 0.68, lastA: null, lastP: null, fuel: MOVE, hit: null, smokeT: 0 },
          { x: FW * 0.88, y: 0, vy: 0, tilt: 0, wheelRot: 0, recoil: 0, hp: 100, a: 125, p: 0.68, lastA: null, lastP: null, fuel: MOVE, hit: null, smokeT: 0 }
        ],
        shot: null, parts: [], expl: [], msg: '', msgT: 0, over: 0, winner: -1, trail: [], t: 0
      };
      g.tanks.forEach(function (t) { t.y = surfaceY(t.x); });
      newWind(); say((g.turn + 1) + 'P 차례');
    }
    function newWind() { g.wind = Math.round((Math.random() * 2 - 1) * 8); }
    function say(t) { g.msg = t; g.msgT = 1.6; }
    function resize() { SW = window.innerWidth; SH = window.innerHeight; cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR); cv.style.width = SW + 'px'; cv.style.height = SH + 'px'; sc = Math.min(SW / FW, (SH - 70) / FH); ox = (SW - FW * sc) / 2; oy = Math.max(56, (SH - FH * sc) / 2 + 18); }

    // 입력: 현재 차례인 사람의 칸(좌/우 절반)에서 당겼다 놓기
    var drag = null;
    function down(e) {
      if (g.phase !== 'aim') { if (g.phase === 'over' && g.over > 1.2) newGame(mapIdx); return; }
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
      t.p = Math.min(1, L / 260);
      if (L > 6) {
        var ang = Math.atan2(-dy, dx) * 180 / Math.PI; t.a = (ang + 360) % 360;
        if (t.a > 180 && t.a < 270) t.a = 180; else if (t.a >= 270) t.a = 0;
      }
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    var keys = {};
    function kd(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === ' ' && g.phase === 'aim') { e.preventDefault(); if (g.tanks[g.turn].p >= 0.14) fire(); return; }
      keys[e.key.toLowerCase()] = true;
    }
    function ku(e) { keys[e.key.toLowerCase()] = false; }
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); window.addEventListener('resize', resize);
    function moveBtnRects() { var base = g.turn === 0 ? 40 : SW - 40 - 150; return [{ x: base, y: SH - 90, w: 70, h: 56, d: -1 }, { x: base + 80, y: SH - 90, w: 70, h: 56, d: 1 }]; }
    function moveBtnAt(px, py) { var r = moveBtnRects(); for (var i = 0; i < r.length; i++) if (px >= r[i].x && px <= r[i].x + r[i].w && py >= r[i].y && py <= r[i].y + r[i].h) return r[i].d; return 0; }

    function fire() {
      var t = g.tanks[g.turn], rad = t.a * Math.PI / 180, v = t.p * MAXV, bx = t.x + Math.cos(rad) * 32, by = t.y - 16 - Math.sin(rad) * 32;
      t.lastA = t.a; t.lastP = t.p; t.recoil = 1;
      g.shot = { x: bx, y: by, vx: Math.cos(rad) * v, vy: -Math.sin(rad) * v, o: g.turn, age: 0, smT: 0 };
      g.trail = [[bx, by]]; g.phase = 'fly';
      for (var m = 0; m < 10; m++) {
        var ma = rad + (Math.random() - 0.5) * 0.7, ms = 70 + Math.random() * 140;
        g.parts.push({ x: bx, y: by, vx: Math.cos(ma) * ms, vy: -Math.sin(ma) * ms, life: 0.35 + Math.random() * 0.2, maxLife: 0.55, r: 4 + Math.random() * 4, c: m < 4 ? '#FFE08A' : 'rgba(255,255,255,.75)', smoke: m >= 4 });
      }
      beep(210, 0.16, 0.06);
    }

    function explode(x, y, owner) {
      terCtx.save();
      terCtx.beginPath(); terCtx.rect(0, 0, FW, FH - BEDROCK); terCtx.clip();
      terCtx.globalCompositeOperation = 'source-atop';
      var sg = terCtx.createRadialGradient(x, y, Math.max(4, CR * 0.65), x, y, CR + 14);
      sg.addColorStop(0, 'rgba(18,10,6,.88)'); sg.addColorStop(0.55, 'rgba(32,18,10,.62)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      terCtx.fillStyle = sg; terCtx.beginPath(); terCtx.arc(x, y, CR + 14, 0, 6.283); terCtx.fill();
      terCtx.globalCompositeOperation = 'destination-out';
      terCtx.fillStyle = '#000'; terCtx.beginPath(); terCtx.arc(x, y, CR, 0, 6.283); terCtx.fill();
      terCtx.restore();

      var r2 = CR * CR, x0 = Math.max(0, Math.floor((x - CR - 2) / MS)), x1 = Math.min(MW - 1, Math.ceil((x + CR + 2) / MS));
      var y0 = Math.max(0, Math.floor((y - CR - 2) / MS)), y1 = Math.min(Math.floor((FH - BEDROCK - 1) / MS), Math.ceil((y + CR + 2) / MS));
      for (var my = y0; my <= y1; my++) {
        var wy = my * MS + 1 - y;
        for (var mx = x0; mx <= x1; mx++) {
          var wx = mx * MS + 1 - x;
          if (wx * wx + wy * wy <= r2) solid[my * MW + mx] = 0;
        }
      }

      g.shake = Math.min(18, g.shake + 12);
      g.expl.push({ x: x, y: y, t: 0, r: CR });
      var dc = g.map.dirt;
      for (var k = 0; k < 36; k++) {
        var a = Math.random() * 6.283, sp = 70 + Math.random() * 340, isSm = k >= 26;
        g.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (isSm ? 120 : 95), life: (isSm ? 0.75 : 0.45) + Math.random() * 0.45, maxLife: 1.1, r: isSm ? 9 + Math.random() * 10 : 2.5 + Math.random() * 3.5, c: isSm ? 'rgba(90,85,95,.55)' : dc[k % dc.length], smoke: isSm });
      }
      var blastR = CR * 2.0;
      g.tanks.forEach(function (t) {
        var d = Math.hypot(t.x - x, (t.y - 14) - y);
        if (d < blastR) {
          var dm = Math.round(Math.max(5, 48 * (1 - d / blastR)));
          t.hp = Math.max(0, t.hp - dm);
          t.hit = { v: dm, t: 1.35, direct: d < 28 };
        }
      });
      playBoom();
    }

    function nextTurn() {
      var dead = g.tanks.filter(function (t) { return t.hp <= 0; });
      if (dead.length) { g.phase = 'over'; g.over = 0; g.winner = g.tanks[0].hp > 0 ? 0 : g.tanks[1].hp > 0 ? 1 : -1; if (g.winner >= 0) wins[g.winner]++; return; }
      g.turn = 1 - g.turn; g.tanks[g.turn].fuel = MOVE; newWind(); g.phase = 'aim'; say((g.turn + 1) + 'P 차례');
    }

    function update(dt) {
      g.t += dt; g.msgT = Math.max(0, g.msgT - dt); g.shake = Math.max(0, g.shake - dt * 28);
      if (g.phase === 'over') g.over += dt;
      g.clouds.forEach(function (c) { c.x += (c.spd + g.wind * 4.5) * dt; if (c.x > FW + 160) c.x = -160; if (c.x < -160) c.x = FW + 160; });
      g.windPts.forEach(function (w) { w[0] += g.wind * 24 * dt; if (w[0] > FW + 40) w[0] = -40; if (w[0] < -40) w[0] = FW + 40; });

      var i;
      for (i = g.expl.length - 1; i >= 0; i--) { g.expl[i].t += dt; if (g.expl[i].t > 0.55) g.expl.splice(i, 1); }
      for (i = g.parts.length - 1; i >= 0; i--) {
        var p = g.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.smoke) { p.vx *= 1 - 1.5 * dt; p.vy -= 45 * dt; p.r += 10 * dt; } else { p.vy += 520 * dt; }
        p.life -= dt; if (p.life <= 0) g.parts.splice(i, 1);
      }
      for (i = g.props.length - 1; i >= 0; i--) { if (!isSolid(g.props[i].x, g.props[i].y + 3)) g.props.splice(i, 1); }

      g.tanks.forEach(function (t) {
        t.recoil = Math.max(0, t.recoil - dt * 5);
        if (t.hit) { t.hit.t -= dt; if (t.hit.t <= 0) t.hit = null; }
        if (t.hp > 0 && t.hp < 40) {
          t.smokeT -= dt;
          if (t.smokeT <= 0) { t.smokeT = 0.22; g.parts.push({ x: t.x + (Math.random() - 0.5) * 14, y: t.y - 22, vx: g.wind * 6, vy: -35, life: 0.7, maxLife: 0.7, r: 5, c: 'rgba(60,60,70,.45)', smoke: true }); }
        }
        if (!isSolid(t.x, t.y + 1)) {
          t.vy = Math.min(720, t.vy + GRAV * dt);
          var steps = Math.max(1, Math.ceil(t.vy * dt));
          for (var s = 0; s < steps; s++) {
            if (isSolid(t.x, t.y + 1) || t.y >= FH - BEDROCK) { t.vy = 0; break; }
            t.y += 1;
          }
        } else t.vy = 0;
        var yL = groundNear(t.x - 14, t.y), yR = groundNear(t.x + 14, t.y);
        var tgtTilt = clamp(Math.atan2(yR - yL, 28), -0.55, 0.55);
        t.tilt += (tgtTilt - t.tilt) * Math.min(1, dt * 12);
      });

      if (g.phase === 'aim') {
        var tk = g.tanks[g.turn], dir = 0, aimDir = 0;
        if (drag && drag.move) dir = drag.move;
        if (g.turn === 0) { if (keys.a) dir = -1; if (keys.d) dir = 1; if (keys.w) aimDir = 1; if (keys.s) aimDir = -1; }
        else { if (keys.arrowleft) dir = -1; if (keys.arrowright) dir = 1; if (keys.arrowup) aimDir = -1; if (keys.arrowdown) aimDir = 1; }
        if (aimDir) tk.a = clamp(tk.a + aimDir * 48 * dt, 0, 180);
        if (dir && tk.fuel > 0) {
          var nx = clamp(tk.x + dir * 105 * dt, 36, FW - 36), moved = false, ny = tk.y;
          for (var cl = 0; cl <= 14; cl += 2) {
            var cy = tk.y - cl;
            if (!isSolid(nx, cy - 2) && !isSolid(nx, cy - 12) && !isSolid(nx, cy - 20)) {
              if (cl === 0 && !isSolid(nx, cy + 1)) {
                for (var dr = 1; dr <= 10; dr++) if (isSolid(nx, cy + dr + 1)) { ny = cy + dr; moved = true; break; }
                if (!moved) { ny = cy; moved = true; }
              } else { ny = cy; moved = true; }
              break;
            }
          }
          if (moved) {
            var dx = Math.abs(nx - tk.x); tk.fuel = Math.max(0, tk.fuel - dx); tk.x = nx; tk.y = ny; tk.wheelRot += dir * dx * 0.14;
            if (Math.random() < 0.25) g.parts.push({ x: tk.x - dir * 18, y: tk.y - 2, vx: -dir * 25, vy: -20, life: 0.3, maxLife: 0.3, r: 3.5, c: 'rgba(200,190,175,.45)', smoke: true });
          }
        }
      }

      if (g.phase === 'fly' && g.shot) {
        var s = g.shot, spd = Math.hypot(s.vx, s.vy), steps = Math.min(24, Math.max(8, Math.ceil(spd * dt / 4)));
        for (var k = 0; k < steps; k++) {
          var h = dt / steps; s.vx += g.wind * 32 * h; s.vy += GRAV * h; s.x += s.vx * h; s.y += s.vy * h; s.age += h; s.smT += h;
          if (g.trail.length === 0 || Math.hypot(s.x - g.trail[g.trail.length - 1][0], s.y - g.trail[g.trail.length - 1][1]) > 10) g.trail.push([s.x, s.y]);
          if (s.smT > 0.03) { s.smT = 0; g.parts.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 14, vy: -12, life: 0.4, maxLife: 0.4, r: 4, c: 'rgba(255,255,255,.45)', smoke: true }); }
          var hitT = -1;
          g.tanks.forEach(function (t, ti) { if (s.age > 0.14 && Math.hypot(s.x - t.x, s.y - (t.y - 14)) < 24) hitT = ti; });
          if (s.x < -60 || s.x > FW + 60 || s.y > FH + 40) { g.shot = null; g.phase = 'wait'; g.waitT = 0.85; say('빗나감!'); break; }
          if (hitT >= 0 || (s.x >= 0 && s.x < FW && s.y >= 0 && isSolid(s.x, s.y))) { explode(s.x, s.y, s.o); g.shot = null; g.phase = 'settle'; g.waitT = 1.25; break; }
        }
      } else if (g.phase === 'wait' || g.phase === 'settle') { g.waitT -= dt; if (g.waitT <= 0) nextTurn(); }
    }

    function drawTank(t, i) {
      var col = TCOL[i], ang = t.a * Math.PI / 180, rec = t.recoil * 6;
      ctx.save(); ctx.translate(t.x, t.y);
      if (t.hit && Math.floor(t.hit.t * 20) % 2 === 0) ctx.globalAlpha = 0.55;
      ctx.rotate(t.tilt);
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 28, 5, 0, 0, 6.283); ctx.fill();
      // 포신 (탱크 로컬 각도로 반동 적용)
      var relAng = ang + t.tilt;
      ctx.save(); ctx.translate(0, -17); ctx.rotate(-relAng);
      ctx.fillStyle = '#1E293B'; roundRect(ctx, 2 - rec, -4.5, 31, 9, 3); ctx.fill();
      ctx.fillStyle = col[2]; roundRect(ctx, 4 - rec, -3, 25, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#0F172A'; roundRect(ctx, 29 - rec, -5.5, 7, 11, 2); ctx.fill();
      ctx.restore();
      // 장갑 포탑 돔
      var tg = ctx.createLinearGradient(0, -29, 0, -14); tg.addColorStop(0, col[2]); tg.addColorStop(0.35, col[0]); tg.addColorStop(1, col[1]);
      ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, -15, 13, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0F172A'; roundRect(ctx, -5, -30, 10, 4, 2); ctx.fill();
      // 차체
      var hg = ctx.createLinearGradient(0, -16, 0, -3); hg.addColorStop(0, col[0]); hg.addColorStop(1, col[1]);
      ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-25, -4); ctx.lineTo(25, -4); ctx.lineTo(19, -16); ctx.lineTo(-19, -16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-16, -14, 32, 2.5);
      // 궤도 & 바퀴 4개
      ctx.fillStyle = '#1E293B'; roundRect(ctx, -28, -7, 56, 11, 5.5); ctx.fill();
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.stroke();
      for (var w = -18; w <= 18; w += 12) {
        ctx.save(); ctx.translate(w, -1.5); ctx.rotate(t.wheelRot);
        ctx.fillStyle = '#94A3B8'; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      // 체력 바 & 대미지 표시
      var bw = 72; ctx.fillStyle = 'rgba(10,14,32,.68)'; roundRect(ctx, t.x - bw / 2 - 2, t.y - 62, bw + 4, 12, 6); ctx.fill();
      ctx.fillStyle = t.hp > 50 ? '#4ADE80' : t.hp > 25 ? '#FBBF24' : '#F87171';
      if (t.hp > 0) { roundRect(ctx, t.x - bw / 2, t.y - 60, Math.max(6, bw * t.hp / 100), 8, 4); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = '800 14px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText((i + 1) + 'P · ' + t.hp, t.x, t.y - 70);
      if (t.hit) {
        ctx.fillStyle = t.hit.direct ? '#FF6B6B' : '#FFE08A'; ctx.font = '900 24px system-ui,sans-serif';
        ctx.fillText((t.hit.direct ? '직격! -' : '-') + t.hit.v, t.x, t.y - 94 - (1.35 - t.hit.t) * 28);
      }
      if (g.phase === 'aim' && g.turn === i) {
        var bob = Math.sin(g.t * 5) * 4;
        ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.moveTo(t.x, t.y - 86 + bob); ctx.lineTo(t.x - 9, t.y - 100 + bob); ctx.lineTo(t.x + 9, t.y - 100 + bob); ctx.closePath(); ctx.fill();
      }
    }

    // ---------- 그리기 ----------
    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var m = g.map, sky = ctx.createLinearGradient(0, 0, 0, SH);
      sky.addColorStop(0, m.sky[0]); sky.addColorStop(0.4, m.sky[1]); sky.addColorStop(0.78, m.sky[2]); sky.addColorStop(1, m.sky[3]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, SW, SH);

      ctx.save();
      var sxOff = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0, syOff = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
      ctx.translate(ox + sxOff, oy + syOff); ctx.scale(sc, sc);

      // 별 · 해/달
      if (m.stars > 0) g.stars.forEach(function (st) { ctx.fillStyle = 'rgba(255,255,255,' + (m.stars * (0.4 + 0.6 * Math.abs(Math.sin(g.t * 1.4 + st[3])))) + ')'; ctx.beginPath(); ctx.arc(st[0], st[1], st[2], 0, 6.283); ctx.fill(); });
      var cel = m.celestial, cg = ctx.createRadialGradient(cel.x, cel.y, cel.r * 0.4, cel.x, cel.y, cel.r * 3.2);
      cg.addColorStop(0, cel.glow); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cel.x, cel.y, cel.r * 3.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = cel.c; ctx.beginPath(); ctx.arc(cel.x, cel.y, cel.r, 0, 6.283); ctx.fill();
      if (cel.crescent) { ctx.fillStyle = m.sky[1]; ctx.beginPath(); ctx.arc(cel.x + cel.r * 0.36, cel.y - cel.r * 0.2, cel.r * 0.86, 0, 6.283); ctx.fill(); }

      // 원경 산맥 실루엣 (2단 패럴랙스)
      ctx.fillStyle = m.farCol; ctx.beginPath(); ctx.moveTo(0, FH);
      for (var fx = 0; fx <= FW; fx += 40) ctx.lineTo(fx, 430 + Math.sin(fx * 0.004 + 1) * 75 + Math.cos(fx * 0.011) * 30);
      ctx.lineTo(FW, FH); ctx.closePath(); ctx.fill();
      ctx.fillStyle = m.midCol; ctx.beginPath(); ctx.moveTo(0, FH);
      for (var mx = 0; mx <= FW; mx += 36) ctx.lineTo(mx, 485 + Math.sin(mx * 0.006 + 3) * 60 + Math.cos(mx * 0.015) * 24);
      ctx.lineTo(FW, FH); ctx.closePath(); ctx.fill();

      // 구름 & 바람 줄기
      g.clouds.forEach(function (c) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.s, c.s);
        ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.beginPath();
        ctx.arc(0, 0, 32, 0, 6.283); ctx.arc(-28, 6, 22, 0, 6.283); ctx.arc(30, 8, 24, 0, 6.283); ctx.arc(10, -10, 26, 0, 6.283);
        ctx.fill(); ctx.restore();
      });
      if (Math.abs(g.wind) > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 1.6;
        g.windPts.forEach(function (w) { ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.lineTo(w[0] + Math.sign(g.wind) * (w[2] + Math.abs(g.wind) * 3), w[1]); ctx.stroke(); });
      }

      // 2D 픽셀 파괴 지형 + 장식
      ctx.drawImage(terCv, 0, 0);
      g.props.forEach(function (pr) {
        if (pr.kind === 'tree') {
          ctx.fillStyle = '#4E342E'; ctx.fillRect(pr.x - 2, pr.y - 8, 4, 9);
          ctx.fillStyle = m.crust; ctx.beginPath(); ctx.moveTo(pr.x, pr.y - pr.h - 6); ctx.lineTo(pr.x - 10, pr.y - 6); ctx.lineTo(pr.x + 10, pr.y - 6); ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = m.crustHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - 4, pr.y - 8); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 4, pr.y - 7); ctx.stroke();
        }
      });

      g.tanks.forEach(drawTank);

      // 조준 점선
      if (g.phase === 'aim') {
        var t0 = g.tanks[g.turn], rad = t0.a * Math.PI / 180, v0 = t0.p * MAXV, px = t0.x + Math.cos(rad) * 32, py = t0.y - 16 - Math.sin(rad) * 32, vx = Math.cos(rad) * v0, vy = -Math.sin(rad) * v0;
        if (t0.p > 0.05) {
          for (var n = 1; n <= 10; n++) {
            var tt = n * 0.068, qx = px + vx * tt + 0.5 * g.wind * 32 * tt * tt, qy = py + vy * tt + 0.5 * GRAV * tt * tt;
            ctx.fillStyle = 'rgba(255,248,210,' + (0.9 - n * 0.075) + ')';
            ctx.beginPath(); ctx.arc(qx, qy, 3.6 - n * 0.22, 0, 6.283); ctx.fill();
          }
        }
      }

      // 포탄 + 궤적 + 화면 위쪽 마커
      if (g.shot) {
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2.5; ctx.beginPath();
        g.trail.forEach(function (q, idx) { if (!idx) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }); ctx.stroke();
        var sh = g.shot, angS = Math.atan2(sh.vy, sh.vx);
        ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(angS);
        ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.ellipse(-7, 0, 8, 4, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#1E293B'; ctx.beginPath(); ctx.ellipse(1, 0, 8, 5, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = TCOL[sh.o][0]; ctx.beginPath(); ctx.arc(3, 0, 3, 0, 6.283); ctx.fill();
        ctx.restore();
        if (sh.y < 0) {
          ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.moveTo(clamp(sh.x, 20, FW - 20), 6); ctx.lineTo(clamp(sh.x, 20, FW - 20) - 8, 20); ctx.lineTo(clamp(sh.x, 20, FW - 20) + 8, 20); ctx.closePath(); ctx.fill();
          ctx.font = '800 13px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.round(-sh.y / 10) + 'm', clamp(sh.x, 24, FW - 24), 34);
        }
      }

      // 다단계 폭발 + 파편
      g.expl.forEach(function (e) {
        var prog = e.t / 0.55, r = e.r * (0.45 + prog * 1.45);
        ctx.globalAlpha = Math.max(0, 1 - prog);
        ctx.strokeStyle = '#FFE49E'; ctx.lineWidth = 4 * (1 - prog) + 1; ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.18, 0, 6.283); ctx.stroke();
        ctx.fillStyle = '#FF7A3D'; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.65, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.32 * (1 - prog), 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
      });
      g.parts.forEach(function (p) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.6)));
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.fillStyle = '#12101A'; ctx.fillRect(0, oy + FH * sc - 1, SW, SH);

      // HUD (화면 좌표)
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(10,14,32,.62)'; roundRect(ctx, SW / 2 - 140, 48, 280, 54, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#CBD5E1'; ctx.font = '700 12px system-ui,sans-serif'; ctx.fillText(g.map.name, SW / 2, 62);
      ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui,sans-serif';
      var wtxt = g.wind === 0 ? '바람 없음' : (g.wind < 0 ? '◀ ' : '') + '바람 ' + Math.abs(g.wind) + (g.wind > 0 ? ' ▶' : '');
      ctx.fillText(wtxt, SW / 2, 81);
      ctx.fillStyle = 'rgba(255,255,255,.16)'; roundRect(ctx, SW / 2 - 80, 93, 160, 4, 2); ctx.fill();
      if (g.wind !== 0) { var ww = (g.wind / 8) * 80; ctx.fillStyle = '#7FE0FF'; roundRect(ctx, ww > 0 ? SW / 2 : SW / 2 + ww, 93, Math.abs(ww), 4, 2); ctx.fill(); }

      // 상단 좌우 체력·승수 카드
      [[0, 18], [1, SW - 228]].forEach(function (pair) {
        var idx = pair[0], hx = pair[1], tk0 = g.tanks[idx];
        ctx.fillStyle = 'rgba(10,14,32,.58)'; roundRect(ctx, hx, 48, 210, 46, 14); ctx.fill();
        ctx.strokeStyle = g.turn === idx && g.phase === 'aim' ? TCOL[idx][0] : 'rgba(255,255,255,.16)'; ctx.lineWidth = g.turn === idx ? 2 : 1; ctx.stroke();
        ctx.fillStyle = TCOL[idx][0]; ctx.font = '800 14px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText((idx + 1) + 'P (' + wins[idx] + '승)', hx + 12, 62);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(tk0.hp + '%', hx + 198, 62);
        ctx.fillStyle = 'rgba(255,255,255,.15)'; roundRect(ctx, hx + 12, 76, 186, 8, 4); ctx.fill();
        ctx.fillStyle = tk0.hp > 50 ? '#4ADE80' : tk0.hp > 25 ? '#FBBF24' : '#F87171';
        if (tk0.hp > 0) { roundRect(ctx, hx + 12, 76, Math.max(8, 186 * tk0.hp / 100), 8, 4); ctx.fill(); }
      });

      // 드래그 슬링샷 안내선
      if (drag && !drag.move && g.phase === 'aim') {
        ctx.strokeStyle = 'rgba(255,224,138,.75)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.cx, drag.cy); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(drag.sx, drag.sy, 14, 0, 6.283); ctx.stroke();
        ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(drag.cx, drag.cy, 8, 0, 6.283); ctx.fill();
      }

      if (g.phase === 'aim') {
        var tk = g.tanks[g.turn], bx = g.turn === 0 ? 40 : SW - 40 - 150, rr = moveBtnRects();
        ctx.textAlign = 'center';
        rr.forEach(function (r) {
          ctx.fillStyle = 'rgba(10,14,32,.62)'; roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = '900 24px system-ui,sans-serif'; ctx.fillText(r.d < 0 ? '◀' : '▶', r.x + r.w / 2, r.y + r.h / 2);
        });
        ctx.font = '700 13px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText('이동 ' + Math.round(tk.fuel / MOVE * 100) + '%', bx + 75, SH - 102);
        var ang = tk.a > 90 ? 180 - tk.a : tk.a; ctx.textAlign = g.turn === 0 ? 'left' : 'right'; ctx.font = '800 19px system-ui,sans-serif'; ctx.fillStyle = '#fff';
        var tx = g.turn === 0 ? 40 : SW - 40, px0 = g.turn === 0 ? 40 : SW - 40 - 220;
        ctx.fillText('각도 ' + Math.round(ang) + '° · 파워 ' + Math.round(tk.p * 100) + '%', tx, SH - 122);
        ctx.fillStyle = 'rgba(10,14,32,.55)'; roundRect(ctx, px0, SH - 154, 220, 10, 5); ctx.fill();
        ctx.fillStyle = '#FFE08A'; if (tk.p > 0.02) { roundRect(ctx, px0, SH - 154, Math.max(8, 220 * tk.p), 10, 5); ctx.fill(); }
        if (tk.lastP != null) { ctx.fillStyle = '#fff'; ctx.fillRect(px0 + 220 * tk.lastP - 1.5, SH - 157, 3, 16); }
        ctx.textAlign = 'center'; ctx.font = '700 15px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.fillText('내 쪽 화면을 당겼다 놓으면 반대 방향으로 발사! (중간 벽을 넘기거나 파괴하세요)', SW / 2, SH - 22);
      }
      if (g.msgT > 0 && g.phase !== 'over') { ctx.globalAlpha = Math.min(1, g.msgT * 2); ctx.fillStyle = '#fff'; ctx.font = '900 44px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14; ctx.fillText(g.msg, SW / 2, SH * 0.28); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      if (g.phase === 'over') {
        ctx.fillStyle = 'rgba(6,8,20,.58)'; ctx.fillRect(0, 0, SW, SH);
        ctx.fillStyle = '#FFE08A'; ctx.font = '900 62px system-ui,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(g.winner < 0 ? '무승부!' : '🏆 ' + (g.winner + 1) + 'P 승리!', SW / 2, SH / 2 - 20);
        if (g.over > 1.2) { ctx.fillStyle = '#fff'; ctx.font = '700 24px system-ui,sans-serif'; ctx.fillText('화면을 눌러 다음 라운드', SW / 2, SH / 2 + 40); }
      }
    }

    function frame(now) { raf = 0; if (!alive) return; var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; update(dt); draw(); raf = requestAnimationFrame(frame); }
    function close() { if (!alive) return; alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); root.remove(); curF = null; if (opts.onExit) opts.onExit(); }
    btnX.addEventListener('click', close);
    btnR.addEventListener('click', function () { newGame(mapIdx); });
    btnM.addEventListener('click', function () { newGame(); });
    btnS.addEventListener('click', function () { sound = !sound; btnS.textContent = sound ? '🔊 소리 켜짐' : '🔇 소리 꺼짐'; if (sound) beep(500, 0.08, 0.04); });
    resize(); newGame(mapIdx); curF = { close: close }; raf = requestAnimationFrame(frame);
    window.Game26._debugF = { state: function () { return g; }, aimTo: function (a, p) { var t = g.tanks[g.turn]; t.a = a; t.p = p; }, fire: fire, wins: wins, explode: explode, isSolid: isSolid, setMap: function (idx) { newGame(clamp(idx | 0, 0, MAPS.length - 1)); }, maps: MAPS };
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
