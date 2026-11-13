// 오송고 등급컷 아카이브(bldoijoa01-lab/gradecut)의 등급·석차 계산 로직을 옮긴 모듈. 입력 d = cuts.json 의 과목 + {my: 내 점수}
(function () {
  const parse = v => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const unsure = s.includes("?");
    const n = parseFloat(s.replace(/[^\d.]/g, ""));
    return isNaN(n) ? null : { n, unsure, raw: s.replace("?", "") };
  };
  // 내가 넣는 값 검사: 빈칸은 괜찮고, 음수·글자·범위 밖이면 '잘못된 값' (계산에 안 씀)
  const badNum = (v, lo, hi) => {
    const s = String(v ?? "").trim(); if (!s) return false;
    if (!/^\d+(\.\d+)?$/.test(s)) return true;
    const n = parseFloat(s); return n < lo || n > hi;
  };
  const okVal = (v, lo, hi) => badNum(v, lo, hi) ? "" : String(v ?? "").trim();
  const rawOf = id => scores[id]?.my || "";
  const myScore = id => { const v = okVal(rawOf(id), 0, 100); if (!v) return ""; return scoreIssue(docs.find(x => x.id === id), v) ? "" : v; };
  // 나올 수 없는 점수 걸러내기 (계산에 안 쓰고 빨간 칸으로):
  //  (1) 문항 배점(d.items)의 합으로 만들 수 없는 점수 — 실제 성적표 점수 전부가 이 합으로 만들어짐을 확인함
  const possCache = {};
  function possibleOf(d) {
    if (!Array.isArray(d.items) || !d.items.length) return null;
    if (possCache[d.id]) return possCache[d.id];
    const w = d.items.map(v => Math.round(v * 10)), tot = w.reduce((a, b) => a + b, 0), ok = new Uint8Array(tot + 1); ok[0] = 1;
    for (const x of w) for (let t = tot; t >= x; t--) if (ok[t - x]) ok[t] = 1;
    return possCache[d.id] = ok;
  }
  function scoreIssue(d, raw) {
    const s = String(raw ?? "").trim();
    if (!d || !s || badNum(s, 0, 100)) return "";
    const v = parseFloat(s), ok = possibleOf(d);
    if (ok) {
      const t = Math.round(v * 10);
      if (Math.abs(v * 10 - t) > 1e-6 || t >= ok.length || !ok[t]) {
        let lo = Math.min(Math.floor(v * 10 + 1e-6), ok.length - 1), hi = Math.max(Math.ceil(v * 10 - 1e-6), 0);
        while (lo >= 0 && !ok[lo]) lo--;
        while (hi < ok.length && !ok[hi]) hi++;
        const near = [lo >= 0 ? lo / 10 : null, hi < ok.length ? hi / 10 : null].filter(x => x !== null).join(" · ");
        return `${s}점은 나올 수 없는 점수예요(문항 배점 기준). 성적표의 '받은점수'를 그대로 넣어 주세요${near ? " · 가까운 점수 " + near : ""}`;
      }
    }
    if (Array.isArray(d.known) && d.known.length) {
      const K = d.known.slice().sort((a, b) => b[0] - a[0]);
      if (!K.some(k => Math.abs(k[0] - v) < 1e-6)) {
        let hi = [100.0001, 0, false], lo = null;
        for (const k of K) { if (k[0] > v) hi = k; else { lo = k; break; } }
        if (lo && lo[1] - hi[1] - (+lo[2] || 0) <= 0)
          return `${s}점은 알려진 인원과 안 맞아요: ${lo[0]}점과 ${hi[0] > 100 ? "100" : hi[0]}점 사이에는 아무도 없어요`;
      }
    }
    return "";
  }
  // 입력칸: 범위(data-lo/hi)를 달아 두고, 잘못된 값이면 빨간 테두리 + 안내 (issue: 범위는 맞지만 나올 수 없는 점수일 때의 안내)
  const numIn = (attrs, raw, lo, hi, unit, issue = "") => {
    const range = badNum(raw, lo, hi), bad = range || !!issue;
    return `<input class="myin${bad ? " bad" : ""}" ${attrs} data-lo="${lo}" data-hi="${hi}" data-unit="${unit}" value="${esc(raw)}"${bad ? ` aria-invalid="true"` : ""}>${bad ? `<small class="badmsg">${range ? rangeMsg(lo, hi, unit) : esc(issue)}</small>` : ""}`;
  };
  const rangeMsg = (lo, hi, unit) => `${lo}~${hi}${unit} 사이로 넣어 주세요`;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  const sureHit = d => { const m = parse(d.my); return d.sure && m && m.n >= d.sure; };
  function useG(d) {
    if (!d.g) return false;
    if (sureHit(d)) return false;
    if (!String(d.g).includes("?")) return true;
    const m = parse(d.my); const cuts = d.c || [];
    if (!m) return true;
    for (let i = 0; i < 4; i++) {
      const c = parse(cuts[i]);
      if (!c) return true;
      if (m.n >= c.n) return c.unsure;
    }
    return false;
  }

  const CAL = 1.3;
  function fixKnown(d, x, s, wl, wh) {
    if (!Array.isArray(d.known) || !d.known.length) return;
    const K = d.known.slice().sort((a, b) => b[0] - a[0]), same = K.find(k => Math.abs(k[0] - x) < 1e-6);
    if (same && +same[2] > 0) { s.lo = s.mid = s.hi = same[1] - same[2] + 1; return; }
    // 계산이 낸 석차와 학교 석차의 차이(res)를 확실한 점(그 점수 학생이 있는 것)마다 구해, 점 사이에서는 직선으로 이어 보정하고
    // 그 점들에서 멀수록(=정보가 없을수록) 계산의 범위 폭을 되살림 (확실한 점에서는 폭 0)
    const E = [];
    for (const k of K) if (+k[2] > 0) { const r = simRaw(d, k[0]); if (r) E.push({ sc: k[0], res: (k[1] - k[2] + 1) - r.mid }); }
    if (E.length) {
      let up = null, dn = null;
      for (const e of E) { if (e.sc > x) up = e; else { dn = e; break; } }
      let res, scale;
      if (up && dn) { const q = (up.sc - x) / (up.sc - dn.sc); res = up.res + (dn.res - up.res) * q; scale = Math.min(q, 1 - q) * 2; }
      else { const e = up || dn, dist = Math.abs(e.sc - x); res = e.res * Math.max(0, 1 - dist / 25); scale = Math.min(1, dist / 10); }
      s.mid = Math.round(s.mid + res);
      s.lo = Math.round(s.mid - CAL * scale * wl); s.hi = Math.round(s.mid + CAL * scale * wh);
    }
    let hi = null, lo = null;
    for (const k of K) { if (k[0] > x) hi = k; else { lo = k; break; } }
    const minR = hi ? hi[1] + 1 : 1, maxR = lo ? lo[1] - (+lo[2] || 0) : Infinity;
    if (maxR < minR) return;
    s.lo = Math.max(minR, Math.min(maxR, s.lo)); s.hi = Math.max(minR, Math.min(maxR, s.hi)); s.mid = Math.max(minR, Math.min(maxR, s.mid));
    if (s.lo > s.mid) s.lo = s.mid; if (s.hi < s.mid) s.hi = s.mid;
  }
  // 시뮬레이션 표(rx 점수 격자마다 등수 5%/50%/95%, 등급 확률 %)에서 x점 값을 보간
  function simAt(d, x) {
    const s = simRaw(d, x); if (!s) return null;
    const wl = s.mid - s.lo, wh = s.hi - s.mid;
    s.lo = Math.round(s.mid - CAL * wl); s.hi = Math.round(s.mid + CAL * wh);
    fixKnown(d, x, s, wl, wh);
    // 가까이 있는 추정 컷의 90% 범위 폭 w에서, 보정으로 늘어난 불확실성(약 0.38w)만큼 점수를 흔들어 등급 확률을 섞음
    if (s.gp && d.cut_ranges) {
      let w = 0;
      for (const r of Object.values(d.cut_ranges)) {
        const gap = Math.max(r[0] - x, x - r[2], 0), rw = r[2] - r[0];
        if (gap <= 1.5 * rw && rw > w) w = rw;
      }
      if (w > 0) {
        const sg = 0.38 * w, K = [[-2, 0.06], [-1, 0.24], [0, 0.40], [1, 0.24], [2, 0.06]], g = [0, 0, 0, 0, 0];
        for (const [o, wt] of K) { const q = o === 0 ? s : simRaw(d, x + o * sg); (q.gp || s.gp).forEach((v, k) => { g[k] += v * wt; }); }
        s.gp = g;
      }
    }
    return s;
  }
  function simRaw(d, x) {
    const X = d.rx;
    if (!Array.isArray(X) || !Array.isArray(d.r50) || X.length < 2) return null;
    x = Math.max(X[0], Math.min(X[X.length - 1], x));
    let a = 0, b = X.length - 1;
    while (b - a > 1) { const c = (a + b) >> 1; if (X[c] <= x) a = c; else b = c; }
    const t = X[b] > X[a] ? (x - X[a]) / (X[b] - X[a]) : 0;
    const L = arr => arr[a] * (1 - t) + arr[b] * t;
    const gp = Array.isArray(d.gp) ? [0, 1, 2, 3, 4].map(k => d.gp[a][k] * (1 - t) + d.gp[b][k] * t) : null;
    return { lo: Math.round(L(d.r05)), mid: Math.round(L(d.r50)), hi: Math.round(L(d.r95)), gp };
  }
  function gradeProbText(gp) {
    const items = gp.map((p, k) => [k + 1, Math.round(p)]).filter(([, p]) => p >= 1);
    if (items.length === 1 || items.some(([, p]) => p >= 99)) {
      const top = items.reduce((a, b) => (b[1] > a[1] ? b : a));
      return `등급: ${top[0]}등급 (확률 99% 이상)`;
    }
    return "등급 확률: " + items.map(([g, p]) => `${g}등급 ${p}%`).join(" · ");
  }

  // 등급 판단: 확정 컷 → (불확실하면) 시뮬레이션 확률 → 개인 고정값 → 추정 컷
  function gradeInfo(d) {
    const m = parse(d.my); if (!m) return null;
    if (sureHit(d)) return { n: 1, u: false, tip: `${d.sure}점 이상은 석차상 1등급 안에 들어서 확정이에요.` };
    const cuts = d.c || [];
    let det = null;
    for (let i = 0; i < 4; i++) {
      const c = parse(cuts[i]);
      if (!c) { det = i === 0 ? null : { n: i + 1, u: true, below: true }; break; }
      if (m.n >= c.n) { det = { n: i + 1, u: c.unsure }; break; }
      if (i === 3) det = { n: 5, u: false };
    }
    if (det && !det.u) return det;
    const s = simAt(d, m.n);
    if (s && s.gp) {
      let best = 0;
      s.gp.forEach((p, k) => { if (p > s.gp[best]) best = k; });
      const pmax = Math.round(s.gp[best]);
      // 가능한 경우를 다 따져도 99.5% 이상이면 확정으로 (예: 1컷 확정보다 낮고 추정 2컷 범위보다 훨씬 위)
      if (s.gp[best] >= 99.5) {
        const n = best + 1, why = [];
        const side = (ci, above) => {
          const c = parse(cuts[ci]); if (!c) return;
          const r = c.unsure && d.cut_ranges && d.cut_ranges[ci + 1];
          if (!r) why.push(`${ci + 1}컷(${c.raw}) ${above ? "이상" : "아래"}`);
          else why.push(`추정 ${ci + 1}컷 범위(${Math.round(r[0])}~${Math.round(r[2])})보다 ${num(above ? m.n - r[2] : r[0] - m.n)}점 ${above ? "위" : "아래"}`);
        };
        if (n > 1) side(n - 2, false);
        if (n < 5) side(n - 1, true);
        return { n, u: false, tip: (why.length ? why.join(" · ") + "\n" : "") + `가능한 경우를 다 따져도 99% 이상 ${n}등급이라 확정으로 봐요.` };
      }
      return { n: best + 1, u: pmax < 95, prob: true, pmax, tip: gradeProbText(s.gp) + (pmax < 95 ? "\n추정 컷 근처라 등급이 바뀔 수 있어요." : "") };
    }
    if (useG(d)) { const g = String(d.g); return { n: parseInt(g), u: g.includes("?"), tip: "공식 컷은 아직 없지만, 점수로 보면 거의 확실한 등급이에요." }; }
    if (det) return { ...det, tip: det.below ? "아랫 컷이 아직 없어서 몇 등급 이하인지까지만 알 수 있어요." : "추정한 컷 기준이라 실제 컷이 나오면 바뀔 수 있어요." };
    return null;
  }
  const gradeNum = d => gradeInfo(d);
  function rankOf(d) {
    const m = parse(d.my); if (!m) return null;
    const N = parseFloat(d.n) || 0;
    const s = N ? simAt(d, m.n) : null;
    if (s) return { sim: true, rank: Math.max(1, s.mid), lo: Math.max(1, s.lo), hi: Math.min(N, s.hi), N, frac: s.mid / N, gp: s.gp };
    // 분포 모델 표: tab[점수] = 그 점수 이상인 사람 비율 (평균·컷·점수대 인원에 맞춰 미리 계산)
    if (Array.isArray(d.tab) && d.tab.length === 101) {
      const x = Math.max(0, Math.min(100, m.n));
      if (d.tab_min && x < d.tab_min) return { below: true, frac: d.tab[Math.round(d.tab_min)], N, model: true };
      const lo = Math.floor(x), hi = Math.min(100, lo + 1), t = x - lo;
      const frac = d.tab[lo] * (1 - t) + d.tab[hi] * t;
      return { frac, N, model: true, rank: N ? Math.max(1, Math.round(frac * N)) : null };
    }
    const pts = [[100, 0]];
    const fr = [0.10, 0.34, 0.66, 0.90];
    let est = false, lowest = null;
    (d.c || []).forEach((v, i) => { const p = parse(v); if (p) { pts.push([p.n, fr[i]]); if (p.unsure) est = true; lowest = i; } });
    if (N) (d.anchors || []).forEach(([sc, cnt]) => pts.push([sc, cnt / N]));
    if (pts.length < 2) return null;
    if (lowest === 3) pts.push([0, 1]);
    pts.sort((a, b) => b[0] - a[0]);
    for (let i = 1; i < pts.length; i++) pts[i][1] = Math.max(pts[i][1], pts[i - 1][1]);
    const last = pts[pts.length - 1];
    if (m.n < last[0]) return { below: true, frac: last[1], N, est };
    let frac = 0;
    for (let i = 1; i < pts.length; i++) {
      const [s1, f1] = pts[i - 1], [s2, f2] = pts[i];
      if (m.n <= s1 && m.n >= s2) { frac = s1 === s2 ? f2 : f1 + (s1 - m.n) / (s1 - s2) * (f2 - f1); break; }
    }
    return { frac, N, est, rank: N ? Math.max(1, Math.round(frac * N)) : null };
  }
  // 과목별 정확도 점수(0~100): 얻은 정보로 계산 결과가 얼마나 좁혀졌는지
  //  컷 점수(60%): 4컷 각 25점 — 확정 25, 추정은 25×e^(−90%범위폭/25), 모르면 0 ('88.x'처럼 대략 확정은 폭 1점으로)
  const num = n => String(Math.round(n * 10) / 10);  window.GradeCut = { parse, badNum, scoreIssue, gradeInfo, rankOf, num, CAL };
})();
