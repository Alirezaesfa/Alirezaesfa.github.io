// Theme toggle: light by default, dark when the device prefers it, or whichever the visitor picks.
(() => {
  const root = document.documentElement, btn = document.querySelector(".theme-btn");
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : mq.matches);
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
