/* ===========================================================
   VISIBL ERP — Loader global central
   API:
     VisiblModuleLoader.start({ module, title, message, icon, tip })
     VisiblModuleLoader.stop()
     VisiblModuleLoader.isVisible()
=========================================================== */

(function (window, document) {
  "use strict";

  const MODULES = {
    dashboard: {
      label: "tableau de bord",
      icon: "📊",
      tip: "Vos indicateurs sont en cours de préparation."
    },
    ventes: {
      label: "ventes",
      icon: "🛒",
      tip: "Vos données de vente sont en cours de synchronisation."
    },
    commandes: {
      label: "commandes",
      icon: "📦",
      tip: "Vos commandes sont en cours de préparation."
    },
    clients: {
      label: "clients",
      icon: "👥",
      tip: "Des données bien organisées pour une activité plus performante."
    },
    livraisons: {
      label: "livraisons",
      icon: "🚚",
      tip: "Vos opérations de livraison sont en cours de préparation."
    },
    livreurs: {
      label: "livreurs",
      icon: "🛵",
      tip: "Les informations de vos livreurs sont en cours de synchronisation."
    },
    produits: {
      label: "produits",
      icon: "🏷️",
      tip: "Votre catalogue produits est en cours de préparation."
    },
    stock: {
      label: "stocks",
      icon: "📚",
      tip: "Vos niveaux de stock et mouvements sont en cours de calcul."
    },
    approvisionnements: {
      label: "approvisionnements",
      icon: "📥",
      tip: "Vos approvisionnements sont en cours de préparation."
    },
    fournisseurs: {
      label: "fournisseurs",
      icon: "🏭",
      tip: "Votre base fournisseurs est en cours de synchronisation."
    },
    transitaires: {
      label: "transitaires",
      icon: "🚢",
      tip: "Les données de transit sont en cours de préparation."
    },
    caisse: {
      label: "caisse",
      icon: "💵",
      tip: "Vos mouvements de caisse sont en cours de calcul."
    },
    paiements: {
      label: "paiements",
      icon: "💳",
      tip: "Vos paiements sont en cours de préparation."
    },
    factures: {
      label: "factures",
      icon: "🧾",
      tip: "Vos factures sont en cours de préparation."
    },
    comptabilite: {
      label: "comptabilité",
      icon: "🧮",
      tip: "Vos données comptables sont en cours de préparation."
    },
    rapports: {
      label: "rapports",
      icon: "📈",
      tip: "Vos indicateurs et rapports sont en cours de génération."
    },
    parametres: {
      label: "paramètres",
      icon: "⚙️",
      tip: "Vos préférences sont en cours de chargement."
    }
  };

  let overlay = null;
  let visible = false;

  function normaliserModule(module) {
    return String(module || "données")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function obtenirConfig(module) {
    const cle = normaliserModule(module);
    return MODULES[cle] || {
      label: module || "données",
      icon: "✨",
      tip: "Préparation de vos données en cours."
    };
  }

  function creerOverlay() {
    if (overlay && document.body.contains(overlay)) return overlay;

    overlay = document.createElement("div");
    overlay.id = "visibl-global-loader";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div class="visibl-loader-card" role="status" aria-live="polite" aria-busy="true">
        <span class="visibl-loader-glow one"></span>
        <span class="visibl-loader-glow two"></span>

        <div class="visibl-loader-brand" aria-label="VISIBL ERP">
          <span class="visibl-loader-logo-bars" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span>
            <span class="visibl-loader-brand-name">VISIBL</span>
            <span class="visibl-loader-brand-sub">ERP</span>
          </span>
        </div>

        <div class="visibl-loader-orbit-wrap" aria-hidden="true">
          <div class="visibl-loader-orbit"></div>
          <div class="visibl-loader-ring"></div>
          <div class="visibl-loader-icon-box">
            <span class="visibl-loader-icon">✨</span>
          </div>
        </div>

        <h2 class="visibl-loader-title">Chargement des données...</h2>
        <p class="visibl-loader-message">
          Nous récupérons vos données, veuillez patienter quelques instants.
        </p>

        <div class="visibl-loader-progress" aria-hidden="true"></div>

        <div class="visibl-loader-dots" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>

        <div class="visibl-loader-tip">
          <span class="visibl-loader-tip-icon" aria-hidden="true">💡</span>
          <span class="visibl-loader-tip-text">
            Préparation de vos données en cours.
          </span>
        </div>

        <div class="visibl-loader-footer">
          <strong>VISIBL ERP</strong>
          <span>SIMPLE · EFFICACE · POUR VOUS</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function start(options = {}) {
    const module = options.module || "données";
    const config = obtenirConfig(module);
    const element = creerOverlay();

    const icon = element.querySelector(".visibl-loader-icon");
    const title = element.querySelector(".visibl-loader-title");
    const message = element.querySelector(".visibl-loader-message");
    const tip = element.querySelector(".visibl-loader-tip-text");

    const label = options.label || config.label;

    if (icon) icon.textContent = options.icon || config.icon || "✨";

    if (title) {
      title.textContent =
        options.title ||
        `Chargement ${String(label).startsWith("de ") ? "" : "des "}${label}...`
          .replace("des tableau", "du tableau")
          .replace("des caisse", "de la caisse")
          .replace("des comptabilité", "de la comptabilité");
    }

    if (message) {
      message.textContent =
        options.message ||
        "Nous récupérons vos données, veuillez patienter quelques instants.";
    }

    if (tip) {
      tip.textContent =
        options.tip ||
        config.tip ||
        "Préparation de vos données en cours.";
    }

    visible = true;
    element.classList.add("is-visible");
    element.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("visibl-loader-open");
    document.body.style.overflow = "hidden";
  }

  function stop() {
    if (!overlay) return;

    visible = false;
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("visibl-loader-open");
    document.body.style.overflow = "";
  }

  function isVisible() {
    return visible;
  }

  window.VisiblModuleLoader = {
    start,
    stop,
    isVisible,
    modules: MODULES
  };
})(window, document);
