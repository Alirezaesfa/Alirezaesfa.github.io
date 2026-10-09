// Project simulations: AI, startup, research and data work (all simulated data)
window.SIMS = window.SIMS || {};
(() => {
const SIMS = window.SIMS, K = SIMKIT, C = K.C;

// multi-agent workflow on n8n: one transcript in, a charter and one task per action item out
SIMS.agents = (canvas, opt = {}) => K.flow(canvas, opt, {
  gap: 2.2, speed: 125, warm: 7,
  nodes: {
    tr: { at: [0, 0.5], name: "Transcript", short: ["Notes"], sub: "meeting notes" },
    gate: { at: [0.25, 0.5], name: "Command", short: ["Gate"], sub: "deterministic gate" },
    llm: { at: [0.5, 0.5], name: "Claude", sub: "structures it", kind: "ai" },
    json: { at: [0.75, 0.5], name: "Valid JSON", short: ["JSON"], sub: "checked" },
    t1: { at: [1, 0.1], name: "Task", sub: "monday.com" },
    t2: { at: [1, 0.37], name: "Task", sub: "monday.com" },
    t3: { at: [1, 0.63], name: "Task", sub: "monday.com" },
    ch: { at: [1, 0.9], name: "Charter", sub: "Docs + Slides", kind: "done" },
  },
  edges: [["tr", "gate"], ["gate", "llm"], ["llm", "json"], ["json", "t1", { alpha: 0.75 }], ["json", "t2", { alpha: 0.75 }], ["json", "t3", { alpha: 0.75 }], ["json", "ch", { color: "live", alpha: 0.75 }]],
  spawn: (n, api) => api.push(api.token([["tr", 0], ["gate", 0.2], ["llm", 0.5], ["json", 0.25]], { split: true })),
  arrive: (k, id, api) => {
    if (id !== "json" || !k.split) return;
    for (const tgt of ["t1", "t2", "t3"]) api.push(api.token([["json", 0], [tgt, 0]], { off: 0 }));
    api.push(api.token([["json", 0], ["ch", 0]], { off: 0, color: () => "live" }));
  },
});

// backlog triage agent: the model calls tools in a loop, then returns a priority that the evals check
SIMS.triage = (canvas, opt = {}) => K.flow(canvas, opt, {
  gap: 2.6, speed: 135, warm: 8,
  nodes: {
    item: { at: [0, 0.72], name: "Backlog item", short: ["Item"], sub: "new" },
    agent: { at: [0.34, 0.72], name: "Claude", sub: "agent loop", kind: "ai" },
    out: { at: [0.67, 0.72], name: "Priority", sub: "with reason" },
    ev: { at: [1, 0.72], name: "Evals", sub: "expected?", kind: "done" },
    rag: { at: [0.17, 0.1], atV: [0.17, 0.2], name: "Similar items", short: ["RAG"], sub: "RAG, ChromaDB" },
    tool: { at: [0.51, 0.1], atV: [0.51, 0.2], name: "Tool call", short: ["Tool"], sub: "JSON Schema" },
  },
  edges: [["item", "agent"], ["agent", "out"], ["out", "ev"],
    ["agent", "rag", { color: "accent", dash: [4, 5], alpha: 0.6, arrow: false }], ["agent", "tool", { color: "accent", dash: [4, 5], alpha: 0.6, arrow: false }]],
  spawn: (n, api) => api.push(api.token([["item", 0], ["agent", 0.2], ["rag", 0.3], ["agent", 0.15], ["tool", 0.3], ["agent", 0.2], ["out", 0.2], ["ev", 0]], { ring: k => k.i >= 6 })),
});

// CloudMed: imaging centers upload studies to one cloud viewer; doctors report; patients see every report in one place
SIMS.cloudmed = (canvas, opt = {}) => K.flow(canvas, opt, {
  gap: 0.9, speed: 118, warm: 6,
  nodes: {
    c0: { at: [0, 0.12], atV: [0, 0.16], name: "Imaging center", short: ["Center"] },
    c1: { at: [0, 0.5], name: "Imaging center", short: ["Center"] },
    c2: { at: [0, 0.88], atV: [0, 0.84], name: "Imaging center", short: ["Center"] },
    gw: { at: [0.33, 0.5], name: "Gateway", sub: "uploads studies" },
    cloud: { at: [0.64, 0.5], name: "Cloud viewer", short: ["Viewer"], sub: "one place", kind: "hub" },
    dr: { at: [1, 0.2], atV: [1, 0.22], name: "Doctor", sub: "reads, reports" },
    pt: { at: [1, 0.8], atV: [1, 0.78], name: "Patient", sub: "all reports", kind: "done" },
  },
  edges: [["c0", "gw"], ["c1", "gw"], ["c2", "gw"], ["gw", "cloud"], ["cloud", "dr"], ["dr", "pt", { color: "live", dash: [4, 5], alpha: 0.8 }]],
  spawn: (n, api) => api.push(api.token([["c" + (n % 3), 0], ["gw", 0.1], ["cloud", 0.3], ["dr", 0.5], ["pt", 0]], { color: k => (k.i >= 3 ? "live" : "accent") })),
});

// loan decisioning case study: rules and a risk score route each application
SIMS.loan = (canvas, opt = {}) => K.flow(canvas, opt, {
  gap: 0.7, speed: 122, warm: 6,
  nodes: {
    app: { at: [0, 0.5], name: "Application", short: ["Apply"], sub: "submitted" },
    chk: { at: [0.33, 0.5], name: "Data checks", short: ["Checks"], sub: "credit, KYC" },
    risk: { at: [0.66, 0.5], name: "Risk score", short: ["Risk"], sub: "business rules", kind: "hub" },
    ok: { at: [1, 0.12], atV: [1, 0.16], name: "Auto-approve", short: ["Approve"], sub: "low risk", kind: "done" },
    uw: { at: [1, 0.5], name: "Underwriter", short: ["Review"], sub: "medium risk", kind: "warn" },
    no: { at: [1, 0.88], atV: [1, 0.84], name: "Decline", sub: "high risk", kind: "muted" },
  },
  edges: [["app", "chk"], ["chk", "risk"], ["risk", "ok", { color: "live", alpha: 0.75 }], ["risk", "uw", { color: "signal", alpha: 0.75 }], ["risk", "no", { alpha: 0.75 }]],
  spawn: (n, api) => {
    const r = [0, 0, 1, 0, 2, 1, 0, 0, 1, 0][n % 10], end = ["ok", "uw", "no"][r];
    api.push(api.token([["app", 0], ["chk", 0.15], ["risk", 0.2], [end, 0]], { color: k => (k.i < 2 ? "accent" : ["live", "signal", "muted"][r]) }));
  },
});

// MSc thesis: quotes from interviews and forum threads are coded, then grouped into four kinds of value
SIMS.thesis = (canvas, opt = {}) => {
  const nodes = {
    iv: { at: [0, 0.28], name: "Interviews", sub: "10 players" },
    th: { at: [0, 0.74], name: "Forum threads", short: ["Threads"], sub: "10 threads" },
    v0: { at: [1, 0.07], name: "Competition", kind: "done" },
    v1: { at: [1, 0.36], name: "Fun", kind: "done" },
    v2: { at: [1, 0.65], name: "Self-image", kind: "done" },
    v3: { at: [1, 0.94], name: "Social bonding", short: ["Bonding"], kind: "done" },
  };
  for (let i = 0; i < 6; i++) nodes["c" + i] = { at: [0.46, 0.06 + i * 0.176], kind: "dot" };
  return K.flow(canvas, opt, {
    gap: 0.55, speed: 100, warm: 8, jitter: 10, horizontal: true,
    pad: (g, p) => (g.thumb ? { x: Math.max(52, g.W * 0.15), y: p.y } : g.W < 600 ? { x: 60, y: 34 } : p),
    nodes, edges: [["c0", "v0"], ["c1", "v0"], ["c2", "v1"], ["c3", "v2"], ["c4", "v3"], ["c5", "v1"]].map(([a, b]) => [a, b, { color: "live", alpha: 0.3, arrow: false }]),
    spawn: (n, api) => {
      const src = n % 3 === 2 ? "th" : "iv", c = (n * 7) % 6, v = [0, 0, 1, 2, 3, 1][c];
      api.push(api.token([[src, 0], ["c" + c, 0.35], ["v" + v, 0]], { color: k => (k.i >= 1 ? "live" : "accent") }));
    },
    over: (g, P) => K.note(g, "codes", { x: P.c0.x, y: P.c0.y - 12 }, "faint", { halo: true }),
  });
};

// fraud detection: a rare fraud class among normal transactions; the model flags most fraud with very few false alarms
SIMS.fraud = (canvas, opt = {}) => K.flow(canvas, opt, {
  gap: 0.16, speed: 170, warm: 6, jitter: 12,
  pad: (g, p) => (g.thumb ? { x: Math.max(58, g.W * 0.168), y: p.y } : p),
  nodes: {
    tx: { at: [0, 0.5], name: "Transactions", short: ["Payments"], sub: "rare fraud class" },
    model: { at: [0.48, 0.5], name: "Model", sub: "ML vs deep learning", kind: "ai" },
    flag: { at: [1, 0.12], atV: [0.9, 0.25], name: "Flagged", sub: "for review", kind: "warn" },
    ok: { at: [1, 0.82], atV: [0.9, 0.75], name: "Cleared", sub: "normal" },
  },
  edges: [["tx", "model"], ["model", "flag", { color: "signal", alpha: 0.8 }], ["model", "ok"]],
  spawn: (n, api) => {
    const fraud = n % 13 === 5, caught = fraud && ((n / 13) | 0) % 4 !== 3;
    api.push(api.token([["tx", 0], ["model", 0.05], [caught ? "flag" : "ok", 0]], { color: () => (fraud ? "signal" : "accent"), r: fraud ? 3.8 : 2.8 }));
  },
  over: g => K.note(g, "precision 0.97 · recall 0.77", g.vertical ? { x: g.W / 2, y: g.H - 12 } : { x: g.thumb ? 10 : 16, y: g.H - (g.thumb ? 10 : 16) }, "ink", { align: g.vertical ? "center" : "left", halo: true }),
});

// time-series forecasting: the network's forecast follows the actual series past the train/test split
SIMS.timeseries = (canvas, opt = {}) => {
  const r = K.rand(7), N = 140, A = [];
  let v = 0.5;
  for (let i = 0; i < N; i++) { v += (r() - 0.5) * 0.07 + 0.08 * Math.sin(i / 9) * 0.25; A.push(v); }
  const lo = Math.min(...A), hi = Math.max(...A);
  for (let i = 0; i < N; i++) A[i] = 0.1 + ((A[i] - lo) / (hi - lo || 1)) * 0.8;   // rescale into the plot instead of clipping
  const F = A.map((a, i) => (i < 3 ? a : A[i - 1] * 0.55 + A[i - 2] * 0.3 + A[i - 3] * 0.15 + (r() - 0.5) * 0.03));
  const split = Math.round(N * 0.7);
  return K.chart(canvas, opt, { warmT: 9.5, draw: (g, b, t) => {
    const { ctx } = g, cyc = 13, k = Math.min(N, Math.floor(((t % cyc) / (cyc - 2.5)) * N));
    K.axes(g, b, "time", "");
    K.legend(g, [["actual", "muted"], ["LSTM forecast", "accent"]], b.x, b.y - (g.thumb ? 12 : 16));
    const X = i => b.x + (i / (N - 1)) * b.w, Y = y => b.y + (1 - y) * b.h;
    ctx.save(); ctx.fillStyle = K.col("accent"); ctx.globalAlpha = C.glow ? 0.06 : 0.05; ctx.fillRect(X(split), b.y, b.x + b.w - X(split), b.h); ctx.restore();
    ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = K.col("signal"); ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(X(split), b.y); ctx.lineTo(X(split), b.y + b.h); ctx.stroke(); ctx.restore();
    K.note(g, "test set", { x: X(split) + 6, y: b.y + (g.thumb ? 11 : 14) }, "signal", { align: "left" });
    const line = (arr, from, to, color, w) => { if (to - from < 2) return; ctx.save(); ctx.strokeStyle = K.col(color); ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.beginPath(); for (let i = from; i < to; i++) (i === from ? ctx.moveTo : ctx.lineTo).call(ctx, X(i), Y(arr[i])); ctx.stroke(); ctx.restore(); };
    line(A, 0, k, "muted", g.thumb ? 1.2 : 1.5);
    line(F, split, Math.max(split, k), "accent", g.thumb ? 1.8 : 2.2);
    if (k > split) K.dot(g, { x: X(k - 1), y: Y(F[k - 1]) }, "accent", { r: g.thumb ? 2.6 : 3.2 });
  } });
};

// income prediction: a decision tree splits the census data into regions, one split at a time
SIMS.income = (canvas, opt = {}) => {
  const r = K.rand(11), pts = [];
  for (let i = 0; i < 150; i++) {
    const x = r(), y = r();
    const p = (x > 0.45 ? 0.55 : 0.12) + (y > 0.55 ? 0.3 : 0) - (x > 0.8 ? 0.15 : 0);
    pts.push({ x, y, hi: r() < p });
  }
  const splits = [{ v: 0.45, dir: "x" }, { v: 0.55, dir: "y", from: 0.45 }, { v: 0.8, dir: "x", lo: 0.55 }];
  return K.chart(canvas, opt, { warmT: 9, draw: (g, b, t) => {
    const { ctx } = g, cyc = 12, s = Math.min(3, Math.floor((t % cyc) / 2.4));
    K.axes(g, b, "years of education", "hours per week");
    K.legend(g, [["over $50K", "signal"], ["$50K or less", "accent"]], b.x, b.y - (g.thumb ? 12 : 16));
    const X = v => b.x + v * b.w, Y = v => b.y + (1 - v) * b.h;
    for (const p of pts) K.dot(g, { x: X(p.x), y: Y(p.y) }, p.hi ? "signal" : "accent", { r: g.thumb ? 2 : 2.6, glow: 0, alpha: 0.85 });
    ctx.save(); ctx.strokeStyle = K.col("ink"); ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85;
    splits.slice(0, s).forEach(sp => {
      ctx.beginPath();
      if (sp.dir === "y") { ctx.moveTo(X(sp.from), Y(sp.v)); ctx.lineTo(b.x + b.w, Y(sp.v)); }
      else if (sp.lo != null) { ctx.moveTo(X(sp.v), b.y + b.h); ctx.lineTo(X(sp.v), Y(sp.lo)); }
      else { ctx.moveTo(X(sp.v), b.y); ctx.lineTo(X(sp.v), b.y + b.h); }
      ctx.stroke();
    });
    ctx.restore();
  } });
};

// insurance premiums: the regression lines settle onto the data; smokers sit on a higher band
SIMS.insurance = (canvas, opt = {}) => {
  const r = K.rand(5), pts = [];
  for (let i = 0; i < 110; i++) { const x = r(), sm = r() < 0.22; pts.push({ x, sm, y: Math.min(0.97, 0.12 + 0.45 * x + (sm ? 0.32 : 0) + (r() - 0.5) * 0.12) }); }
  return K.chart(canvas, opt, { warmT: 6, draw: (g, b, t) => {
    const { ctx } = g, cyc = 10, f = Math.min(1, (t % cyc) / 4), e = 1 - Math.pow(1 - f, 3);
    K.axes(g, b, "body mass index", "yearly premium");
    K.legend(g, [["smokers", "signal"], ["non-smokers", "accent"]], b.x, b.y - (g.thumb ? 12 : 16));
    const X = v => b.x + v * b.w, Y = v => b.y + (1 - v) * b.h;
    for (const p of pts) K.dot(g, { x: X(p.x), y: Y(p.y) }, p.sm ? "signal" : "accent", { r: g.thumb ? 2 : 2.6, glow: 0, alpha: 0.85 });
    const fit = (x, sm) => 0.12 + 0.45 * x + (sm ? 0.32 : 0);
    ctx.save(); ctx.lineWidth = g.thumb ? 1.8 : 2.2;
    for (const sm of [false, true]) {
      const y0 = 0.5 + (fit(0, sm) - 0.5) * e, y1 = 0.5 + (fit(1, sm) - 0.5) * e;
      ctx.strokeStyle = K.col(sm ? "signal" : "accent"); ctx.beginPath(); ctx.moveTo(X(0), Y(y0)); ctx.lineTo(X(1), Y(y1)); ctx.stroke();
    }
    ctx.restore();
  } });
};

// dashboards: monthly bars grow in and a KPI line draws over them
SIMS.dashboards = (canvas, opt = {}) => {
  const r = K.rand(3), M = 12, B = [...Array(M)].map((_, i) => 0.35 + 0.35 * Math.sin(i / 2.2) * 0.5 + r() * 0.3), L = B.map((v, i) => 0.25 + i * 0.045 + (r() - 0.5) * 0.05);
  return K.chart(canvas, opt, { warmT: 5, draw: (g, b, t) => {
    const { ctx } = g, cyc = 9, f = Math.min(1, (t % cyc) / 3.5);
    K.axes(g, b, "month", "");
    K.legend(g, [["sales", "accent"], ["margin", "signal"]], b.x, b.y - (g.thumb ? 12 : 16));
    const w = b.w / M;
    ctx.save();
    for (let i = 0; i < M; i++) {
      const h = B[i] * b.h * Math.min(1, Math.max(0, f * M - i * 0.6));
      K.rr(ctx, b.x + i * w + w * 0.18, b.y + b.h - h, w * 0.64, h, Math.min(4, w * 0.15));
      ctx.fillStyle = K.col("accent"); ctx.globalAlpha = C.glow ? 0.35 : 0.22; ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = K.col("signal"); ctx.lineWidth = g.thumb ? 1.8 : 2.2; ctx.lineJoin = "round"; ctx.beginPath();
    const k = Math.max(1, Math.floor(f * M));
    for (let i = 0; i < k; i++) { const x = b.x + i * w + w / 2, y = b.y + (1 - L[i]) * b.h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
    const i = k - 1; K.dot(g, { x: b.x + i * w + w / 2, y: b.y + (1 - L[i]) * b.h }, "signal", { r: g.thumb ? 2.6 : 3.2 });
  } });
};
})();

// mount every simulation on the page; project cards get the compact thumbnail version
document.querySelectorAll("canvas[data-sim]").forEach(c => {
  const make = window.SIMS[c.dataset.sim];
  if (make) make(c, c.hasAttribute("data-thumb") ? { thumb: true } : {});
});
