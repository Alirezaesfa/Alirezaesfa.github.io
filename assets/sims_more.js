// Project simulations: AI, startup, research and data work (all simulated data)
window.SIMS = window.SIMS || {};
(() => {
const SIMS = window.SIMS;
const K = SIMKIT, C = K.C;
const noCtrl = () => null;

// a generic flow helper: named nodes, tokens that walk routes, pulses on arrival
function flow(canvas, opt, spec) {
  let P = {}, tokens = [], pulses = {}, t = 0, spawnT = 0, n = 0, extra = spec.state ? spec.state() : {};
  const pt = id => P[id];
  const arrive = (tok, id) => { pulses[id] = 1; if (spec.arrive) spec.arrive(tok, id, extra, tokens); };
  function core(dt) {
    t += dt; spawnT += dt;
    if (spawnT >= spec.gap) { spawnT = 0; spec.spawn(n++, tokens, extra); }
    for (const k of tokens) K.move(k, dt, spec.speed || 110, pt, spec.ctrl ? id2 => spec.ctrl(id2, P) : noCtrl, arrive);
    tokens = tokens.filter(k => k.fade > 0);
    for (const id in pulses) pulses[id] = Math.max(0, pulses[id] - dt * 1.8);
  }
  return K.mount(canvas, {
    layout: g => { P = spec.layout(g); },
    warm: () => { for (let s = 0; s < (spec.warm || 6); s += 0.05) core(0.05); },
    step: dt => core(dt),
    draw: g => {
      g.ctx.clearRect(0, 0, g.W, g.H);
      for (const [a, b, o] of spec.edges) K.edge(g, P[a], P[b], (o && o.color) || C.line, Object.assign({}, o, o && o.curve ? { ctrl: o.curve(P) } : {}));
      for (const k of tokens) {
        const p = K.where(k, pt, spec.ctrl ? (a, b) => spec.ctrl(a, b, P) : noCtrl);
        K.dot(g, { x: p.x, y: p.y + (k.off || 0) }, k.color ? k.color(k) : C.accent, { alpha: k.fade, ring: k.ring && k.ring(k) });
      }
      for (const [id, name, sub, o = {}] of spec.nodes) {
        K.node(g, P[id], o.color || C.accent, { pulse: pulses[id] || 0, filled: o.filled, r: o.r });
        K.label(g, name, sub, P[id], o.text || C.ink, { above: o.above, small: o.small });
      }
      if (spec.overlay) spec.overlay(g, P, extra);
    },
  }, opt);
}
const row = (g, n, y, padF = 0.09) => { const pad = Math.max(36, g.W * padF); return [...Array(n)].map((_, i) => ({ x: pad + (i * (g.W - 2 * pad)) / (n - 1), y })); };
const tok = (stops, o) => K.makeToken(stops, Object.assign({ off: (Math.random() - 0.5) * 6 }, o));

// multi-agent workflow on n8n: one transcript in, a charter and one task per action item out
SIMS.agents = (canvas, opt = {}) => flow(canvas, opt, {
  gap: 2.2, speed: 120, warm: 7,
  layout: g => {
    const [a, b, c, d] = row(g, 5, g.H * 0.5, 0.08);
    const x = g.W - Math.max(36, g.W * 0.08);
    return { tr: a, gate: b, llm: c, json: d,
      t1: { x, y: g.H * 0.16 }, t2: { x, y: g.H * 0.4 }, t3: { x, y: g.H * 0.64 }, ch: { x, y: g.H * 0.88 } };
  },
  edges: [["tr", "gate"], ["gate", "llm"], ["llm", "json"], ["json", "t1", { alpha: 0.6 }], ["json", "t2", { alpha: 0.6 }], ["json", "t3", { alpha: 0.6 }], ["json", "ch", { color: C.live, alpha: 0.5 }]],
  nodes: [["tr", "Transcript", "meeting notes", { above: true }], ["gate", "Command", "deterministic", { above: true }], ["llm", "Claude", "structures", { above: true }],
    ["json", "Valid JSON", "checked", { above: true }], ["t1", "Task", null, { small: true, above: true }], ["t2", "Task", null, { small: true, above: true }], ["t3", "Task", null, { small: true, above: true }],
    ["ch", "Charter", "Docs + Slides", { color: C.live, filled: true, text: C.live, above: true }]],
  spawn: (n, tokens) => tokens.push(tok([["tr", 0], ["gate", 0.2], ["llm", 0.5], ["json", 0.25]], { split: true })),
  arrive: (k, id, s, tokens) => {
    if (id === "json" && k.split) {
      for (const tgt of ["t1", "t2", "t3"]) tokens.push(tok([["json", 0], [tgt, 0]], { off: 0 }));
      tokens.push(tok([["json", 0], ["ch", 0]], { off: 0, color: () => C.live }));
    }
  },
});

// backlog triage agent: the model calls tools in a loop, then returns a priority that the evals check
SIMS.triage = (canvas, opt = {}) => flow(canvas, opt, {
  gap: 2.6, speed: 130, warm: 8,
  layout: g => {
    const [a, b, , d, e] = row(g, 5, g.H * 0.62, 0.08);
    return { item: a, agent: b, out: d, eval: e, rag: { x: b.x + (d.x - b.x) * 0.25, y: g.H * 0.2 }, tool: { x: b.x + (d.x - b.x) * 0.75, y: g.H * 0.2 } };
  },
  edges: [["item", "agent"], ["agent", "out"], ["out", "eval"], ["agent", "rag", { color: C.accent, alpha: 0.35, dash: [4, 5] }], ["agent", "tool", { color: C.accent, alpha: 0.35, dash: [4, 5] }]],
  nodes: [["item", "Backlog item", "new", {}], ["agent", "Claude", "agent loop", {}], ["rag", "Similar items", "ChromaDB (RAG)", { above: true, r: 7 }],
    ["tool", "Tool call", "JSON Schema", { above: true, r: 7 }], ["out", "Priority", "with reason", {}], ["eval", "Evals", "expected?", { color: C.live, filled: true, text: C.live }]],
  spawn: (n, tokens) => tokens.push(tok([["item", 0], ["agent", 0.2], ["rag", 0.3], ["agent", 0.15], ["tool", 0.3], ["agent", 0.2], ["out", 0.2], ["eval", 0]], { ring: k => k.i >= 6 })),
});

// CloudMed: imaging centers upload studies to one cloud viewer; doctors report; patients see every report in one place
SIMS.cloudmed = (canvas, opt = {}) => flow(canvas, opt, {
  gap: 0.9, speed: 115, warm: 6,
  layout: g => {
    const pad = Math.max(36, g.W * 0.08), xs = [pad, pad + (g.W - 2 * pad) * 0.3, pad + (g.W - 2 * pad) * 0.62, g.W - pad];
    return { c0: { x: xs[0], y: g.H * 0.18 }, c1: { x: xs[0], y: g.H * 0.5 }, c2: { x: xs[0], y: g.H * 0.82 },
      gw: { x: xs[1], y: g.H * 0.5 }, cloud: { x: xs[2], y: g.H * 0.5 }, dr: { x: xs[3], y: g.H * 0.24 }, pt: { x: xs[3], y: g.H * 0.76 } };
  },
  edges: [["c0", "gw"], ["c1", "gw"], ["c2", "gw"], ["gw", "cloud"], ["cloud", "dr"], ["dr", "pt", { color: C.live, alpha: 0.5, dash: [4, 5] }]],
  nodes: [["c0", "Imaging center", null, { small: true, above: true }], ["c1", "Imaging center", null, { small: true, above: true }], ["c2", "Imaging center", null, { small: true, above: true }],
    ["gw", "Gateway", "uploads studies", { above: true }], ["cloud", "Cloud viewer", "one place", { above: true }], ["dr", "Doctor", "reads, reports", { above: true }],
    ["pt", "Patient", "all reports", { color: C.live, filled: true, text: C.live }]],
  spawn: (n, tokens) => tokens.push(tok([["c" + (n % 3), 0], ["gw", 0.1], ["cloud", 0.3], ["dr", 0.5], ["pt", 0]], { color: k => (k.i >= 3 ? C.live : C.accent) })),
});

// loan decisioning case study: rules and a risk score route each application
SIMS.loan = (canvas, opt = {}) => flow(canvas, opt, {
  gap: 0.7, speed: 120, warm: 6,
  layout: g => {
    const [a, b, c] = row(g, 4, g.H * 0.5, 0.08);
    const x = g.W - Math.max(36, g.W * 0.08);
    return { app: a, chk: b, risk: c, ok: { x, y: g.H * 0.18 }, uw: { x, y: g.H * 0.5 }, no: { x, y: g.H * 0.82 } };
  },
  edges: [["app", "chk"], ["chk", "risk"], ["risk", "ok", { color: C.live, alpha: 0.5 }], ["risk", "uw", { color: C.signal, alpha: 0.5 }], ["risk", "no", { alpha: 0.6 }]],
  nodes: [["app", "Application", "submitted", { above: true }], ["chk", "Data checks", "credit, KYC", { above: true }], ["risk", "Risk score", "business rules", { above: true }],
    ["ok", "Auto-approve", "low risk", { color: C.live, filled: true, text: C.live, above: true }], ["uw", "Underwriter", "medium risk", { color: C.signal, text: C.signal, above: true }],
    ["no", "Decline", "high risk", { color: C.muted, text: C.muted, above: true }]],
  spawn: (n, tokens) => {
    const r = [0, 0, 1, 0, 2, 1, 0, 0, 1, 0][n % 10], end = ["ok", "uw", "no"][r];
    tokens.push(tok([["app", 0], ["chk", 0.15], ["risk", 0.2], [end, 0]], { color: k => (k.i < 2 ? C.accent : r === 0 ? C.live : r === 1 ? C.signal : C.muted) }));
  },
});

// MSc thesis: quotes from interviews and forum threads are coded, then grouped into four kinds of value
SIMS.thesis = (canvas, opt = {}) => flow(canvas, opt, {
  gap: 0.55, speed: 95, warm: 8,
  layout: g => {
    const pad = Math.max(36, g.W * 0.08), xs = [pad, pad + (g.W - 2 * pad) * 0.48, g.W - pad];
    const P = { iv: { x: xs[0], y: g.H * 0.32 }, th: { x: xs[0], y: g.H * 0.72 } };
    for (let i = 0; i < 6; i++) P["c" + i] = { x: xs[1], y: g.H * (0.12 + i * 0.152) };
    for (let i = 0; i < 4; i++) P["v" + i] = { x: xs[2], y: g.H * (0.14 + i * 0.235) };
    return P;
  },
  edges: [],
  nodes: [["iv", "Interviews", "10 players", { above: true }], ["th", "Forum threads", "10 threads", { above: true }],
    ["c0", "", null, { r: 4 }], ["c1", "", null, { r: 4 }], ["c2", "", null, { r: 4 }], ["c3", "", null, { r: 4 }], ["c4", "", null, { r: 4 }], ["c5", "", null, { r: 4 }],
    ["v0", "Competition", null, { color: C.live, text: C.live, filled: true, small: true, above: true }], ["v1", "Fun", null, { color: C.live, text: C.live, filled: true, small: true, above: true }],
    ["v2", "Self-image", null, { color: C.live, text: C.live, filled: true, small: true, above: true }], ["v3", "Social bonding", null, { color: C.live, text: C.live, filled: true, small: true, above: true }]],
  spawn: (n, tokens) => {
    const src = n % 3 === 2 ? "th" : "iv", c = (n * 7) % 6, v = [0, 0, 1, 2, 3, 1][c];
    tokens.push(tok([[src, 0], ["c" + c, 0.35], ["v" + v, 0]], { off: (Math.random() - 0.5) * 10, color: k => (k.i >= 1 ? C.live : C.accent) }));
  },
  overlay: (g, P) => {
    const { ctx } = g;
    ctx.save(); ctx.textAlign = "center"; ctx.font = K.font(10); ctx.fillStyle = C.faint;
    ctx.fillText("first-order codes", P.c0.x, P.c0.y - 14);
    ctx.restore();
  },
});

// fraud detection: a rare fraud class among normal transactions; the model flags most fraud with very few false alarms
SIMS.fraud = (canvas, opt = {}) => flow(canvas, opt, {
  gap: 0.16, speed: 160, warm: 6,
  layout: g => {
    const pad = Math.max(36, g.W * 0.08), x2 = g.W - pad;
    return { in: { x: pad, y: g.H * 0.55 }, model: { x: g.W * 0.48, y: g.H * 0.55 }, flag: { x: x2, y: g.H * 0.2 }, ok: { x: x2, y: g.H * 0.78 } };
  },
  edges: [["in", "model"], ["model", "flag", { color: C.signal, alpha: 0.45 }], ["model", "ok", { alpha: 0.6 }]],
  nodes: [["in", "Transactions", "SMOTE-balanced training", { above: true }], ["model", "Model", "tuned for recall", { above: true }],
    ["flag", "Flagged", "for review", { color: C.signal, text: C.signal, filled: true, above: true }], ["ok", "Cleared", null, { above: true }]],
  spawn: (n, tokens) => {
    const fraud = n % 13 === 5, caught = fraud && (n / 13 | 0) % 4 !== 3;
    tokens.push(tok([["in", 0], ["model", 0.05], [caught ? "flag" : "ok", 0]], { off: (Math.random() - 0.5) * 12, color: () => (fraud ? C.signal : C.accent) }));
  },
  overlay: (g, P) => {
    const { ctx } = g;
    ctx.save(); ctx.font = K.font(11, 500); ctx.fillStyle = C.ink; ctx.textAlign = "left";
    ctx.fillText("precision 0.97 · recall 0.77", Math.max(14, g.W * 0.03), g.H - 12);
    ctx.restore();
  },
});

// charts: axes helper
function axes(g, box, xl, yl) {
  const { ctx } = g;
  ctx.save(); ctx.strokeStyle = C.line; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(box.x, box.y); ctx.lineTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke();
  ctx.globalAlpha = 1; ctx.font = K.font(10); ctx.fillStyle = C.faint;
  ctx.textAlign = "right"; ctx.fillText(xl, box.x + box.w, box.y + box.h + 16);
  ctx.textAlign = "left"; ctx.fillText(yl, box.x + 4, box.y - 8);
  ctx.restore();
}
const plotBox = g => { const l = Math.max(30, g.W * 0.07), t = 30; return { x: l, y: t, w: g.W - l - Math.max(20, g.W * 0.05), h: g.H - t - 34 }; };
function chart(canvas, opt, spec) {
  let t = 0;
  return K.mount(canvas, { layout: () => {}, warm: () => { t = spec.warmT || 0; }, step: dt => { t += dt; }, draw: g => { g.ctx.clearRect(0, 0, g.W, g.H); spec.draw(g, plotBox(g), t); } }, opt);
}
// seeded noise so every load draws the same data
const rand = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// time-series forecasting: the network's forecast follows the actual series past the train/test split
SIMS.timeseries = (canvas, opt = {}) => {
  const r = rand(7), N = 140, A = [];
  let v = 0.5;
  for (let i = 0; i < N; i++) { v += (r() - 0.5) * 0.07 + 0.08 * Math.sin(i / 9) * 0.25; v = Math.min(0.92, Math.max(0.08, v)); A.push(v); }
  const F = A.map((a, i) => (i < 3 ? a : (A[i - 1] * 0.55 + A[i - 2] * 0.3 + A[i - 3] * 0.15) + (r() - 0.5) * 0.03));
  const split = Math.round(N * 0.7);
  return chart(canvas, opt, { warmT: 9.5, draw: (g, b, t) => {
    const { ctx } = g, cyc = 13, k = Math.min(N, Math.floor(((t % cyc) / (cyc - 2.5)) * N));
    axes(g, b, "time", "value");
    const X = i => b.x + (i / (N - 1)) * b.w, Y = y => b.y + (1 - y) * b.h;
    ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = C.signal; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(X(split), b.y); ctx.lineTo(X(split), b.y + b.h); ctx.stroke(); ctx.restore();
    K.text(g, "test set →", { x: X(split) + 30, y: b.y + 12 }, C.signal);
    const line = (arr, from, to, color, w) => { if (to - from < 2) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); for (let i = from; i < to; i++) (i === from ? ctx.moveTo : ctx.lineTo).call(ctx, X(i), Y(arr[i])); ctx.stroke(); ctx.restore(); };
    line(A, 0, k, C.muted, 1.4);
    line(F, split, Math.max(split, k), C.accent, 2);
    if (k > split) K.dot(g, { x: X(k - 1), y: Y(F[k - 1]) }, C.accent, { r: 3 });
    ctx.save(); ctx.font = K.font(10); ctx.textAlign = "left";
    ctx.fillStyle = C.muted; ctx.fillText("— actual", b.x + 8, b.y + b.h - 22);
    ctx.fillStyle = C.accent; ctx.fillText("— LSTM forecast", b.x + 8, b.y + b.h - 8); ctx.restore();
  } });
};

// income prediction: a decision tree splits the census data into regions, one split at a time
SIMS.income = (canvas, opt = {}) => {
  const r = rand(11), pts = [];
  for (let i = 0; i < 150; i++) {
    const x = r(), y = r();
    const p = (x > 0.45 ? 0.55 : 0.12) + (y > 0.55 ? 0.3 : 0) - (x > 0.8 ? 0.15 : 0);
    pts.push({ x, y, hi: r() < p });
  }
  const splits = [{ v: 0.45, dir: "x" }, { v: 0.55, dir: "y", from: 0.45 }, { v: 0.8, dir: "x", lo: 0.55 }];
  return chart(canvas, opt, { warmT: 9, draw: (g, b, t) => {
    const { ctx } = g, cyc = 12, s = Math.min(3, Math.floor((t % cyc) / 2.4));
    axes(g, b, "years of education", "hours per week");
    const X = v => b.x + v * b.w, Y = v => b.y + (1 - v) * b.h;
    for (const p of pts) K.dot(g, { x: X(p.x), y: Y(p.y) }, p.hi ? C.signal : C.accent, { r: 2.4, glow: 0, alpha: 0.85 });
    ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
    splits.slice(0, s).forEach(sp => {
      ctx.beginPath();
      if (sp.dir === "y") { ctx.moveTo(X(sp.from), Y(sp.v)); ctx.lineTo(b.x + b.w, Y(sp.v)); }
      else if (sp.lo != null) { ctx.moveTo(X(sp.v), b.y + b.h); ctx.lineTo(X(sp.v), Y(sp.lo)); }
      else { ctx.moveTo(X(sp.v), b.y); ctx.lineTo(X(sp.v), b.y + b.h); }
      ctx.stroke();
    });
    ctx.restore();
    ctx.save(); ctx.font = K.font(10); ctx.textAlign = "left";
    ctx.fillStyle = C.signal; ctx.fillText("● over $50K", b.x + 8, b.y + 4);
    ctx.fillStyle = C.accent; ctx.fillText("● $50K or less", b.x + 98, b.y + 4); ctx.restore();
  } });
};

// insurance premiums: the regression line settles onto the data; smokers sit on a higher band
SIMS.insurance = (canvas, opt = {}) => {
  const r = rand(5), pts = [];
  for (let i = 0; i < 110; i++) { const x = r(), sm = r() < 0.22; pts.push({ x, sm, y: Math.min(0.97, 0.12 + 0.45 * x + (sm ? 0.32 : 0) + (r() - 0.5) * 0.12) }); }
  return chart(canvas, opt, { warmT: 6, draw: (g, b, t) => {
    const { ctx } = g, cyc = 10, f = Math.min(1, (t % cyc) / 4), e = 1 - Math.pow(1 - f, 3);
    axes(g, b, "body mass index", "yearly premium");
    const X = v => b.x + v * b.w, Y = v => b.y + (1 - v) * b.h;
    for (const p of pts) K.dot(g, { x: X(p.x), y: Y(p.y) }, p.sm ? C.signal : C.accent, { r: 2.4, glow: 0, alpha: 0.85 });
    const fit = (x, sm) => 0.12 + 0.45 * x + (sm ? 0.32 : 0);
    ctx.save(); ctx.lineWidth = 2;
    for (const sm of [false, true]) {
      const y0 = 0.5 + (fit(0, sm) - 0.5) * e, y1 = 0.5 + (fit(1, sm) - 0.5) * e;
      ctx.strokeStyle = sm ? C.signal : C.accent; ctx.beginPath(); ctx.moveTo(X(0), Y(y0)); ctx.lineTo(X(1), Y(y1)); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.font = K.font(10); ctx.textAlign = "left";
    ctx.fillStyle = C.signal; ctx.fillText("● smokers", b.x + 8, b.y + 4);
    ctx.fillStyle = C.accent; ctx.fillText("● non-smokers", b.x + 84, b.y + 4); ctx.restore();
  } });
};

// dashboards: monthly bars grow in and a KPI line draws over them
SIMS.dashboards = (canvas, opt = {}) => {
  const r = rand(3), M = 12, B = [...Array(M)].map((_, i) => 0.35 + 0.35 * Math.sin(i / 2.2) * 0.5 + r() * 0.3), L = B.map((v, i) => 0.25 + i * 0.045 + (r() - 0.5) * 0.05);
  return chart(canvas, opt, { warmT: 5, draw: (g, b, t) => {
    const { ctx } = g, cyc = 9, f = Math.min(1, (t % cyc) / 3.5);
    axes(g, b, "month", "sales and margin");
    const w = b.w / M;
    ctx.save();
    for (let i = 0; i < M; i++) {
      const h = B[i] * b.h * Math.min(1, Math.max(0, f * M - i * 0.6));
      ctx.fillStyle = C.accent; ctx.globalAlpha = 0.28; ctx.fillRect(b.x + i * w + w * 0.2, b.y + b.h - h, w * 0.6, h);
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = C.signal; ctx.lineWidth = 2; ctx.beginPath();
    const k = Math.max(1, Math.floor(f * M));
    for (let i = 0; i < k; i++) { const x = b.x + i * w + w / 2, y = b.y + (1 - L[i]) * b.h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  } });
};
})();

// mount every simulation on the page; cards get the scaled-down thumbnail stage
document.querySelectorAll("canvas[data-sim]").forEach(c => {
  const make = window.SIMS[c.dataset.sim];
  if (!make) return;
  const thumb = c.hasAttribute("data-thumb");
  make(c, thumb ? { thumb: true, logical: 620 } : {});
});
