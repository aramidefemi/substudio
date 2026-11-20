(() => {
  "use strict";

  const data = window.SUBSTUDIO_DOCS;
  if (!data) return;

  const article = document.querySelector("#article");
  const sidebar = document.querySelector("#sidebar");
  const breadcrumb = document.querySelector("#breadcrumb");
  const toc = document.querySelector("#toc");
  const pageNav = document.querySelector("#page-nav");
  const search = document.querySelector("#search-input");
  const searchPanel = document.querySelector("#search-panel");
  const searchStatus = document.querySelector("#search-status");
  const searchResults = document.querySelector("#search-results");
  const menuButton = document.querySelector("#menu-toggle");
  const scrim = document.querySelector("#sidebar-scrim");
  const themeButton = document.querySelector("#theme-toggle");

  const ordered = data.nav.flatMap((section) => section.pages);
  const bySlug = new Map(ordered.map((item) => [item.slug, { ...item, page: data.pages[item.slug] }]));
  let currentRoute = null;

  function route() {
    const raw = new URLSearchParams(window.location.search).get("page") || "overview";
    return bySlug.has(raw) ? raw : "overview";
  }

  function url(slug) {
    return slug === "overview" ? "./" : `?page=${encodeURIComponent(slug)}`;
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  function renderSidebar(active) {
    sidebar.innerHTML = data.nav
      .map((section) => {
        const containsActive = section.pages.some((page) => page.slug === active);
        const links = section.pages
          .map(
            (page) =>
              `<li><a href="${url(page.slug)}"${page.slug === active ? ' aria-current="page"' : ""}>${page.title}</a></li>`,
          )
          .join("");
        return `<details${containsActive || section.open ? " open" : ""}><summary>${section.title}</summary><ul>${links}</ul></details>`;
      })
      .join("");
  }

  function renderToc() {
    const headings = [...article.querySelectorAll("h2, h3")];
    const used = new Set();
    headings.forEach((heading) => {
      let id = heading.id || slugify(heading.textContent);
      const base = id || "section";
      let suffix = 2;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      heading.id = id;
      const anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = `#${id}`;
      anchor.setAttribute("aria-label", `Link to ${heading.textContent}`);
      anchor.textContent = "#";
      heading.append(anchor);
    });
    toc.innerHTML = headings
      .map(
        (heading) =>
          `<a class="${heading.tagName === "H3" ? "sub" : ""}" href="#${heading.id}">${heading.childNodes[0].textContent}</a>`,
      )
      .join("");
    toc.parentElement.hidden = headings.length === 0;
  }

  function renderPage() {
    const slug = route();
    const item = bySlug.get(slug);
    if (!item?.page) return;
    currentRoute = slug;

    document.title = `${item.title} · Substudio Docs`;
    document.querySelector('meta[name="description"]').content = item.page.description;
    article.innerHTML = `<h1>${item.title}</h1><p class="lede">${item.page.description}</p>${item.page.html}`;
    breadcrumb.innerHTML = `<a href="./">Docs</a> <span aria-hidden="true">/</span> ${item.section}`;
    renderSidebar(slug);
    renderToc();

    const index = ordered.findIndex((page) => page.slug === slug);
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    pageNav.innerHTML = [
      previous
        ? `<a href="${url(previous.slug)}"><span>Previous</span><strong>← ${previous.title}</strong></a>`
        : "<span></span>",
      next ? `<a href="${url(next.slug)}"><span>Next</span><strong>${next.title} →</strong></a>` : "",
    ].join("");

    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function plainText(html) {
    const element = document.createElement("div");
    element.innerHTML = html;
    return element.textContent.replace(/\s+/g, " ").trim();
  }

  const searchable = ordered.map((item) => {
    const page = data.pages[item.slug];
    return {
      ...item,
      description: page.description,
      text: `${item.title} ${item.section} ${page.description} ${page.keywords || ""} ${plainText(page.html)}`.toLowerCase(),
    };
  });

  function searchDocs(query) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return searchable
      .map((item) => {
        const title = item.title.toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (!item.text.includes(term)) return null;
          if (title === term) score += 12;
          else if (title.includes(term)) score += 6;
          if (item.description.toLowerCase().includes(term)) score += 3;
          score += Math.min(3, item.text.split(term).length - 1);
        }
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((result) => result.item);
  }

  function updateSearch() {
    const query = search.value.trim();
    if (!query) {
      searchPanel.hidden = true;
      return;
    }
    const results = searchDocs(query);
    searchStatus.textContent = results.length
      ? `${results.length} result${results.length === 1 ? "" : "s"}`
      : "No matching pages";
    searchResults.innerHTML = results
      .map(
        (item) =>
          `<li><a href="${url(item.slug)}"><strong>${item.title}</strong><span>${item.description}</span></a></li>`,
      )
      .join("");
    searchPanel.hidden = false;
  }

  function closeSearch() {
    searchPanel.hidden = true;
    search.value = "";
  }

  search.addEventListener("input", updateSearch);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearch();
      search.blur();
    }
    if (event.key === "Enter") {
      const first = searchResults.querySelector("a");
      if (first) first.click();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".docs-search")) searchPanel.hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      search.focus();
      updateSearch();
    }
    if (event.key === "Escape" && document.body.classList.contains("menu-open")) {
      document.body.classList.remove("menu-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });

  function toggleMenu() {
    const open = document.body.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(open));
  }

  menuButton.addEventListener("click", toggleMenu);
  scrim.addEventListener("click", toggleMenu);

  themeButton.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = current ? (current === "dark" ? "light" : "dark") : systemDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("substudio-docs-theme", next);
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="?page="], a[href="./"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, "", link.href);
    closeSearch();
    renderPage();
  });

  window.addEventListener("popstate", () => {
    if (route() !== currentRoute) renderPage();
  });
  renderPage();
})();
