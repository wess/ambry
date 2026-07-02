// Ambry site — small, dependency-free interactions.

// --- mobile nav -----------------------------------------------------------
const navToggle = document.querySelector("[data-nav]");
const navLinks = document.querySelector("[data-navlinks]");
if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
}

// --- copy buttons ---------------------------------------------------------
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.getAttribute("data-copy"));
      const prev = btn.textContent;
      btn.textContent = "copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("copied");
      }, 1400);
    } catch {
      /* clipboard unavailable */
    }
  });
});

// --- live demo grid: click a header to sort, like the app -----------------
const demo = document.querySelector("[data-demo]");
if (demo) {
  const table = demo.querySelector(".demogrid");
  const tbody = table.querySelector("tbody");
  const numeric = new Set(["id", "total"]);

  const renumber = () => {
    tbody.querySelectorAll("tr").forEach((tr, i) => {
      tr.querySelector("td.num").textContent = String(i + 1);
    });
  };

  const cellIndex = (key) =>
    [...table.querySelectorAll("thead th")].findIndex(
      (th) => th.getAttribute("data-sort") === key,
    );

  table.querySelectorAll("thead th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      const dir = th.getAttribute("data-dir") === "asc" ? "desc" : "asc";

      table.querySelectorAll("thead th").forEach((h) => {
        h.removeAttribute("data-dir");
        const c = h.querySelector(".caret");
        if (c) c.remove();
      });
      th.setAttribute("data-dir", dir);
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = dir === "asc" ? "↑" : "↓";
      th.appendChild(caret);

      const idx = cellIndex(key);
      const rows = [...tbody.querySelectorAll("tr")];
      rows.sort((a, b) => {
        let av = a.children[idx].textContent.trim();
        let bv = b.children[idx].textContent.trim();
        if (numeric.has(key)) {
          av = parseFloat(av) || 0;
          bv = parseFloat(bv) || 0;
          return dir === "asc" ? av - bv : bv - av;
        }
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      rows.forEach((r, i) => {
        r.style.animation = "none";
        tbody.appendChild(r);
        r.style.animationDelay = `${i * 20}ms`;
      });
      renumber();
    });
  });

  // stagger the initial stream-in
  tbody.querySelectorAll("tr").forEach((tr, i) => {
    tr.style.animationDelay = `${120 + i * 55}ms`;
  });
}

// --- docs: scrollspy + active sidebar link --------------------------------
const docNav = document.querySelector(".docnav");
if (docNav) {
  const links = [...docNav.querySelectorAll("a[href^='#']")];
  const map = new Map();
  links.forEach((a) => {
    const el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) map.set(el, a);
  });

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          const active = map.get(e.target);
          if (active) active.classList.add("active");
        }
      });
    },
    { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
  );
  map.forEach((_, el) => spy.observe(el));
}
