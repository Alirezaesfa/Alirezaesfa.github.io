// shared kit for the process simulations
const SIMKIT = (() => {
  const css = getComputedStyle(document.documentElement);
  const col = n => css.getPropertyValue(n).trim();
  const C = { line: col("--diagram"), ink: col("--ink"), faint: col("--faint"), muted: col("--muted"), accent: col("--accent"), signal: col("--signal"), live: col("--live"), node: col("--surface-2") };
  const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(canvas, sim, opt = {}) {
    const ctx = canvas.getContext("2d");
    const g = { ctx, W: 0, H: 0 };
    const size = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      // thumbnails draw on a fixed logical stage and scale it down, so labels keep their full-size layout
      const s = opt.logical ? r.width / opt.logical : 1;
      g.W = r.width / s; g.H = r.height / s;
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      sim.layout(g);
    };
    g.redraw = () => sim.draw(g);
    const fig = canvas.closest("figure"), btn = fig && fig.querySelector(".sim-pause");
    let paused = false;
    if (btn && !opt.thumb) {
      if (reduce) btn.hidden = true;
      else btn.addEventListener("click", () => {
        paused = !paused;
        btn.setAttribute("aria-pressed", String(paused));
      });
    }
    size();
    sim.warm(g);
    sim.draw(g);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(g.redraw);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { size(); sim.draw(g); }, 80); });
    if (reduce) return g;
    let visible = true, last = 0;
    if ("IntersectionObserver" in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(canvas);
    const frame = ts => {
      const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
      last = ts;
      if (visible && !document.hidden && !paused) { sim.step(dt, g); sim.draw(g); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return g;
  }

  const quad = (a, b, c, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  function segLen(a, b, c) {
    if (!c) return Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let len = 0, p = a;
    for (let i = 1; i <= 16; i++) { const q = quad(a, b, c, i / 16); len += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
    return len || 1;
  }
  const along = (a, b, c, t) => (c ? quad(a, b, c, t) : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  // a token walks a list of stops: [pointId, seconds to wait on arrival]
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

  function edge(g, a, b, color, o = {}) {
    const { ctx } = g;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = o.w || 1.5; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    if (o.ctrl) ctx.quadraticCurveTo(o.ctrl.x, o.ctrl.y, b.x, b.y); else ctx.lineTo(b.x, b.y);
    ctx.stroke(); ctx.restore();
  }
  function node(g, p, color, o = {}) {
    const { ctx } = g, r = o.r || 9;
    ctx.save();
    if (o.pulse > 0) {
      ctx.beginPath(); ctx.arc(p.x, p.y, r + (1 - o.pulse) * 12, 0, 7);
      ctx.strokeStyle = color; ctx.globalAlpha = o.pulse * 0.45; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (o.ghost) { ctx.globalAlpha = 0.4; ctx.setLineDash([3, 3]); }
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7);
    ctx.fillStyle = C.node; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    if (!o.ghost) { ctx.beginPath(); ctx.arc(p.x, p.y, o.filled ? r * 0.5 : r * 0.34, 0, 7); ctx.fillStyle = color; ctx.fill(); }
    ctx.restore();
  }
  function label(g, name, sub, p, color, o = {}) {
    const { ctx } = g;
    ctx.save(); ctx.textAlign = "center";
    if (o.ghost) ctx.globalAlpha = 0.45;
    const y1 = o.above ? p.y - (sub ? 31 : 15) : p.y + 28, y2 = o.above ? p.y - 17 : p.y + 43;
    ctx.font = (o.small ? "400 10px " : "500 11px ") + MONO; ctx.fillStyle = color; ctx.fillText(name, p.x, y1);
    if (sub) { ctx.font = "400 10px " + MONO; ctx.fillStyle = C.faint; ctx.fillText(sub, p.x, y2); }
    ctx.restore();
  }
  function text(g, s, p, color) {
    const { ctx } = g;
    ctx.save(); ctx.textAlign = "center"; ctx.font = "400 10px " + MONO; ctx.fillStyle = color; ctx.fillText(s, p.x, p.y); ctx.restore();
  }
  function dot(g, p, color, o = {}) {
    const { ctx } = g, r = o.r || 3.2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha == null ? 1 : o.alpha));
    ctx.shadowBlur = o.glow == null ? 10 : o.glow; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = color; ctx.fill();
    if (o.ring) { ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(p.x, p.y, r + 3.5, 0, 7); ctx.strokeStyle = color; ctx.globalAlpha *= 0.65; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.restore();
  }
  const set = (el, v) => { if (el && el.textContent !== String(v)) el.textContent = v; };
  const font = (px, w = 400) => w + " " + px + "px " + MONO;
  return { C, MONO, set, font, mount, quad, makeToken, move, where, edge, node, label, text, dot };
})();

