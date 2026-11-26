/* La navigation et l’en-tête proviennent du module Clients. */
(() => {
    const sidebarHost = document.querySelector("[data-visibl-sidebar-slot]");
    const headerHost = document.querySelector("[data-visibl-header-slot]");
    if (!sidebarHost || !headerHost) return;

    const template = document.createElement("template");
    template.innerHTML = `
<aside id="sidebar" class="sidebar" data-visibl-sidebar>

        <button id="sidebar-close" class="sidebar-close">
            ✖
        </button>

        <a href="dashboard.html" class="logo">
            <img src="../logo-vizibl.png" alt="Logo">
        </a>

        <nav aria-label="Navigation principale">
            <ul>

                <li>
                    <a href="dashboard.html" class="nav-link">
                        📊 Tableau de bord
                    </a>
                </li>

                <li class="menu-category">

                    <a href="#" class="nav-link category-title">
                        <span>🛒 Commercial</span>
                        <span class="arrow">▼</span>
                    </a>

                    <ul class="submenu">

                        <li>
                            <a href="ventes.html" class="nav-link">
                                Ventes
                            </a>
                        </li>

                        <li>
                            <a href="commandes.html" class="nav-link">
                                Commandes
                            </a>
                        </li>

                        <li>
                            <a href="clients.html" class="nav-link">
                                Clients
                            </a>
                        </li>

                        <li>
                            <a href="livraisons.html" class="nav-link">
                                Livraisons
                            </a>
                        </li>

                        <li>
                            <a href="livreurs.html" class="nav-link">
                                Livreurs
                            </a>
                        </li>

                    </ul>

                </li>

                <li class="menu-category">

                    <a href="#" class="nav-link category-title">
                        <span>📦 Stock & Approvisionnement</span>
                        <span class="arrow">▼</span>
                    </a>

                    <ul class="submenu">

                        <li>
                            <a href="produits.html" class="nav-link">
                                Produits
                            </a>
                        </li>

                        <li>
                            <a href="stock.html" class="nav-link">
                                Stock
                            </a>
                        </li>
                        <li><a href="mouvement_stock.html" class="nav-link">Mouvements de stock</a></li>

                        <li>
                            <a href="approvisionnements.html" class="nav-link">
                                Approvisionnements
                            </a>
                        </li>

                        <li>
                            <a href="fournisseurs.html" class="nav-link">
                                Fournisseurs
                            </a>
                        </li>

                        <li>
                            <a href="transitaires.html" class="nav-link">
                                Transitaires
                            </a>
                        </li>

                    </ul>

                </li>

                <li class="menu-category">

                    <a href="#" class="nav-link category-title">
                        <span>💰 Finance</span>
                        <span class="arrow">▼</span>
                    </a>

                    <ul class="submenu">

                        <li>
                            <a href="caisse.html" class="nav-link">
                                Caisse
                            </a>
                        </li>

                        <li>
                            <a href="paiements.html" class="nav-link">
                                Paiements
                            </a>
                        </li>

                        <li>
                            <a href="factures.html" class="nav-link">
                                Factures
                            </a>
                        </li>

                        <li>
                            <a href="comptabilité.html" class="nav-link">
                                Comptabilité
                            </a>
                        </li>

                    </ul>

                </li>

                <li>
                    <a href="rapports.html" class="nav-link">
                        📈 Rapports
                    </a>
                </li>

                <li>
                    <a href="paramètres.html" class="nav-link">
                        ⚙️ Paramètres
                    </a>
                </li>

            </ul>
        </nav>

    </aside>
`;
    sidebarHost.replaceWith(template.content);

    template.innerHTML = `
<header class="header visibl-header" data-visibl-header>
            <div class="header-left visibl-header-left">
                <a href="dashboard.html" class="visibl-header-brand" aria-label="Accueil VISIBL">
                    <img src="../logo-vizibl.png" alt="VISIBL">
                </a>
                <span class="visibl-header-separator" aria-hidden="true"></span>
                <h2 class="visibl-header-page-title">Clients</h2>
            </div>

            <div class="header-right visibl-header-right">
                <div class="search-box visibl-search" data-header-panel="search">
                    <button class="visibl-header-btn visibl-mobile-search-btn" id="mobile-search-btn" type="button" aria-label="Rechercher" aria-expanded="false">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                    <div class="search-container visibl-search-container">
                        <i class="fa-solid fa-magnifying-glass visibl-search-icon" aria-hidden="true"></i>
                        <input type="text" class="search-input visibl-search-input" placeholder="Rechercher un client..." autocomplete="off">
                        <button class="search-btn visibl-search-submit" type="button" aria-label="Lancer la recherche">
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>

                <div class="header-icons visibl-header-actions">
                    <div class="notification-menu visibl-header-menu" data-header-panel="notifications">
                        <button id="notification-button" class="visibl-header-btn visibl-notification-btn notifications" type="button" aria-label="Afficher les notifications" aria-expanded="false">
                            <span class="visibl-action-icon visibl-action-icon-notification" aria-hidden="true">
                                <i class="fa-regular fa-bell"></i>
                            </span>
                            <span class="notification-badge" hidden>0</span>
                        </button>
                        <div id="notification-panel" class="notification-panel visibl-header-dropdown visibl-notification-panel" hidden>
                            <div class="notification-panel-header">
                                <div>
                                    <span class="visibl-dropdown-kicker">Centre d’activité</span>
                                    <h3>Notifications</h3>
                                </div>
                                <span class="visibl-live-dot" aria-hidden="true"></span>
                            </div>
                            <div class="notification-empty-state">
                                <span class="visibl-empty-icon" aria-hidden="true"><i class="fa-regular fa-bell"></i></span>
                                <p>Aucune notification pour le moment.</p>
                            </div>
                        </div>
                    </div>

                    <div class="visibl-profile-menu visibl-header-menu" data-header-panel="profile">
                        <button id="profile-button" class="visibl-header-btn visibl-profile-btn" type="button" aria-label="Ouvrir le profil" aria-expanded="false">
                            <span class="visibl-action-icon visibl-action-icon-profile" aria-hidden="true">
                                <i class="fa-solid fa-user"></i>
                            </span>
                        </button>
                        <div id="profile-panel" class="visibl-header-dropdown visibl-profile-panel" hidden>
                            <div class="visibl-profile-heading">
                                <span class="visibl-profile-avatar"><i class="fa-regular fa-user"></i></span>
                                <div><strong>Mon profil</strong><small>Compte VISIBL</small></div>
                            </div>
                            <a href="moncompte.html"><i class="fa-regular fa-user"></i><span>Mon compte</span></a>
                            <hr>
                            <a href="#" class="logout" id="logout-button"><i class="fa-solid fa-arrow-right-from-bracket"></i><span>Déconnexion</span></a>
                        </div>
                    </div>
                </div>
            </div>
        </header>
`;
    const header = template.content.firstElementChild;
    const title = header.querySelector(".visibl-header-page-title");
    title.textContent = headerHost.dataset.title;
    title.title = title.textContent;
    const search = header.querySelector(".visibl-search-input");
    if (headerHost.dataset.search) {
        search.placeholder = headerHost.dataset.search;
        search.setAttribute("aria-label", "Rechercher dans " + headerHost.dataset.title);
        if (headerHost.dataset.searchId) search.id = headerHost.dataset.searchId;
        if (headerHost.dataset.searchButton) header.querySelector(".search-btn").id = headerHost.dataset.searchButton;
    } else {
        search.closest("[data-header-panel=search]").remove();
    }
    headerHost.replaceWith(header);
    document.documentElement.classList.add("visibl-clients-layout");
})();
