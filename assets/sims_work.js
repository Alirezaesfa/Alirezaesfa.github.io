// TELUS work simulations (simulated data)
window.SIMS = window.SIMS || {};
(() => {
const SIMS = window.SIMS;
// order to billing: simulated orders flow toward billing; one in five drops out at one of the three hand-offs with no billing record
SIMS.orders = (canvas, opt = {}) => {
  const $ = id => (opt.thumb ? null : document.getElementById(id));
  const K = SIMKIT, C = K.C, SPEED = 74, GAP = 0.34;
  const NAMES = [["Order entry", "closed-won"], ["Fulfillment", "work orders"], ["Activation", "service on"], ["Billing", "invoiced"]];
  const SHORT = ["Order", "Fulfill", "Activate", "Billing"];
  const LEAKS = [
    [["n0", 0], ["j0", 0], ["l0", 0], ["l1", 0], ["s", 0]],
    [["n0", 0], ["n1", 0], ["j1", 0], ["l1", 0], ["s", 0]],
    [["n0", 0], ["n1", 0], ["n2", 0], ["j2", 0], ["s", 0]],
  ];
  const el = { b: $("st-billed"), s: $("st-stuck"), p: $("st-share") };
  let P = {}, tier = "wide", tokens = [], spawnT = 0, n = 0, billed = 400, stuck = 100, pulses = {}, statT = 0;
  const pt = id => P[id], noCtrl = () => null;

  function layout(g) {
    tier = g.W >= 400 ? "wide" : g.W >= 300 ? "narrow" : "min";
    const pad = Math.max(40, g.W * 0.09), y = g.H * 0.34, lane = g.H * 0.78;
    for (let i = 0; i < 4; i++) P["n" + i] = { x: pad + (i * (g.W - 2 * pad)) / 3, y };
    for (let k = 0; k < 3; k++) {
      const x = (P["n" + k].x + P["n" + (k + 1)].x) / 2;
      P["j" + k] = { x, y };
      P["l" + k] = { x, y: lane };
    }
    P.s = P.l2;
  }
  function spawn() {
    const leak = n % 5 === 2, k = Math.floor(n / 5) % 3;
    n++;
    if (leak) tokens.push(K.makeToken(LEAKS[k], { leak, jIdx: k + 1, off: (Math.random() - 0.5) * 7 }));
    else tokens.push(K.makeToken([["n0", 0], ["n1", 0], ["n2", 0], ["n3", 0]], { leak, off: (Math.random() - 0.5) * 7 }));
  }
  function arrive(tok, id) {
    pulses[id] = 1;
    if (id === "n3") billed++;
    if (id === "s") stuck++;
  }
  function core(dt) {
    spawnT += dt;
    while (spawnT > GAP) { spawnT -= GAP; spawn(); }
    for (const k of tokens) K.move(k, dt, SPEED, pt, noCtrl, arrive);
    tokens = tokens.filter(k => k.fade > 0);
    for (const id in pulses) pulses[id] = Math.max(0, pulses[id] - dt * 1.8);
  }
  function stats() {
    K.set(el.b, billed.toLocaleString());
    K.set(el.s, stuck.toLocaleString());
    K.set(el.p, Math.round((stuck / (billed + stuck)) * 100) + "%");
  }
  function draw(g) {
    const { ctx, W, H } = g;
    ctx.clearRect(0, 0, W, H);
    K.edge(g, P.n0, P.n3, C.line);
    for (let k = 0; k < 3; k++) K.edge(g, P["j" + k], P["l" + k], C.signal, { dash: [4, 5], alpha: 0.45 });
    K.edge(g, P.l0, P.s, C.signal, { dash: [4, 5], alpha: 0.3 });
    for (let k = 0; k < 3; k++) K.dot(g, P["j" + k], C.signal, { r: 2.3, glow: 0, alpha: 0.9 });
    for (const k of tokens) {
      const p = K.where(k, pt, noCtrl);
      const amber = k.leak && k.i >= k.jIdx;
      K.dot(g, { x: p.x, y: p.y + (amber ? 0 : k.off) }, amber ? C.signal : C.accent, { alpha: k.fade });
    }
    for (let i = 0; i < 4; i++) {
      const id = "n" + i;
      K.node(g, P[id], C.accent, { pulse: pulses[id] || 0, filled: i === 3 });
      if (tier === "wide") K.label(g, NAMES[i][0], NAMES[i][1], P[id], C.ink);
      else K.label(g, tier === "min" ? SHORT[i] : NAMES[i][0], null, P[id], C.ink, { small: true });
    }
    K.node(g, P.s, C.signal, { pulse: pulses.s || 0, filled: true });
    K.label(g, "No billing record", tier === "wide" ? "unbilled orders" : null, P.s, C.signal, { small: tier !== "wide" });
  }
  K.mount(canvas, {
    layout,
    warm: () => { for (let t = 0; t < 8; t += 0.05) core(0.05); billed = 400; stuck = 100; stats(); },
    step: dt => { core(dt); statT += dt; if (statT > 0.3) { statT = 0; stats(); } },
    draw,
  }, opt);
};

// contract migration: each language batch runs through AI review and UAT; failures loop back for a fix and retest
SIMS.contracts = (canvas, opt = {}) => {
  const $ = id => (opt.thumb ? null : document.getElementById(id));
  const K = SIMKIT, C = K.C;
  const LANGS = 6, BATCH = 6, GAP = 0.34, SPEED = 125;
  const NAMES = {
    wide: [["Salesforce", "60K accounts"], ["Contract pull", "Python scripts"], ["AI risk review", "privacy check"], ["UAT", "business + legal"], ["Live", "per language"]],
    narrow: [["Salesforce", "accounts"], ["Pull", "scripts"], ["AI review", "risk summary"], ["UAT", "biz+legal"], ["Live", "released"]],
    min: [["Accounts"], ["Pull"], ["AI"], ["UAT"], ["Live"]],
  };
  const el = { cur: $("wpo-cur"), back: $("wpo-back"), live: $("wpo-live"), pills: (opt.thumb ? [] : [...document.querySelectorAll("#wpo-langs .lang")]) };
  let tier = "wide", P = [], arc = null, apex = null, tokens = [], pulses = [0, 0, 0, 0, 0];
  let cur = 0, spawned = 0, finished = 0, spawnT = 0, between = 0, hold = 0, sentBack = 0, state = [], lastStat = "";
  const pt = id => P[id];
  const ctrl = (a, b) => (a === 3 && b === 2 ? arc : null);

  function startLang() { state[cur] = 1; spawned = 0; finished = 0; spawnT = GAP; between = 0; }
  function reset() { tokens = []; state = Array(LANGS).fill(0); cur = 0; sentBack = 0; hold = 0; startLang(); }
  function spawn() {
    const fail = spawned % 3 === 1;   // illustrative: about a third fail their first review
    const stops = fail
      ? [[0, 0], [1, 0], [2, 0.15], [3, 0.3], [2, 0.25], [3, 0.3], [4, 0]]
      : [[0, 0], [1, 0], [2, 0.15], [3, 0.3], [4, 0]];
    tokens.push(K.makeToken(stops, { fail, off: (Math.random() - 0.5) * 6 }));
    spawned++;
  }
  function arrive(tok, id) {
    pulses[id] = 1;
    if (tok.fail && tok.i === 4) sentBack++;
    if (id === 4 && ++finished === BATCH) { state[cur] = 2; between = 0.9; }
  }
  function core(dt) {
    if (hold > 0) { hold -= dt; if (hold <= 0) reset(); }
    else if (between > 0) {
      between -= dt;
      if (between <= 0) { if (cur + 1 >= LANGS) hold = 3.2; else { cur++; startLang(); } }
    } else if (state[cur] === 1 && spawned < BATCH) {
      spawnT += dt;
      if (spawnT >= GAP) { spawnT = 0; spawn(); }
    }
    for (const k of tokens) K.move(k, dt, SPEED, pt, ctrl, arrive);
    tokens = tokens.filter(k => k.fade > 0);
    for (let i = 0; i < pulses.length; i++) pulses[i] = Math.max(0, pulses[i] - dt * 1.8);
  }
  function stats() {
    const live = state.filter(s => s === 2).length;
    const curTxt = hold > 0 ? "All done" : cur + 1 + " of " + LANGS;
    const key = curTxt + sentBack + live + state.join("");
    if (key === lastStat) return;
    lastStat = key;
    K.set(el.cur, curTxt);
    K.set(el.back, sentBack);
    K.set(el.live, live + " of " + LANGS);
    el.pills.forEach((p, i) => { p.className = "lang" + (state[i] === 2 ? " l" : state[i] === 1 ? " t" : ""); });
  }
  function layout(g) {
    tier = g.W >= 470 ? "wide" : g.W >= 400 ? "narrow" : g.W >= 300 ? "small" : "min";
    const pad = Math.max(38, g.W * 0.09), y = g.H * 0.66;
    P = [0, 1, 2, 3, 4].map(i => ({ x: pad + (i * (g.W - 2 * pad)) / 4, y }));
    arc = { x: (P[2].x + P[3].x) / 2, y: g.H * 0.1 };
    apex = K.quad(P[3], P[2], arc, 0.5);
  }
  function draw(g) {
    const { ctx, W, H } = g;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) K.edge(g, P[i], P[i + 1], C.line);
    K.edge(g, P[3], P[2], C.signal, { ctrl: arc, dash: [4, 5], alpha: 0.5 });
    K.text(g, "fix & retest", { x: apex.x, y: apex.y - 9 }, C.signal);
    for (const k of tokens) {
      const p = K.where(k, pt, ctrl);
      const amber = k.fail && ((k.i === 3 && k.wait <= 0) || k.i === 4);
      K.dot(g, { x: p.x, y: p.y + k.off }, amber ? C.signal : C.accent, { alpha: k.fade });
    }
    const names = NAMES[tier === "small" ? "narrow" : tier];
    const subs = tier === "wide" || tier === "narrow";
    for (let i = 0; i < 5; i++) {
      const c = i === 4 ? C.live : C.accent;
      K.node(g, P[i], c, { pulse: pulses[i], filled: i === 4 });
      K.label(g, names[i][0], subs ? names[i][1] : null, P[i], i === 4 ? C.live : C.ink, { small: !subs });
    }
  }
  reset();
  K.mount(canvas, {
    layout,
    warm: () => { for (let t = 0; t < 17; t += 0.05) core(0.05); stats(); },
    step: dt => { core(dt); stats(); },
    draw,
  }, opt);
};

// billing adjustments: current state (manual lookups) vs future state (automatic data pull and an AI recommendation)
SIMS.billing = (canvas, opt = {}) => {
  const $ = id => (opt.thumb ? null : document.getElementById(id));
  const K = SIMKIT, C = K.C, SPEED = 120;
  const MAIN = {
    wide: [["Request", "new request"], ["Data pull", "automatic"], ["AI recommendation", "with reasons"], ["Validator", "human decides"], ["Decision", "closed"]],
    narrow: [["Request", "new"], ["Data", "auto pull"], ["AI", "recommends"], ["Validator", "decides"], ["Done", "closed"]],
    min: [["Request"], ["Data"], ["AI"], ["Review"], ["Done"]],
  };
  const SRC = { wide: ["billing", "contracts", "privacy docs"], narrow: ["billing", "contracts", "privacy"] };
  const GAP = { future: 1.6, current: 1.6 };   // same arrival rate in both states
  const STOPS = {
    future: [["c0", 0], ["c1", 0.55], ["c2", 0.45], ["c3", 0.7], ["c4", 0]],
    current: [["c0", 0], ["c3", 0.25], ["s0", 0.35], ["c3", 0.1], ["s1", 0.35], ["c3", 0.1], ["s2", 0.35], ["c3", 0.7], ["c4", 0]],
  };
  const ui = { cur: $("bar-cur"), fut: $("bar-fut"), look: $("bar-look"), rec: $("bar-rec"), capF: $("bar-cap-fut"), capC: $("bar-cap-cur") };
  let tier = "wide", P = {}, tokens = [], parts = [], pulses = {}, spawnT = 0, mode = "future", picked = false, autoT = 0, g = null;
  const pt = id => P[id];
  const noCtrl = () => null;

  function spawn() { tokens.push(K.makeToken(STOPS[mode], { off: (Math.random() - 0.5) * 5 })); }
  function arrive(tok, id) {
    pulses[id] = 1;
    if (mode === "future" && id === "c1") for (let j = 0; j < 3; j++) parts.push({ from: "s" + j, t: 0 });
    if (mode === "future" && id === "c2") tok.rec = true;
  }
  function core(dt) {
    spawnT += dt;
    if (spawnT >= GAP[mode]) { spawnT = 0; spawn(); }
    for (const k of tokens) K.move(k, dt, SPEED, pt, noCtrl, arrive);
    tokens = tokens.filter(k => k.fade > 0);
    for (const q of parts) { const a = P[q.from], b = P.c1; q.t += (260 * dt) / (Math.hypot(b.x - a.x, b.y - a.y) || 1); }
    parts = parts.filter(q => q.t < 1);
    for (const id in pulses) pulses[id] = Math.max(0, pulses[id] - dt * 1.8);
  }
  function warm(sec) { for (let t = 0; t < sec; t += 0.05) core(0.05); }
  function render() {
    if (!ui.cur) return;
    const fut = mode === "future";
    ui.cur.setAttribute("aria-pressed", String(!fut));
    ui.fut.setAttribute("aria-pressed", String(fut));
    K.set(ui.look, fut ? "Automatic" : "3 by hand");
    ui.look.className = "v txt" + (fut ? " billed" : " stuck");
    K.set(ui.rec, fut ? "AI" : "No one");
    ui.rec.className = "v txt" + (fut ? " billed" : "");
    ui.capF.classList.toggle("off", !fut);
    ui.capC.classList.toggle("off", fut);
  }
  function setMode(m, byUser) {
    mode = m; autoT = 0;
    if (byUser) picked = true;
    tokens = []; parts = []; pulses = {}; spawnT = GAP[m];
    warm(m === "future" ? 4.5 : 6);
    render();
    if (g) g.redraw();
  }
  function layout(gg) {
    tier = gg.W >= 470 ? "wide" : gg.W >= 400 ? "narrow" : gg.W >= 300 ? "small" : "min";
    const pad = Math.max(38, gg.W * 0.09), yM = gg.H * 0.64, yS = gg.H * 0.22;
    P = {};
    for (let i = 0; i < 5; i++) P["c" + i] = { x: pad + (i * (gg.W - 2 * pad)) / 4, y: yM };
    for (let j = 0; j < 3; j++) P["s" + j] = { x: P["c" + (j + 1)].x, y: yS };
  }
  function draw(gg) {
    const { ctx, W, H } = gg;
    ctx.clearRect(0, 0, W, H);
    const fut = mode === "future";
    K.edge(gg, P.c0, P.c4, C.line);
    for (let j = 0; j < 3; j++) {
      if (fut) K.edge(gg, P["s" + j], P.c1, C.accent, { alpha: 0.3 });
      else K.edge(gg, P.c3, P["s" + j], C.signal, { alpha: 0.45, dash: [4, 5] });
    }
    for (const q of parts) {
      const a = P[q.from], b = P.c1;
      K.dot(gg, { x: a.x + (b.x - a.x) * q.t, y: a.y + (b.y - a.y) * q.t }, C.accent, { r: 2.2, glow: 8 });
    }
    for (const k of tokens) {
      const p = K.where(k, pt, noCtrl);
      const amber = !fut && k.i >= 1 && k.i <= 6;
      K.dot(gg, { x: p.x, y: p.y + k.off }, amber ? C.signal : C.accent, { alpha: k.fade, ring: fut && k.rec });
    }
    const src = SRC[tier === "wide" ? "wide" : "narrow"];
    for (let j = 0; j < 3; j++) {
      const s = P["s" + j];
      K.node(gg, s, fut ? C.accent : C.signal, { r: 6, pulse: pulses["s" + j] || 0 });
      const lift = tier === "min" && j === 1 ? { x: s.x, y: s.y - 11 } : s;   // stagger the middle label on very narrow screens
      K.label(gg, src[j], null, lift, C.muted, { above: true, small: true });
    }
    const names = MAIN[tier === "small" ? "narrow" : tier];
    const subs = tier === "wide" || tier === "narrow";
    for (let i = 0; i < 5; i++) {
      const id = "c" + i, ghost = !fut && (i === 1 || i === 2);
      K.node(gg, P[id], i === 4 ? C.live : C.accent, { pulse: pulses[id] || 0, filled: i === 4, ghost });
      K.label(gg, names[i][0], subs ? names[i][1] : null, P[id], i === 4 ? C.live : C.ink, { ghost, small: !subs });
    }
  }
  if (ui.cur) {
    ui.cur.addEventListener("click", () => setMode("current", true));
    ui.fut.addEventListener("click", () => setMode("future", true));
  }
  render();
  g = K.mount(canvas, {
    layout,
    warm: () => warm(4.5),
    step: dt => {
      if (!picked) { autoT += dt; if (autoT > 11) setMode(mode === "future" ? "current" : "future", false); }
      core(dt);
    },
    draw,
  }, opt);
};


})();
