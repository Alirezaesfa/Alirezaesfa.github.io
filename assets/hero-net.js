// Home page hero: three faint orbits around the portrait, each with evenly spaced nodes. The orbits turn slowly
// in alternating directions; spokes between neighbouring orbits fade in as nodes line up and out as they pass,
// and small signals travel along the orbits and step outward. Decorative only (aria-hidden). It fades out on the
// headline side so the text stays clean. Still for reduced motion; paused off screen or in a hidden tab.
(() => {
  const hero = document.querySelector(".hero"), portrait = hero && hero.querySelector(".portrait");
  if (!hero || !portrait) return;
  const canvas = document.createElement("canvas");
  canvas.className = "hero-net";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  let W = 0, H = 0, cx = 0, cy = 0, R = 0, narrow = false, rings = [], signals = [];
  let color = "#1a63d6", dark = false, time = 0, sigT = 0, pulseT = 0;
  let seed = 5;   // seeded random so every load looks the same
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  // how visible a point at angle th is: wide screens fade the side facing the headline (left) and the very bottom;
  // phones, where the portrait sits above the headline, fade the lower half
  const vis = th => {
    const c = Math.cos(th), s = Math.sin(th);
    return narrow ? smooth(0.45, -0.1, s) * smooth(-0.7, -0.15, c) : smooth(-0.62, -0.15, c) * smooth(0.97, 0.72, s);   // and the very bottom, above the facts
  };
  // ...and the top edge of the hero, so the outer orbit never runs hard into the header
  const V = (th, r) => vis(th) * smooth(0, 40, cy + r * Math.sin(th));
  const nodeAngle = (g, i) => g.off + g.w * time + (i * TAU) / g.n;

  function readColor() {
    color = getComputedStyle(root).getPropertyValue("--accent").trim() || color;
    dark = root.dataset.theme === "dark";
  }
  function build() {
    const hr = hero.getBoundingClientRect(), pr = portrait.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (hr.width < 40 || hr.height < 40 || pr.width < 20) return false;
    W = hr.width; H = hr.height;
    cx = pr.left - hr.left + pr.width / 2; cy = pr.top - hr.top + pr.height / 2; R = pr.width / 2;
    narrow = W < 861;   // below 861px the portrait sits small above the headline
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const radii = narrow ? [R + 20, R + 46, R + 76] : [R + 28, R + 72, R + 120];
    const speeds = narrow ? [0.05, -0.036, 0.026] : [0.034, -0.024, 0.017];   // radians a second, alternating
    const gap = narrow ? 30 : 56;                                            // node spacing along an orbit, px
    rings = radii.map((r, k) => ({ r, w: speeds[k], off: k * 0.41, n: Math.max(8, Math.round((TAU * r) / gap)), fade: [1, 0.82, 0.64][k] }));
    const s = canvas.style;   // the CSS mask softens the outer edge, centred on the portrait
    s.setProperty("--nx", cx + "px"); s.setProperty("--ny", cy + "px"); s.setProperty("--nr", radii[2] + (narrow ? 34 : 60) + "px");
    seed = 5; signals = [];
    return true;
  }
  function spawnSignal() {
    for (let tries = 0; tries < 12; tries++) {
      const k = Math.floor(rnd() * rings.length), th = rnd() * TAU;
      if (V(th, rings[k].r) < 0.7 || (k < rings.length - 1 && V(th, rings[k + 1].r) < 0.7)) continue;
      if (k < rings.length - 1 && rnd() < 0.3) {   // step outward to the next orbit
        signals.push({ hop: true, k, th, t: 0, dur: 1.1 });
      } else {                                      // travel a short way along the orbit
        const d = (0.35 + rnd() * 0.4) * (rnd() < 0.5 ? -1 : 1);
        signals.push({ hop: false, k, th, d, t: 0, dur: 2 + Math.abs(d) * 2.4 });
      }
      return;
    }
  }
  function step(dt) {
    time += dt; sigT += dt; pulseT += dt;
    if (sigT > 1.15 && signals.length < 4) { sigT = 0; spawnSignal(); }
    for (const s of signals) s.t += dt / s.dur;
    signals = signals.filter(s => s.t < 1);
  }
  function arcs(r, alpha) {   // a full circle drawn in short pieces so each piece can fade by angle
    const pieces = 144;
    for (let p = 0; p < pieces; p++) {
      const a0 = (p * TAU) / pieces, a1 = ((p + 1) * TAU) / pieces, v = V((a0 + a1) / 2, r);
      if (v < 0.02) continue;
      ctx.globalAlpha = alpha * v; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1 + 0.002); ctx.stroke();
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
    const ringA = dark ? 0.2 : 0.16, spokeA = dark ? 0.34 : 0.27, dotA = dark ? 0.8 : 0.62;
    // a soft pulse leaving the portrait every 7 seconds
    if (!reduce) {
      const p = (pulseT % 7) / 3.6;
      if (p < 1) arcs(R + 8 + p * (rings[2].r - R + 10), (dark ? 0.22 : 0.16) * (1 - p) * (1 - p));
    }
    for (const g of rings) arcs(g.r, ringA * g.fade);
    // spokes: a straight line out from a node to the next orbit, lit while a node there passes its end, so every
    // spoke points away from the portrait like the spokes of a wheel
    for (let k = 0; k < rings.length - 1; k++) {
      const A = rings[k], B = rings[k + 1], stepB = TAU / B.n, thr = stepB * 0.24;
      for (let i = 0; i < A.n; i++) {
        const ta = nodeAngle(A, i);
        let j = Math.round(wrapPi(ta - nodeAngle(B, 0)) / stepB); j = ((j % B.n) + B.n) % B.n;
        const tb = nodeAngle(B, j), d = Math.abs(wrapPi(ta - tb));
        if (d > thr) continue;
        const v = Math.min(V(ta, A.r), V(ta, B.r)) * smooth(thr, thr * 0.15, d) * Math.min(A.fade, B.fade);
        if (v < 0.02) continue;
        ctx.globalAlpha = spokeA * v; ctx.beginPath();
        const ux = Math.cos(ta), uy = Math.sin(ta);
        ctx.moveTo(cx + A.r * ux, cy + A.r * uy); ctx.lineTo(cx + B.r * ux, cy + B.r * uy); ctx.stroke();
      }
    }
    // nodes: evenly spaced, every fourth one on the middle orbit a little larger
    rings.forEach((g, k) => {
      for (let i = 0; i < g.n; i++) {
        const th = nodeAngle(g, i), v = V(th, g.r);
        if (v < 0.02) continue;
        const r = (k === 1 && i % 4 === 0 ? 2.5 : [1.9, 1.7, 1.5][k]) * (narrow ? 0.85 : 1);
        ctx.globalAlpha = dotA * v * g.fade; ctx.beginPath(); ctx.arc(cx + g.r * Math.cos(th), cy + g.r * Math.sin(th), r, 0, TAU); ctx.fill();
      }
    });
    // signals: a bright dot with a soft halo, easing in and out
    for (const s of signals) {
      const e = s.t * s.t * (3 - 2 * s.t), f = Math.sin(Math.PI * s.t);
      let th = s.th, r = rings[s.k].r;
      if (s.hop) r += (rings[s.k + 1].r - r) * e; else th = s.th + s.d * e;
      const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th), v = V(th, r) * f;
      ctx.globalAlpha = (dark ? 0.95 : 0.85) * v; ctx.beginPath(); ctx.arc(x, y, narrow ? 2 : 2.4, 0, TAU); ctx.fill();
      ctx.globalAlpha = (dark ? 0.28 : 0.2) * v; ctx.beginPath(); ctx.arc(x, y, narrow ? 5 : 6.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  readColor();
  if (build()) draw();
  // follow the theme toggle, which sets data-theme on <html>
  new MutationObserver(() => { readColor(); draw(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  let rt;
  const later = () => { clearTimeout(rt); rt = setTimeout(() => { if (build()) draw(); }, 80); };
  if ("ResizeObserver" in window) new ResizeObserver(later).observe(hero); else addEventListener("resize", later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  addEventListener("load", later);   // the portrait image can shift the layout once it loads
  if (reduce) return;   // reduced motion: the orbits stay still

  let visible = true, last = 0;
  if ("IntersectionObserver" in window) new IntersectionObserver(e => { visible = e[e.length - 1].isIntersecting; }).observe(hero);
  const frame = ts => {
    const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
    last = ts;
    if (visible && !document.hidden && W) { step(dt); draw(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
