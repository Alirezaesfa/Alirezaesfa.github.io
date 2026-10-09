// Shared kit for the project simulations. Everything drawn here uses simulated data.
// Diagrams are drawn like process maps: activity boxes, arrows, and tokens that flow between them.
// Nodes are placed in flow coordinates [u along the flow, v across it], so one spec draws
// left to right on wide canvases and top to bottom on tall (phone) canvases.
const SIMKIT = (() => {
  const root = document.documentElement;
  const C = {};
  const VARS = { line: "--diagram", ink: "--ink", muted: "--muted", faint: "--faint", accent: "--accent", signal: "--signal", live: "--live", node: "--node", edge: "--node-edge", bg: "--sim-bg" };
  function readColors() {
    const cs = getComputedStyle(root);
    for (const k in VARS) C[k] = cs.getPropertyValue(VARS[k]).trim() || "#888";
    C.glow = parseFloat(cs.getPropertyValue("--sim-glow")) || 0;
  }
  readColors();
  const col = c => (c ? C[c] || c : C.accent);
  const SANS = '"Geist", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const font = (px, w = 400, mono = true) => w + " " + px + "px " + (mono ? MONO : SANS);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mounted = [];

  // ---------- mounting and the animation loop ----------
  function mount(canvas, sim, opt = {}) {
    const ctx = canvas.getContext("2d");
    const g = { ctx, canvas, W: 0, H: 0, thumb: !!opt.thumb, vertical: false };
    let ready = false;
    const size = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      g.W = r.width; g.H = r.height;
      g.vertical = !g.thumb && g.H > g.W * 0.8;
      g.big = !g.thumb && !g.vertical && g.W >= 900;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.layout(g);
      return true;
    };
    g.redraw = () => { if (ready) sim.draw(g); };
    g.relayout = () => {
      if (!size()) return;
      if (!ready) { ready = true; sim.warm(g); }
      sim.draw(g);
    };
    const fig = canvas.closest("figure"), btn = fig && fig.querySelector(".sim-pause");
    let paused = false;
    if (btn && !opt.thumb) {
      if (reduce) btn.hidden = true;
      else btn.addEventListener("click", () => {
        paused = !paused;
        btn.setAttribute("aria-pressed", String(paused));
        btn.textContent = paused ? "Play" : "Pause";
      });
    }
    g.relayout();
    mounted.push(g);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(g.relayout);
    let rt;
    const later = () => { clearTimeout(rt); rt = setTimeout(g.relayout, 60); };
    if ("ResizeObserver" in window) new ResizeObserver(later).observe(canvas);
    else addEventListener("resize", later);
    if (reduce) return g;
    let visible = true, last = 0;
    if ("IntersectionObserver" in window) new IntersectionObserver(e => { visible = e[e.length - 1].isIntersecting; }).observe(canvas);
    const frame = ts => {
      const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
      last = ts;
      if (ready && visible && !document.hidden && !paused) { sim.step(dt, g); sim.draw(g); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return g;
  }
  // called when the colour theme changes
  function refresh() { readColors(); for (const g of mounted) g.redraw(); }

  // ---------- tokens that walk a list of stops: [nodeId, seconds to wait on arrival] ----------
  const quad = (a, b, c, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  function segLen(a, b, c) {
    if (!c) return Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let len = 0, p = a;
    for (let i = 1; i <= 16; i++) { const q = quad(a, b, c, i / 16); len += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
    return len || 1;
  }
  const along = (a, b, c, t) => (c ? quad(a, b, c, t) : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const makeToken = (stops, extra) => Object.assign({ stops, i: 0, t: 0, wait: stops[0][1] || 0, done: false, fade: 1 }, extra);
  function move(tok, dt, speed, pt, ctrl, onArrive) {
    if (tok.done) { tok.fade -= dt * 1.6; return; }
    if (tok.wait > 0) { tok.wait -= dt; return; }
    if (tok.i >= tok.stops.length - 1) { tok.done = true; return; }
    const a = tok.stops[tok.i][0], b = tok.stops[tok.i + 1][0];
    tok.t += (speed * dt) / segLen(pt(a), pt(b), ctrl(a, b));
    if (tok.t >= 1) {
      tok.t = 0; tok.i++; tok.wait = tok.stops[tok.i][1] || 0;
      if (onArrive) onArrive(tok, b);
      if (tok.i >= tok.stops.length - 1 && tok.wait <= 0) tok.done = true;
    }
  }
  function where(tok, pt, ctrl) {
    const a = tok.stops[tok.i][0];
    if (tok.done || tok.wait > 0 || tok.i >= tok.stops.length - 1) return pt(a);
    const b = tok.stops[tok.i + 1][0];
    return along(pt(a), pt(b), ctrl(a, b), tok.t);
  }

  // ---------- drawing primitives ----------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // try every name at the two largest sizes first (a shorter name beats a much smaller font), then shrink
  function fitText(ctx, names, maxW, sizes, weight, mono) {
    for (const pass of [sizes.slice(0, 2), sizes.slice(2)]) for (const t of names) for (const s of pass) {
      ctx.font = font(s, weight, mono);
      const w = ctx.measureText(t).width;
      if (w <= maxW) return { text: t, size: s, w };
    }
    const t = names[names.length - 1], s = sizes[sizes.length - 1];
    ctx.font = font(s, weight, mono);
    return { text: t, size: s, w: ctx.measureText(t).width };
  }
  // where the segment from `from` to the centre of box n crosses the box edge
  function clipToBox(from, n) {
    if (!n.w) return { x: n.x, y: n.y };
    const dx = n.x - from.x, dy = n.y - from.y;
    const t = Math.min(dx ? n.w / 2 / Math.abs(dx) : Infinity, dy ? n.h / 2 / Math.abs(dy) : Infinity);
    if (!isFinite(t) || t >= 1) return { x: n.x, y: n.y };
    return { x: n.x - dx * t, y: n.y - dy * t };
  }
  function arrowHead(ctx, tip, from, size, color) {
    const a = Math.atan2(tip.y - from.y, tip.x - from.x);
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - size * Math.cos(a - 0.42), tip.y - size * Math.sin(a - 0.42));
    ctx.lineTo(tip.x - size * Math.cos(a + 0.42), tip.y - size * Math.sin(a + 0.42));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  // an edge from box A to box B (or a point), optionally curved through o.ctrl
  function link(g, A, B, o = {}) {
    const { ctx } = g, c = col(o.color || "line");
    // straight edges stop at the box borders; curves run centre to centre (the boxes hide the ends),
    // so tokens travelling the same curve stay exactly on the drawn line
    const s = o.ctrl ? A : clipToBox(B, A), e = o.ctrl ? B : clipToBox(A, B);
    ctx.save();
    ctx.strokeStyle = c; ctx.lineWidth = o.w || (g.thumb ? 1.25 : g.big ? 1.7 : 1.5); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(s.x, s.y);
    if (o.ctrl) ctx.quadraticCurveTo(o.ctrl.x, o.ctrl.y, e.x, e.y); else ctx.lineTo(e.x, e.y);
    ctx.stroke(); ctx.setLineDash([]);
    if (o.arrow !== false && B.w) {
      const size = g.thumb ? 5 : g.big ? 7.5 : 6.5;
      if (!o.ctrl) arrowHead(ctx, e, s, size, c);
      else {
        let t = 1;
        while (t > 0 && inBox(quad(A, B, o.ctrl, t), B)) t -= 0.01;
        arrowHead(ctx, quad(A, B, o.ctrl, t), quad(A, B, o.ctrl, Math.max(0, t - 0.03)), size, c);
      }
    }
    ctx.restore();
  }
  const inBox = (p, n) => Math.abs(p.x - n.x) <= n.w / 2 && Math.abs(p.y - n.y) <= n.h / 2;
  const KIND = { step: { line: "edge" }, ai: { line: "accent", tint: "accent" }, hub: { line: "accent" }, done: { line: "live", tint: "live" }, warn: { line: "signal", tint: "signal" }, src: { line: "edge", text: "muted" }, muted: { line: "edge", text: "muted" } };
  function box(g, n, o = {}) {
    const { ctx } = g, k = KIND[n.kind || "step"] || KIND.step;
    const x = n.x - n.w / 2, y = n.y - n.h / 2, r = g.thumb ? 6 : 9;
    const line = col(o.line || k.line), alpha = o.ghost ? 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (o.pulse > 0) {
      const e = 2 + (1 - o.pulse) * (g.thumb ? 4 : 7);
      rr(ctx, x - e, y - e, n.w + 2 * e, n.h + 2 * e, r + e);
      ctx.strokeStyle = col(k.tint || "accent"); ctx.globalAlpha = alpha * o.pulse * o.pulse * 0.4; ctx.lineWidth = 1.25; ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    rr(ctx, x, y, n.w, n.h, r);
    if (!C.glow && !o.ghost) { ctx.shadowColor = "rgba(15, 23, 42, .09)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 1.5; }
    ctx.fillStyle = C.node; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (k.tint) { ctx.globalAlpha = alpha * (C.glow ? 0.14 : 0.08); ctx.fillStyle = col(k.tint); ctx.fill(); ctx.globalAlpha = alpha; }
    if (o.ghost) ctx.setLineDash([4, 4]);
    ctx.strokeStyle = line; ctx.lineWidth = n.kind && n.kind !== "step" && n.kind !== "src" && n.kind !== "muted" ? 1.5 : 1.15; ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const dy = g.big ? 8.5 : 7;
    ctx.font = font(n.fit.size, 600, false); ctx.fillStyle = col(o.text || k.text || "ink");
    ctx.fillText(n.fit.text, n.x, n.subFit ? n.y - dy : n.y + 0.5);
    if (n.subFit) { ctx.font = font(n.subSize, 400, true); ctx.fillStyle = C.faint; ctx.fillText(n.subFit.text, n.x, n.y + dy + 2.5); }
    if (o.badge) badge(g, { x: x + n.w, y }, o.badge, o.badgeColor || k.tint || "accent");
    ctx.restore();
  }
  // a small pill pinned to a point (the top-right corner of a box)
  function badge(g, p, text, color) {
    const { ctx } = g, fs = g.thumb ? 9.5 : 10.5;
    ctx.save(); ctx.font = font(fs, 500, true);
    const w = ctx.measureText(text).width + (g.thumb ? 9 : 12), h = g.thumb ? 15 : 18;
    const x = Math.min(g.W - w - 2, p.x - w * 0.55), y = Math.max(2, p.y - h * 0.6);
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = col(color); ctx.fill();
    ctx.fillStyle = C.node; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  }
  function dot(g, p, color, o = {}) {
    const { ctx } = g, r = o.r || (g.thumb ? 2.9 : g.big ? 4 : 3.6), c = col(color);
    ctx.save();
    ctx.globalAlpha = clamp(o.alpha == null ? 1 : o.alpha, 0, 1);
    if (C.glow) { ctx.shadowBlur = o.glow == null ? C.glow : o.glow; ctx.shadowColor = c; }
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = c; ctx.fill();
    if (!C.glow) { ctx.lineWidth = 1.4; ctx.strokeStyle = C.node; ctx.stroke(); }
    if (o.ring) { ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(p.x, p.y, r + 3.2, 0, 7); ctx.strokeStyle = c; ctx.globalAlpha *= 0.7; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.restore();
  }
  // a small text annotation
  function note(g, s, p, color, o = {}) {
    const { ctx } = g;
    ctx.save(); ctx.font = font(o.size || (g.thumb ? 10 : 11), o.weight || 500, true);
    ctx.fillStyle = col(color || "faint"); ctx.textAlign = o.align || "center"; ctx.textBaseline = o.base || "alphabetic";
    if (o.halo) { ctx.lineWidth = 4; ctx.strokeStyle = C.bg; ctx.lineJoin = "round"; ctx.strokeText(s, p.x, p.y); }
    ctx.fillText(s, p.x, p.y);
    ctx.restore();
  }

  // ---------- layout helpers ----------
  function pads(g) {
    if (g.vertical) return { x: 14, y: 34 };
    if (g.thumb) return { x: Math.max(40, g.W * 0.115), y: Math.max(18, g.H * 0.1) };
    return { x: clamp(g.W * 0.085, 46, 112), y: clamp(g.H * 0.1, 28, 42) };
  }
  function place(g, at, pad) {
    const [u, v] = at;
    if (g.vertical) return { x: pad.x + v * (g.W - 2 * pad.x), y: pad.y + u * (g.H - 2 * pad.y) };
    return { x: pad.x + u * (g.W - 2 * pad.x), y: pad.y + v * (g.H - 2 * pad.y) };
  }
  // size every box so its label fits and neighbours on the same row never overlap
  function sizeNodes(g, list) {
    const ctx = g.ctx, thumb = g.thumb, gap = thumb ? 8 : 12, margin = thumb ? 10 : 8, padX = thumb ? 7 : g.big ? 14 : 11;
    const H2 = thumb ? 24 : g.big ? 46 : 40, H1 = thumb ? 24 : g.big ? 34 : 30, subSize = g.big ? 11.5 : 10.5;
    const sizes = thumb ? [11.5, 11, 10.5, 10] : g.big ? [14.5, 14, 13.5, 13, 12.5] : [13.5, 13, 12.5, 12, 11.5];
    for (const n of list) {
      if (n.kind === "point" || n.kind === "dot") { n.w = n.h = 0; continue; }
      let room = 2 * Math.min(n.x - margin, g.W - n.x - margin);
      for (const m of list) {
        if (m === n || m.kind === "point" || m.kind === "dot") continue;
        if (Math.abs(m.y - n.y) < H2) room = Math.min(room, Math.abs(m.x - n.x) - gap);
      }
      room = Math.max(28, Math.min(room, n.maxW || (thumb ? 140 : g.big ? 240 : 220)));
      const names = [n.name].concat(n.short || []).filter(Boolean);
      n.fit = fitText(ctx, names, room - 2 * padX, sizes, 600, false);
      n.subFit = null;
      n.subSize = subSize;
      if (!thumb && n.sub) {
        ctx.font = font(subSize, 400, true);
        const sw = ctx.measureText(n.sub).width;
        if (sw <= room - 2 * padX) n.subFit = { text: n.sub, w: sw };
      }
      n.w = Math.min(room, Math.max(n.fit.w, n.subFit ? n.subFit.w : 0) + 2 * padX);
      n.h = n.subFit ? H2 : H1;
    }
  }

  // ---------- the flow engine ----------
  // spec: { nodes: {id: {at, atV?, name, short?, sub?, kind?}}, edges: [[a, b, opts]], gap, speed, warm,
  //         spawn(n, api), arrive(tok, id, api), tick(dt, api), look(node, st), over(g, P, st), stats(st), state() }
  function flow(canvas, opt, spec) {
    const S = { P: {}, list: [], tokens: [], pulses: {}, spawnT: 0, n: 0, g: null, scale: 1 };
    const st = spec.state ? spec.state() : {};
    const curves = {};
    for (const [a, b, o] of spec.edges) if (o && o.curve) curves[a + ">" + b] = o.curve;
    const pt = id => S.P[id];
    const ctrl = (a, b) => (curves[a + ">" + b] ? S.P[curves[a + ">" + b]] : null);
    const api = {
      st, S, thumb: !!opt.thumb,
      push: tok => S.tokens.push(tok),
      token: (stops, extra) => makeToken(stops, Object.assign({ off: (Math.random() - 0.5) * (spec.jitter == null ? 6 : spec.jitter) }, extra)),
      clear: () => { S.tokens = []; S.pulses = {}; S.spawnT = 0; },
      warm: sec => { for (let t = 0; t < sec; t += 0.05) core(0.05); },
      redraw: () => { if (S.g) draw(S.g); },
    };
    function core(dt) {
      if (spec.tick) spec.tick(dt, api);
      else {
        S.spawnT += dt;
        if (S.spawnT >= spec.gap) { S.spawnT = 0; spec.spawn(S.n++, api); }
      }
      const sp = (spec.speed || 110) * S.scale;
      for (const k of S.tokens) K_move(k, dt, sp);
      S.tokens = S.tokens.filter(k => k.fade > 0);
      for (const id in S.pulses) S.pulses[id] = Math.max(0, S.pulses[id] - dt * 1.8);
    }
    const K_move = (k, dt, sp) => move(k, dt, sp * (k.speed || 1), pt, ctrl, (tok, id) => { S.pulses[id] = 1; if (spec.arrive) spec.arrive(tok, id, api); });
    function layout(g) {
      S.g = g;
      if (spec.horizontal) g.vertical = false;   // some flows only read well left to right
      const pad = spec.pad ? spec.pad(g, pads(g)) : pads(g);
      S.P = {}; S.list = [];
      for (const id in spec.nodes) {
        const d = spec.nodes[id];
        const n = Object.assign({ id }, d, place(g, (g.vertical && d.atV) || d.at, pad));
        S.P[id] = n; S.list.push(n);
      }
      sizeNodes(g, S.list);
      S.scale = clamp((g.vertical ? g.H : g.W) / 950, 0.42, 1.1);
    }
    function draw(g) {
      const { ctx } = g;
      ctx.clearRect(0, 0, g.W, g.H);
      for (const [a, b, o = {}] of spec.edges) {
        if (o.when && !o.when(st)) continue;
        link(g, S.P[a], S.P[b], Object.assign({}, o, { ctrl: o.curve ? S.P[o.curve] : null }));
      }
      if (spec.under) spec.under(g, S.P, st);
      for (const k of S.tokens) {
        const p = where(k, pt, ctrl), off = (k.off || 0) * (g.thumb ? 0.6 : 1);
        dot(g, g.vertical ? { x: p.x + off, y: p.y } : { x: p.x, y: p.y + off }, k.color ? k.color(k, st) : "accent", { alpha: k.fade, ring: k.ring && k.ring(k), r: k.r && (g.thumb ? k.r * 0.8 : k.r) });
      }
      for (const n of S.list) {
        if (n.kind === "point") continue;
        if (n.kind === "dot") {
          const pulse = S.pulses[n.id] || 0, r = g.thumb ? 3 : 4.5;
          ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y, r + pulse * 3, 0, 7); ctx.fillStyle = C.node; ctx.fill();
          ctx.strokeStyle = col(n.color || "accent"); ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
          continue;
        }
        box(g, n, Object.assign({ pulse: S.pulses[n.id] || 0 }, spec.look ? spec.look(n, st, api) : {}));
      }
      if (spec.over) spec.over(g, S.P, st, api);
    }
    let statT = 0;
    return mount(canvas, {
      layout,
      warm: () => { api.warm(spec.warm || 6); if (spec.warmed) spec.warmed(api); if (!opt.thumb && spec.stats) spec.stats(st, api); },
      step: dt => { core(dt); statT += dt; if (!opt.thumb && spec.stats && statT > 0.25) { statT = 0; spec.stats(st, api); } },
      draw,
    }, opt);
  }

  // ---------- simple animated charts ----------
  function chart(canvas, opt, spec) {
    let t = 0;
    return mount(canvas, {
      layout: () => {},
      warm: () => { t = spec.warmT || 0; },
      step: dt => { t += dt; },
      draw: g => { g.ctx.clearRect(0, 0, g.W, g.H); spec.draw(g, plotBox(g), t); },
    }, opt);
  }
  function plotBox(g) {
    const l = g.thumb ? 26 : Math.max(36, g.W * 0.06), top = g.thumb ? 30 : 40, r = g.thumb ? 14 : Math.max(22, g.W * 0.04), b = g.thumb ? 24 : 34;
    return { x: l, y: top, w: g.W - l - r, h: g.H - top - b };
  }
  function axes(g, b, xl, yl) {
    const { ctx } = g;
    ctx.save();
    ctx.strokeStyle = C.edge; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { const y = Math.round(b.y + (b.h * i) / 4) + 0.5; ctx.globalAlpha = 0.6; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.strokeStyle = C.line;
    ctx.beginPath(); ctx.moveTo(b.x + 0.5, b.y); ctx.lineTo(b.x + 0.5, b.y + b.h + 0.5); ctx.lineTo(b.x + b.w, b.y + b.h + 0.5); ctx.stroke();
    ctx.font = font(g.thumb ? 9.5 : 10.5, 500, true); ctx.fillStyle = C.faint;
    ctx.textAlign = "right"; ctx.fillText(xl, b.x + b.w, b.y + b.h + (g.thumb ? 15 : 20));
    if (yl) { ctx.save(); ctx.translate(b.x - (g.thumb ? 9 : 13), b.y + b.h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText(yl, 0, 0); ctx.restore(); }
    ctx.restore();
  }
  // legend entries: [[label, colourKey], ...] laid out left to right from x (or ending at x when right-aligned)
  function legend(g, items, x, y, align) {
    const { ctx } = g, gapW = g.thumb ? 12 : 18;
    ctx.save(); ctx.font = font(g.thumb ? 9.5 : 10.5, 500, true); ctx.textBaseline = "middle";
    if (align === "right") x -= items.reduce((s, [label]) => s + 12 + ctx.measureText(label).width + gapW, 0) - gapW;
    for (const [label, c] of items) {
      ctx.fillStyle = col(c); ctx.beginPath(); ctx.arc(x + 4, y, g.thumb ? 3 : 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.fillText(label, x + 12, y + 0.5);
      x += 12 + ctx.measureText(label).width + gapW;
    }
    ctx.restore();
    return x;
  }
  // seeded noise so every load draws the same data
  const rand = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);

  const set = (el, v) => { if (el && el.textContent !== String(v)) el.textContent = v; };
  return { C, col, font, MONO, SANS, set, mount, refresh, flow, chart, axes, legend, rand, makeToken, move, where, quad, link, box, dot, note, badge, rr, clamp };
})();
