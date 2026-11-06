// Home page hero: three faint orbits around the portrait, each with evenly spaced dots, turning slowly in
// alternating directions. Every few seconds a pulse leaves the portrait: a soft ring travels outward, short lines
// carry it from one orbit to the next, and each orbit's dots light up as it arrives, inner to outer; then everything
// settles until the next beat. Decorative only (aria-hidden). It fades out on the headline side so the text stays
// clean. Still for reduced motion; paused off screen or in a hidden tab.
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
  const BEAT = 5.5, FIRST = 0.8, EASE = 1.6;   // seconds between pulses, delay before the first one, how fast it slows
  let W = 0, H = 0, cx = 0, cy = 0, R = 0, narrow = false, rings = [];
  let color = "#1a63d6", dark = false, time = 0;
  const pulse = { r0: 0, r1: 0, dur: 2.6, out: 34, dash: 14 };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // how visible a point at angle th is: wide screens fade the side facing the headline (left) and the very bottom,
  // above the facts; phones, where the portrait sits above the headline, fade the lower half
  const vis = th => {
    const c = Math.cos(th), s = Math.sin(th);
    return narrow ? smooth(0.45, -0.1, s) * smooth(-0.7, -0.15, c) : smooth(-0.62, -0.15, c) * smooth(0.97, 0.72, s);
  };
  // ...and the top edge of the hero, so the outer orbit never runs hard into the header
  const V = (th, r) => vis(th) * smooth(0, 40, cy + r * Math.sin(th));
  const dotAngle = (g, i) => g.off + g.w * time + (i * TAU) / g.n;
  // the pulse front: fast as it leaves the portrait, slowing as it reaches the outer orbit
  const frontAt = t => pulse.r0 + (pulse.r1 - pulse.r0) * (1 - Math.pow(1 - Math.min(1, t / pulse.dur), EASE));
  const hitTime = r => pulse.dur * (1 - Math.pow(1 - (r - pulse.r0) / (pulse.r1 - pulse.r0), 1 / EASE));

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
    const gap = narrow ? 30 : 56;                                            // dot spacing along an orbit, px
    rings = radii.map((r, k) => ({ r, w: speeds[k], off: k * 0.41, n: Math.max(8, Math.round((TAU * r) / gap)), fade: [1, 0.82, 0.64][k] }));
    pulse.r0 = R + (narrow ? 5 : 8); pulse.out = narrow ? 20 : 34; pulse.dash = narrow ? 9 : 14;
    pulse.r1 = radii[2] + pulse.out + 6; pulse.dur = narrow ? 2.2 : 2.6;
    rings.forEach(g => { g.hit = hitTime(g.r); });
    const s = canvas.style;   // the CSS mask softens the outer edge, centred on the portrait
    s.setProperty("--nx", cx + "px"); s.setProperty("--ny", cy + "px"); s.setProperty("--nr", radii[2] + (narrow ? 34 : 60) + "px");
    return true;
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
    const ringA = dark ? 0.2 : 0.16, dotA = dark ? 0.72 : 0.52, lineA = dark ? 0.55 : 0.42, headA = dark ? 0.95 : 0.8;
    const since = time - FIRST, t = since < 0 ? -1 : since % BEAT;   // seconds into the current beat
    const moving = t >= 0 && t <= pulse.dur, f = moving ? frontAt(t) : 0;
    // how lit each orbit is: a quick rise as the pulse arrives, then a slow fade
    const lit = rings.map(g => { const a = t - g.hit; return t < 0 || a < 0 ? 0 : smooth(0, 0.12, a) * (1 - smooth(0.15, 1.5, a)); });

    if (moving) arcs(f, (dark ? 0.16 : 0.12) * Math.pow(1 - t / pulse.dur, 1.4));   // the soft ring of the pulse
    rings.forEach((g, k) => arcs(g.r, ringA * g.fade * (1 + 0.8 * lit[k])));

    // short lines riding the pulse: portrait to the first orbit, orbit to orbit (each one lands on a dot), and out
    // past the last orbit from its dots, fading as they go
    if (moving) {
      for (let s = 0; s < 4; s++) {
        const from = s === 0 ? pulse.r0 : rings[s - 1].r, to = s < 3 ? rings[s].r : rings[2].r + pulse.out;
        if (f <= from) continue;
        const head = Math.min(f, to), tail = Math.min(Math.max(from, f - pulse.dash), to);
        if (head - tail < 0.5) continue;
        const g = rings[Math.min(s, 2)];
        let a = smooth(from, from + 6, f) * g.fade;
        if (s === 3) a *= 1 - smooth(from, to, f);
        for (let i = 0; i < g.n; i++) {
          const th = dotAngle(g, i), v = V(th, head) * a;
          if (v < 0.02) continue;
          const ux = Math.cos(th), uy = Math.sin(th);
          ctx.globalAlpha = lineA * v; ctx.beginPath(); ctx.moveTo(cx + tail * ux, cy + tail * uy); ctx.lineTo(cx + head * ux, cy + head * uy); ctx.stroke();
          if (f < to) { ctx.globalAlpha = headA * v; ctx.beginPath(); ctx.arc(cx + head * ux, cy + head * uy, narrow ? 1.2 : 1.5, 0, TAU); ctx.fill(); }
        }
      }
    }

    // dots: evenly spaced (every fourth one on the middle orbit a little larger); they light up as the pulse arrives
    rings.forEach((g, k) => {
      const b = lit[k];
      for (let i = 0; i < g.n; i++) {
        const th = dotAngle(g, i), v = V(th, g.r) * g.fade;
        if (v < 0.02) continue;
        const r = (k === 1 && i % 4 === 0 ? 2.5 : [1.9, 1.7, 1.5][k]) * (narrow ? 0.85 : 1) * (1 + 0.6 * b);
        const x = cx + g.r * Math.cos(th), y = cy + g.r * Math.sin(th);
        if (b > 0.02) { ctx.globalAlpha = (dark ? 0.26 : 0.18) * b * v; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = Math.min(1, dotA * (1 + 0.7 * b)) * v; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    });
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
  if (reduce) return;   // reduced motion: the orbits stay still and no pulses run

  let visible = true, last = 0;
  if ("IntersectionObserver" in window) new IntersectionObserver(e => { visible = e[e.length - 1].isIntersecting; }).observe(hero);
  const frame = ts => {
    const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
    last = ts;
    if (visible && !document.hidden && W) { time += dt; draw(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
