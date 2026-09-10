/* ===========================================================
   VISIBL ERP — Loading UI global
   API :
     VisiblLoading.start(options)
     VisiblLoading.stop(options)
     VisiblLoading.wrap(promise, options)
=========================================================== */

(function (window, document) {
  "use strict";

  const DEFAULTS = {
    scope: "[data-visibl-page]",
    tableBody: "[data-loading-table-body]",
    rows: 6,
    message: "Chargement des données…"
  };

  function q(selector, root) {
    return (root || document).querySelector(selector);
  }

  function getScope(options) {
    const selector = (options && options.scope) || DEFAULTS.scope;
    return q(selector) || document.body;
  }

  function ensureLoader(scope, message) {
    let loader = q(".visibl-page-loader", scope);

    if (!loader) {
      loader = document.createElement("div");
      loader.className = "visibl-page-loader";
      loader.setAttribute("aria-live", "polite");
      loader.innerHTML = `
        <span class="visibl-loader-equipment" aria-hidden="true">
          <span class="visibl-gear" title="Caméra">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="7" width="13" height="10" rx="2"></rect>
              <circle cx="9.5" cy="12" r="3"></circle>
              <path d="M16 10l4-2v8l-4-2z"></path>
            </svg>
          </span>
          <span class="visibl-gear" title="Ring light">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="5"></circle>
              <path d="M12 13v7M9 20h6"></path>
            </svg>
          </span>
          <span class="visibl-gear" title="Trépied">
            <svg viewBox="0 0 24 24">
              <rect x="8" y="4" width="8" height="5" rx="1.5"></rect>
              <path d="M12 9v3M12 12l-5 8M12 12l5 8M12 12v8"></path>
            </svg>
          </span>
          <span class="visibl-gear" title="Panneau LED">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="4" width="14" height="10" rx="2"></rect>
              <path d="M7 7h1M11 7h1M15 7h1M7 11h1M11 11h1M15 11h1M11 14v6M8 20h6"></path>
            </svg>
          </span>
        </span>
        <span class="visibl-loader-dots" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <span class="visibl-loader-message"></span>
      `;

      const anchor = q("[data-loading-anchor]", scope) || scope.firstElementChild;

      if (anchor && anchor.parentNode === scope) {
        scope.insertBefore(loader, anchor.nextSibling);
      } else {
        scope.insertBefore(loader, scope.firstChild);
      }
    }

    const text = q(".visibl-loader-message", loader);
    if (text) text.textContent = message || DEFAULTS.message;

    return loader;
  }

  function getColumnCount(tbody) {
    const table = tbody.closest("table");
    const headerCells = table ? table.querySelectorAll("thead th") : [];

    if (headerCells.length) return headerCells.length;

    const firstRow = tbody.querySelector("tr");
    return firstRow ? firstRow.children.length : 6;
  }

  function buildSkeletonRows(tbody, rowCount) {
    if (!tbody) return;

    const cols = getColumnCount(tbody);
    tbody.innerHTML = "";

    for (let r = 0; r < rowCount; r++) {
      const tr = document.createElement("tr");
      tr.className = "visibl-skeleton-row";

      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        const bar = document.createElement("span");
        bar.className = "visibl-skeleton-cell";
        td.appendChild(bar);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
  }

  function clearSkeletonRows(tbody) {
    if (!tbody) return;
    tbody.querySelectorAll(".visibl-skeleton-row").forEach(row => row.remove());
  }

  function start(options) {
    options = Object.assign({}, DEFAULTS, options || {});
    const scope = getScope(options);

    scope.classList.add("visibl-loading-scope");
    scope.classList.remove("is-ready");
    scope.classList.add("is-loading");
    scope.setAttribute("aria-busy", "true");

    ensureLoader(scope, options.message);

    const tbody = q(options.tableBody, scope);
    if (tbody) buildSkeletonRows(tbody, options.rows);

    return scope;
  }

  function stop(options) {
    options = Object.assign({}, DEFAULTS, options || {});
    const scope = getScope(options);
    const tbody = q(options.tableBody, scope);

    clearSkeletonRows(tbody);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scope.classList.remove("is-loading");
        scope.classList.add("is-ready");
        scope.setAttribute("aria-busy", "false");
      });
    });
  }

  async function wrap(promiseOrFactory, options) {
    start(options);

    try {
      if (typeof promiseOrFactory === "function") {
        return await promiseOrFactory();
      }

      return await promiseOrFactory;
    } finally {
      stop(options);
    }
  }

  window.VisiblLoading = { start, stop, wrap };

})(window, document);
