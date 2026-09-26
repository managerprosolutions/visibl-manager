/* ===========================================================
   VISIBL ERP — Loading UI global central
   API compatible :
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
    message: "Nous récupérons vos données, veuillez patienter quelques instants.",
    title: "Chargement des données…",
    icon: "✨",
    tip: "Préparation de vos données en cours."
  };

  let overlay = null;

  function q(selector, root) {
    return (root || document).querySelector(selector);
  }

  function getScope(options) {
    const selector = (options && options.scope) || DEFAULTS.scope;
    return q(selector) || document.body;
  }

  function getColumnCount(tbody) {
    if (!tbody) return 6;
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

  function inferFromMessage(message) {
    const m = String(message || "").toLowerCase();

    if (m.includes("client")) return {
      title: "Chargement des clients…",
      icon: "👥",
      tip: "Des données bien organisées pour une activité plus performante."
    };

    if (m.includes("livreur")) return {
      title: "Chargement des livreurs…",
      icon: "🚚",
      tip: "Vos livreurs et leurs performances sont en cours de synchronisation."
    };

    if (m.includes("commande")) return {
      title: "Chargement des commandes…",
      icon: "📦",
      tip: "Vos commandes sont en cours de préparation."
    };

    if (m.includes("vente")) return {
      title: "Chargement des ventes…",
      icon: "🛒",
      tip: "Vos données de vente sont en cours de synchronisation."
    };

    if (m.includes("produit")) return {
      title: "Chargement des produits…",
      icon: "🏷️",
      tip: "Votre catalogue produits est en cours de préparation."
    };

    if (m.includes("stock")) return {
      title: "Chargement du stock…",
      icon: "📚",
      tip: "Vos niveaux de stock sont en cours de calcul."
    };

    if (m.includes("facture")) return {
      title: "Chargement des factures…",
      icon: "🧾",
      tip: "Vos factures sont en cours de préparation."
    };

    if (m.includes("caisse")) return {
      title: "Chargement de la caisse…",
      icon: "💵",
      tip: "Vos mouvements de caisse sont en cours de calcul."
    };

    if (m.includes("paiement")) return {
      title: "Chargement des paiements…",
      icon: "💳",
      tip: "Vos paiements sont en cours de préparation."
    };

    if (m.includes("rapport")) return {
      title: "Chargement des rapports…",
      icon: "📈",
      tip: "Vos indicateurs sont en cours de génération."
    };

    return {};
  }

  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return overlay;

    overlay = document.createElement("div");
    overlay.id = "visibl-central-loader";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div class="vl-card" role="status" aria-live="polite" aria-busy="true">
        <span class="vl-glow vl-glow-a"></span>
        <span class="vl-glow vl-glow-b"></span>

        <div class="vl-brand">
          <span class="vl-bars" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span>
            <span class="vl-brand-main">VISIBL</span>
            <span class="vl-brand-sub">ERP</span>
          </span>
        </div>

        <div class="vl-orbit-wrap" aria-hidden="true">
          <div class="vl-orbit"></div>
          <div class="vl-ring"></div>
          <div class="vl-icon-box">
            <span class="vl-icon">✨</span>
          </div>
        </div>

        <h2 class="vl-title">Chargement des données…</h2>
        <p class="vl-message">
          Nous récupérons vos données, veuillez patienter quelques instants.
        </p>

        <div class="vl-progress" aria-hidden="true"></div>

        <div class="vl-dots" aria-hidden="true">
          <i></i><i></i><i></i>
        </div>

        <div class="vl-tip">
          <span class="vl-tip-icon" aria-hidden="true">💡</span>
          <span class="vl-tip-text">Préparation de vos données en cours.</span>
        </div>

        <div class="vl-footer">
          <strong>VISIBL ERP</strong>
          <span>SIMPLE · EFFICACE · POUR VOUS</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function start(options) {
    options = Object.assign({}, DEFAULTS, options || {});

    const scope = getScope(options);
    const inferred = inferFromMessage(options.message);
    const central = ensureOverlay();

    scope.classList.add("visibl-loading-scope");
    scope.classList.add("is-loading");
    scope.setAttribute("aria-busy", "true");

    const tbody = q(options.tableBody, scope);
    if (tbody) buildSkeletonRows(tbody, options.rows);

    const title = central.querySelector(".vl-title");
    const message = central.querySelector(".vl-message");
    const icon = central.querySelector(".vl-icon");
    const tip = central.querySelector(".vl-tip-text");

    if (title) {
      title.textContent =
        options.title !== DEFAULTS.title
          ? options.title
          : (inferred.title || options.title);
    }

    if (message) {
      const raw = String(options.message || "");
      message.textContent =
        raw && !/^chargement\b/i.test(raw)
          ? raw
          : DEFAULTS.message;
    }

    if (icon) {
      icon.textContent =
        options.icon !== DEFAULTS.icon
          ? options.icon
          : (inferred.icon || options.icon);
    }

    if (tip) {
      tip.textContent =
        options.tip !== DEFAULTS.tip
          ? options.tip
          : (inferred.tip || options.tip);
    }

    central.classList.add("is-visible");
    central.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

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

        if (overlay) {
          overlay.classList.remove("is-visible");
          overlay.setAttribute("aria-hidden", "true");
        }

        document.body.style.overflow = "";
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
