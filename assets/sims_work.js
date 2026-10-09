// TELUS work simulations (simulated data)
window.SIMS = window.SIMS || {};
(() => {
const SIMS = window.SIMS, K = SIMKIT;

// order to billing: simulated orders flow toward billing; one in five drops out at one of the
// three hand-offs and never gets a billing record
SIMS.orders = (canvas, opt = {}) => {
  const $ = id => (opt.thumb ? null : document.getElementById(id));
  const el = { b: $("ob-billed"), s: $("ob-stuck"), p: $("ob-share") };
  const LEAKS = [
    [["n0", 0], ["j0", 0], ["l0", 0], ["l1", 0], ["s", 0]],
    [["n0", 0], ["n1", 0], ["j1", 0], ["l1", 0], ["s", 0]],
    [["n0", 0], ["n1", 0], ["n2", 0], ["j2", 0], ["s", 0]],
  ];
  const share = st => Math.round((st.stuck / (st.billed + st.stuck)) * 100) + "%";
  return K.flow(canvas, opt, {
    gap: 0.34, speed: 92, warm: 9, jitter: 7,
    state: () => ({ billed: 0, stuck: 0 }),
    nodes: {
      n0: { at: [0, 0.3], name: "Order entry", short: ["Order"], sub: "closed-won" },
      n1: { at: [1 / 3, 0.3], name: "Fulfillment", short: ["Fulfill"], sub: "work orders" },
      n2: { at: [2 / 3, 0.3], name: "Activation", short: ["Activate"], sub: "service on" },
      n3: { at: [1, 0.3], name: "Billing", sub: "invoiced", kind: "done" },
      j0: { at: [1 / 6, 0.3], kind: "point" }, j1: { at: [0.5, 0.3], kind: "point" }, j2: { at: [5 / 6, 0.3], kind: "point" },
      l0: { at: [1 / 6, 0.86], kind: "point" }, l1: { at: [0.5, 0.86], kind: "point" },
      s: { at: [5 / 6, 0.86], name: "No billing record", short: ["Unbilled"], sub: "stuck orders", kind: "warn" },
    },
    edges: [
      ["n0", "n1"], ["n1", "n2"], ["n2", "n3"],
      ["j0", "l0", { color: "signal", dash: [4, 5], alpha: 0.75 }], ["j1", "l1", { color: "signal", dash: [4, 5], alpha: 0.75 }],
      ["l0", "l1", { color: "signal", dash: [4, 5], alpha: 0.75 }], ["l1", "s", { color: "signal", dash: [4, 5], alpha: 0.75 }],
      ["j2", "s", { color: "signal", dash: [4, 5], alpha: 0.75 }],
    ],
    spawn: (n, api) => {
      const leak = n % 5 === 2, k = Math.floor(n / 5) % 3;
      if (leak) api.push(api.token(LEAKS[k], { leak, jIdx: k + 1, color: t => (t.i >= t.jIdx ? "signal" : "accent") }));
      else api.push(api.token([["n0", 0], ["n1", 0], ["n2", 0], ["n3", 0]]));
    },
    arrive: (tok, id, api) => { if (id === "n3") api.st.billed++; if (id === "s") api.st.stuck++; },
    warmed: api => { api.st.billed = 400; api.st.stuck = 100; },
    under: (g, P) => { for (const j of ["j0", "j1", "j2"]) K.dot(g, P[j], "signal", { r: g.thumb ? 2.2 : 2.6, glow: 0 }); },
    look: (n, st) => (n.id === "s" ? { badge: share(st) } : {}),
    stats: st => { K.set(el.b, st.billed.toLocaleString()); K.set(el.s, st.stuck.toLocaleString()); K.set(el.p, share(st)); },
  });
};

// contract migration: each contract language goes through AI review and acceptance testing;
// failures loop back to the AI team for a fix and a retest
SIMS.contracts = (canvas, opt = {}) => {
  const $ = id => (opt.thumb ? null : document.getElementById(id));
  const LANGS = 6, BATCH = 6, GAP = 0.36;
  const el = { cur: $("cr-cur"), back: $("cr-back"), live: $("cr-live"), pills: opt.thumb ? [] : [...document.querySelectorAll("#cr-langs .lang")] };
  const live = st => st.state.filter(s => s === 2).length;
  const startLang = st => { st.state[st.cur] = 1; st.spawned = 0; st.finished = 0; st.spawnT = GAP; st.between = 0; };
  const reset = api => { const st = api.st; api.clear(); st.state = Array(LANGS).fill(0); st.cur = 0; st.sentBack = 0; st.hold = 0; startLang(st); };
  return K.flow(canvas, opt, {
    speed: 135, warm: 17, jitter: 6,
    state: () => { const st = { state: Array(LANGS).fill(0), cur: 0, spawned: 0, finished: 0, spawnT: GAP, between: 0, hold: 0, sentBack: 0, last: "" }; startLang(st); return st; },
    nodes: {
      c0: { at: [0, 0.64], name: "Salesforce", short: ["CRM"], sub: "60K accounts" },
      c1: { at: [0.25, 0.64], name: "Contract pull", short: ["Pull"], sub: "Python scripts" },
      c2: { at: [0.5, 0.64], name: "AI risk review", short: ["AI review", "AI"], sub: "privacy check", kind: "ai" },
      c3: { at: [0.75, 0.64], name: "UAT", sub: "business + legal" },
      c4: { at: [1, 0.64], name: "Live", sub: "per language", kind: "done" },
      arc: { at: [0.625, 0.0], atV: [0.625, 0.04], kind: "point" },
    },
    edges: [["c0", "c1"], ["c1", "c2"], ["c2", "c3"], ["c3", "c4"], ["c3", "c2", { curve: "arc", color: "signal", dash: [4, 5], alpha: 0.8 }]],
    tick: (dt, api) => {
      const st = api.st;
      if (st.hold > 0) { st.hold -= dt; if (st.hold <= 0) reset(api); return; }
      if (st.between > 0) {
        st.between -= dt;
        if (st.between <= 0) { if (st.cur + 1 >= LANGS) st.hold = 3.2; else { st.cur++; startLang(st); } }
        return;
      }
      if (st.state[st.cur] === 1 && st.spawned < BATCH) {
        st.spawnT += dt;
        if (st.spawnT >= GAP) {
          st.spawnT = 0;
          const fail = st.spawned % 3 === 1;   // illustrative: about a third fail their first review
          const stops = fail
            ? [["c0", 0], ["c1", 0], ["c2", 0.15], ["c3", 0.3], ["c2", 0.25], ["c3", 0.3], ["c4", 0]]
            : [["c0", 0], ["c1", 0], ["c2", 0.15], ["c3", 0.3], ["c4", 0]];
          api.push(api.token(stops, { fail, color: k => (k.fail && ((k.i === 3 && k.wait <= 0) || k.i === 4) ? "signal" : "accent") }));
          st.spawned++;
        }
      }
    },
    arrive: (tok, id, api) => {
      const st = api.st;
      if (tok.fail && tok.i === 4) st.sentBack++;
      if (id === "c4" && ++st.finished === BATCH) { st.state[st.cur] = 2; st.between = 0.9; }
    },
    look: (n, st) => (n.id === "c4" ? { badge: live(st) + "/" + LANGS } : {}),
    over: (g, P) => {
      const a = K.quad(P.c3, P.c2, P.arc, 0.5);   // the outermost point of the drawn loop
      if (g.vertical) K.note(g, "fix & retest", { x: a.x - 10, y: a.y + 4 }, "signal", { align: "right", halo: true });
      else K.note(g, "fix & retest", { x: a.x, y: a.y - (g.thumb ? 8 : 11) }, "signal", { halo: true });
    },
    stats: st => {
      const lv = live(st), curTxt = st.hold > 0 ? "All done" : st.cur + 1 + " of " + LANGS;
      const key = curTxt + st.sentBack + lv + st.state.join("");
      if (key === st.last) return;
      st.last = key;
      K.set(el.cur, curTxt); K.set(el.back, st.sentBack); K.set(el.live, lv + " of " + LANGS);
      el.pills.forEach((p, i) => { p.className = "lang" + (st.state[i] === 2 ? " l" : st.state[i] === 1 ? " t" : ""); });
    },
  });
};

// billing adjustments: current state (manual lookups) vs future state (automatic data pull and an AI recommendation)
SIMS.billing = (canvas, opt = {}) => {
  const $ = id => (opt.thumb ? null : document.getElementById(id));
  const ui = { cur: $("ba-cur"), fut: $("ba-fut"), look: $("ba-look"), rec: $("ba-rec"), capF: $("ba-cap-fut"), capC: $("ba-cap-cur") };
  const STOPS = {
    future: [["c0", 0], ["c1", 0.55], ["c2", 0.45], ["c3", 0.7], ["c4", 0]],
    current: [["c0", 0], ["c3", 0.25], ["s0", 0.35], ["c3", 0.1], ["s1", 0.35], ["c3", 0.1], ["s2", 0.35], ["c3", 0.7], ["c4", 0]],
  };
  let API = null;
  const fut = st => st.mode === "future";
  function render(st) {
    if (!ui.cur) return;
    const f = fut(st);
    ui.cur.setAttribute("aria-pressed", String(!f));
    ui.fut.setAttribute("aria-pressed", String(f));
    K.set(ui.look, f ? "Automatic" : "3 by hand");
    ui.look.className = f ? "green" : "amber";
    K.set(ui.rec, f ? "AI" : "No one");
    ui.rec.className = f ? "green" : "";
    ui.capF.classList.toggle("off", !f);
    ui.capC.classList.toggle("off", f);
  }
  function setMode(m, byUser) {
    const st = API.st;
    st.mode = m; st.autoT = 0; st.spawnT = 1.25;
    if (byUser) st.picked = true;
    API.clear();
    API.warm(m === "future" ? 4.5 : 6);
    st.autoT = 0;   // the warm-up ticks count toward the timer, so restart it: each state then shows for the full 11 seconds
    render(st);
    API.redraw();
  }
  const spawn = api => {
    const st = api.st;
    api.push(api.token(STOPS[st.mode], { color: k => (!fut(st) && k.i >= 1 && k.i <= 6 ? "signal" : "accent"), ring: k => fut(st) && k.rec }));
  };
  const g = K.flow(canvas, opt, {
    speed: 125, warm: 4.5, jitter: 5,
    state: () => ({ mode: "future", picked: false, autoT: 0, spawnT: 1.25 }),
    nodes: {
      c0: { at: [0, 0.72], name: "Request", sub: "new request" },
      c1: { at: [0.25, 0.72], name: "Data pull", short: ["Data"], sub: "automatic" },
      c2: { at: [0.5, 0.72], name: "AI recommendation", short: ["AI advice", "AI"], sub: "with reasons", kind: "ai" },
      c3: { at: [0.75, 0.72], name: "Validator", short: ["Review"], sub: "human decides" },
      c4: { at: [1, 0.72], name: "Decision", short: ["Done"], sub: "closed", kind: "done" },
      s0: { at: [0.2, 0.1], atV: [0.25, 0.14], name: "Billing data", short: ["Billing"], kind: "src" },
      s1: { at: [0.5, 0.1], atV: [0.5, 0.14], name: "Contracts", kind: "src" },
      s2: { at: [0.8, 0.1], atV: [0.75, 0.14], name: "Privacy docs", short: ["Privacy"], kind: "src" },
    },
    edges: [
      ["c0", "c1"], ["c1", "c2"], ["c2", "c3"], ["c3", "c4"],
      ["s0", "c1", { color: "accent", alpha: 0.45, when: fut }], ["s1", "c1", { color: "accent", alpha: 0.45, when: fut }], ["s2", "c1", { color: "accent", alpha: 0.45, when: fut }],
      ["c3", "s0", { color: "signal", dash: [4, 5], alpha: 0.75, arrow: false, when: st => !fut(st) }],
      ["c3", "s1", { color: "signal", dash: [4, 5], alpha: 0.75, arrow: false, when: st => !fut(st) }],
      ["c3", "s2", { color: "signal", dash: [4, 5], alpha: 0.75, arrow: false, when: st => !fut(st) }],
    ],
    arrive: (tok, id, api) => {
      if (!fut(api.st)) return;
      if (id === "c1" && !tok.part) for (let j = 0; j < 3; j++) api.push(api.token([["s" + j, 0], ["c1", 0]], { part: true, off: 0, r: 2.3, speed: 2.1 }));
      if (id === "c2") tok.rec = true;
    },
    tick: (dt, api) => {
      API = api;
      const st = api.st;
      if (!st.picked) { st.autoT += dt; if (st.autoT > 11) { setMode(fut(st) ? "current" : "future", false); return; } }
      st.spawnT += dt;
      if (st.spawnT >= 1.25) { st.spawnT = 0; spawn(api); }
    },
    warmed: api => { API = api; render(api.st); },
    look: (n, st) => (!fut(st) && (n.id === "c1" || n.id === "c2") ? { ghost: true } : {}),
    over: (g, P, st) => {
      if (!g.thumb) return;
      K.note(g, fut(st) ? "FUTURE STATE" : "CURRENT STATE", { x: 10, y: 15 }, fut(st) ? "accent" : "signal", { align: "left", size: 9.5 });
    },
  });
  // the flow engine only hands out its api inside callbacks; grab it from the first tick
  if (ui.cur) {
    ui.cur.addEventListener("click", () => { if (API) setMode("current", true); });
    ui.fut.addEventListener("click", () => { if (API) setMode("future", true); });
  }
  return g;
};
})();
