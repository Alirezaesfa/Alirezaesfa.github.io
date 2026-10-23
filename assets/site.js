// Theme toggle: light by default; dark only when the visitor picks it.
(() => {
  const root = document.documentElement, btn = document.querySelector(".theme-btn");
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  const isDark = () => root.dataset.theme === "dark";
  function paint() {
    if (btn) btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
    if (root.dataset.theme) {
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      metas.forEach(m => m.setAttribute("content", bg));
    }
    if (typeof SIMKIT !== "undefined") SIMKIT.refresh();   // const globals are not window properties
  }
  if (btn) btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) { /* storage blocked: the choice lasts for this page only */ }
    paint();
  });
  const onSystem = () => { if (!root.dataset.theme) paint(); };
  if (mq.addEventListener) mq.addEventListener("change", onSystem); else if (mq.addListener) mq.addListener(onSystem);
  paint();
})();

// Mobile menu: below 760px the section links open as a drop-down under the header.
(() => {
  const header = document.querySelector(".nav"), btn = document.querySelector(".menu-btn");
  if (!header || !btn) return;
  const set = open => {
    header.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  btn.addEventListener("click", () => set(!header.classList.contains("open")));
  header.querySelectorAll("nav a").forEach(a => a.addEventListener("click", () => set(false)));
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && header.classList.contains("open")) { set(false); btn.focus(); } });
  document.addEventListener("click", ev => { if (header.classList.contains("open") && !header.contains(ev.target)) set(false); });
  matchMedia("(min-width: 761px)").addEventListener?.("change", ev => { if (ev.matches) set(false); });
})();

// Home page: underline the nav link for the section on screen.
// The current section is the last one whose top has passed 45% of the viewport;
// at the very bottom it is the last section, which can be too short to get there.
(() => {
  const links = new Map();
  document.querySelectorAll('.nav ul a[href*="#"]').forEach(a => links.set(a.hash.slice(1), a));
  const sections = [...links.keys()].map(id => document.getElementById(id)).filter(Boolean);
  if (!sections.length) return;
  let queued = false;
  const paint = () => {
    queued = false;
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    let current = atBottom ? sections[sections.length - 1] : null;
    if (!current) for (const s of sections) if (s.getBoundingClientRect().top <= innerHeight * 0.45) current = s;
    links.forEach((a, id) => { if (current && id === current.id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  paint();
})();

// Gentle fade-up for content that starts below the fold. Skipped for reduced motion,
// and the classes come off once the fade ends so hover effects work as before.
(() => {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = [...document.querySelectorAll(".fact, .group-head, .pcard, .sec-head, .about > *, .skills, .contact, .content, .cta-strip, .pager")]
    .filter(el => el.getBoundingClientRect().top > innerHeight * 0.92);
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      el.classList.add("in");
      const done = () => { el.classList.remove("reveal", "in"); el.style.transitionDelay = ""; };
      el.addEventListener("transitionend", done, { once: true });
      setTimeout(done, 1400);   // in case transitionend never fires
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
  targets.forEach(el => {
    const sibs = el.parentElement ? [...el.parentElement.children] : [];
    if (el.classList.contains("pcard") || el.classList.contains("fact")) el.style.transitionDelay = (sibs.indexOf(el) % 3) * 70 + "ms";
    el.classList.add("reveal");
    io.observe(el);
  });
})();
