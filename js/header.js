/* ==========================================================
   VISIBL — HEADER GLOBAL V2
   - Recherche / notifications / profil exclusifs
   - Profil robuste face aux anciens styles globaux
   - Icônes contextuelles pour les notifications dynamiques
========================================================== */
(function () {
    "use strict";

    function initVisiblHeader() {
        const header = document.querySelector("[data-visibl-header]");
        if (!header || header.dataset.headerReady === "true") return;
        header.dataset.headerReady = "true";

        const searchBox = header.querySelector('[data-header-panel="search"]');
        const searchToggle = header.querySelector("#mobile-search-btn");
        const searchContainer = header.querySelector(".visibl-search-container");
        const searchInput = header.querySelector(".visibl-search-input");

        const notificationMenu = header.querySelector('[data-header-panel="notifications"]');
        const notificationButton = header.querySelector("#notification-button");
        const notificationPanel = header.querySelector("#notification-panel");

        // notifications.js est chargé avant header.js et reste responsable
        // du clic sur la cloche + du chargement des données.
        const notificationsManagedExternally =
            notificationButton?.dataset.visiblNotificationsBound === "1";

        const profileMenu = header.querySelector('[data-header-panel="profile"]');
        const profileButton = header.querySelector("#profile-button");
        const profilePanel = header.querySelector("#profile-panel");

        /* ==========================================================
           SIDEBAR RESPONSIVE — HAMBURGER GLOBAL
           - Desktop large : sidebar visible => bouton masqué
           - Desktop réduit : si la sidebar sort du layout => bouton visible
           - Téléphone/tablette : bouton forcé
        ========================================================== */
        const sidebar = document.getElementById("sidebar");
        const sidebarClose = document.getElementById("sidebar-close");
        const headerLeft = header.querySelector(".visibl-header-left");

        let sidebarToggle = document.getElementById("sidebar-toggle");

        if (!sidebarToggle && headerLeft && sidebar) {
            sidebarToggle = document.createElement("button");
            sidebarToggle.id = "sidebar-toggle";
            sidebarToggle.type = "button";
            sidebarToggle.className = "visibl-header-btn visibl-menu-btn";
            sidebarToggle.setAttribute("aria-label", "Ouvrir le menu");
            sidebarToggle.setAttribute("aria-controls", "sidebar");
            sidebarToggle.setAttribute("aria-expanded", "false");
            sidebarToggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
            headerLeft.prepend(sidebarToggle);
        }

        function sidebarEstHorsLayout() {
            if (!sidebar) return false;

            const style = window.getComputedStyle(sidebar);
            const rect = sidebar.getBoundingClientRect();

            return (
                style.display === "none" ||
                style.visibility === "hidden" ||
                rect.width < 20 ||
                rect.right <= 1 ||
                rect.left >= window.innerWidth
            );
        }

        function actualiserHamburgerSidebar() {
            if (!sidebar || !sidebarToggle) return;

            const appareilCompact =
                window.matchMedia("(max-width: 720px)").matches;

            /*
             * Sur téléphone : hamburger toujours présent.
             * Sur ordinateur : il apparaît uniquement quand la sidebar
             * n'est plus présente dans le layout à cause du responsive.
             */
            const necessaire =
                appareilCompact ||
                sidebarEstHorsLayout();

            header.classList.toggle(
                "visibl-sidebar-toggle-needed",
                necessaire
            );

            if (!necessaire) {
                sidebar.classList.remove("active");
                sidebarToggle.setAttribute("aria-expanded", "false");
            }
        }

        function ouvrirSidebar() {
            if (!sidebar || !sidebarToggle) return;
            sidebar.classList.add("active");
            document.body.classList.add("visibl-sidebar-open");
            sidebarToggle.setAttribute("aria-expanded", "true");
            closeAll();
        }

        function fermerSidebar() {
            if (!sidebar || !sidebarToggle) return;
            sidebar.classList.remove("active");
            document.body.classList.remove("visibl-sidebar-open");
            sidebarToggle.setAttribute("aria-expanded", "false");
        }

        if (sidebarToggle && sidebar && sidebarToggle.dataset.visiblSidebarBound !== "1") {
            sidebarToggle.dataset.visiblSidebarBound = "1";

            sidebarToggle.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();

                if (sidebar.classList.contains("active")) {
                    fermerSidebar();
                } else {
                    ouvrirSidebar();
                }
            });
        }

        if (sidebarClose && sidebarClose.dataset.visiblSidebarBound !== "1") {
            sidebarClose.dataset.visiblSidebarBound = "1";
            sidebarClose.addEventListener("click", function () {
                fermerSidebar();
            });
        }

        document.addEventListener("click", function (event) {
            if (
                sidebar &&
                sidebar.classList.contains("active") &&
                !sidebar.contains(event.target) &&
                !sidebarToggle?.contains(event.target)
            ) {
                fermerSidebar();
            }
        });

        window.addEventListener("resize", function () {
            actualiserHamburgerSidebar();
        }, { passive: true });

        requestAnimationFrame(actualiserHamburgerSidebar);

        // Informations du compte connecté (déjà stockées par auth.js).
        function getHeaderCurrentUser() {
            try {
                if (typeof window.getCurrentUser === "function") {
                    return window.getCurrentUser();
                }
                if (typeof getCurrentUser === "function") {
                    return getCurrentUser();
                }
                const raw = localStorage.getItem("visibl_user");
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                console.warn("VISIBL Header : impossible de lire l’utilisateur connecté.", error);
                return null;
            }
        }

        function firstNonEmpty(object, keys) {
            if (!object) return "";
            for (const key of keys) {
                const value = object[key];
                if (value !== undefined && value !== null && String(value).trim()) {
                    return String(value).trim();
                }
            }
            return "";
        }

        function afficherUtilisateurConnecte() {
            if (!profilePanel) return;

            const user = getHeaderCurrentUser();
            if (!user) return;

            let nom = firstNonEmpty(user, [
                "nomComplet", "fullName", "name", "displayName",
                "nomUtilisateur", "username"
            ]);

            if (!nom) {
                const prenom = firstNonEmpty(user, ["prenom", "firstName"]);
                const nomFamille = firstNonEmpty(user, ["nom", "lastName", "surname"]);
                nom = [prenom, nomFamille].filter(Boolean).join(" ").trim();
            }

            if (!nom) {
                nom = firstNonEmpty(user, ["email"]) || "Utilisateur";
            }

            const role = firstNonEmpty(user, [
                "role", "roleName", "roleNom", "nomRole",
                "libelleRole", "roleLabel", "fonction", "poste"
            ]) || (firstNonEmpty(user, ["roleId"]) === "ROL0001" ? "Administrateur" : "Utilisateur");

            // Compatible avec plusieurs variantes de la maquette V3.
            const nomEl = profilePanel.querySelector(
                "[data-profile-user-name], .visibl-profile-name, .profile-user-name, .profile-card-title, .profile-summary strong, .visibl-profile-heading strong"
            );
            const roleEl = profilePanel.querySelector(
                "[data-profile-user-role], .visibl-profile-role, .profile-user-role, .profile-card-subtitle, .profile-summary small, .visibl-profile-heading small"
            );

            if (nomEl) nomEl.textContent = nom;
            if (roleEl) roleEl.textContent = role;
        }

        afficherUtilisateurConnecte();

        function setExpanded(button, value) {
            button?.setAttribute("aria-expanded", String(Boolean(value)));
        }

        function forcePanelVisible(panel, visible) {
            if (!panel) return;

            if (visible) {
                panel.hidden = false;
                panel.removeAttribute("hidden");
                panel.style.setProperty("display", "block", "important");
                panel.style.setProperty("visibility", "visible", "important");
                panel.style.setProperty("opacity", "1", "important");
                panel.style.setProperty("pointer-events", "auto", "important");
            } else {
                panel.hidden = true;
                panel.setAttribute("hidden", "");
                panel.style.setProperty("display", "none", "important");
                panel.style.removeProperty("visibility");
                panel.style.removeProperty("opacity");
                panel.style.removeProperty("pointer-events");
            }
        }

        function closeSearch() {
            searchBox?.classList.remove("is-open");
            searchContainer?.classList.remove("active");
            setExpanded(searchToggle, false);
        }

        function closeNotifications() {
            notificationMenu?.classList.remove("is-open");

            // IMPORTANT : ne jamais laisser display:none !important en inline ici.
            // Le module notifications.js rouvre ensuite le panneau en jouant sur
            // l'attribut hidden. Un display:none inline bloquait donc les ouvertures
            // suivantes après un passage par la recherche ou le profil.
            if (notificationPanel) {
                notificationPanel.hidden = true;
                notificationPanel.setAttribute("hidden", "");
                notificationPanel.style.removeProperty("display");
                notificationPanel.style.removeProperty("visibility");
                notificationPanel.style.removeProperty("opacity");
                notificationPanel.style.removeProperty("pointer-events");
            }

            setExpanded(notificationButton, false);
        }

        function closeProfile() {
            profileMenu?.classList.remove("is-open");
            forcePanelVisible(profilePanel, false);
            setExpanded(profileButton, false);
        }

        function closeAll(except) {
            if (except !== "search") closeSearch();
            if (except !== "notifications") closeNotifications();
            if (except !== "profile") closeProfile();
        }

        searchToggle?.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = !searchBox?.classList.contains("is-open");
            closeAll("search");
            searchBox?.classList.toggle("is-open", willOpen);
            searchContainer?.classList.toggle("active", willOpen);
            setExpanded(searchToggle, willOpen);
            if (willOpen) window.setTimeout(() => searchInput?.focus(), 100);
        });

        // La cloche est déjà pilotée par modules/notifications.js sur cette page.
        // On ne lui ajoute donc PAS un deuxième gestionnaire de clic.
        // pointerdown sert seulement à fermer Recherche/Profil avant son propre clic.
        notificationButton?.addEventListener("pointerdown", function () {
            closeSearch();
            closeProfile();
        }, true);

        if (!notificationsManagedExternally) {
            notificationButton?.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();

                const willOpen = notificationPanel?.hasAttribute("hidden") ?? true;

                if (willOpen) {
                    closeAll("notifications");
                    forcePanelVisible(notificationPanel, true);
                    notificationMenu?.classList.add("is-open");
                    setExpanded(notificationButton, true);
                    decorerNotifications();
                } else {
                    closeNotifications();
                }
            });
        }

        profileButton?.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            afficherUtilisateurConnecte();
            const willOpen = profilePanel?.hasAttribute("hidden") ?? true;
            closeAll("profile");
            forcePanelVisible(profilePanel, willOpen);
            profileMenu?.classList.toggle("is-open", willOpen);
            setExpanded(profileButton, willOpen);
        });

        // Clic à l'extérieur : fermeture de tout.
        document.addEventListener("click", function (event) {
            if (!header.contains(event.target)) closeAll();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeAll();
                fermerSidebar();
            }
        });

        // Recherche desktop : si elle prend le focus, les autres panneaux se ferment.
        searchContainer?.addEventListener("pointerdown", function () {
            closeAll("search");
        });
        searchInput?.addEventListener("focus", function () {
            closeAll("search");
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 760) closeSearch();
        }, { passive: true });

        function determinerTypeNotification(texte) {
            const t = String(texte || "").toLowerCase();
            if (/paiement|payé|paye|encaiss|règlement|reglement/.test(t)) return ["payment", "fa-solid fa-credit-card"];
            if (/commande confirm|confirmée|confirmee/.test(t)) return ["confirmed", "fa-solid fa-circle-check"];
            if (/nouvelle commande|commande créée|commande creee|commande/.test(t)) return ["order", "fa-solid fa-cart-plus"];
            if (/livraison|livré|livre|expédi|exped/.test(t)) return ["delivery", "fa-solid fa-truck-fast"];
            if (/stock|rupture|inventaire|produit/.test(t)) return ["stock", "fa-solid fa-boxes-stacked"];
            if (/client|inscription/.test(t)) return ["client", "fa-solid fa-user-plus"];
            if (/alerte|attention|erreur|retard|annul/.test(t)) return ["warning", "fa-solid fa-triangle-exclamation"];
            return ["default", "fa-regular fa-bell"];
        }

        function candidatsNotifications() {
            if (!notificationPanel) return [];
            const selectors = [
                "[data-notification-type]",
                ".notification-item",
                ".notification-card",
                ".notification-row"
            ];
            let nodes = Array.from(notificationPanel.querySelectorAll(selectors.join(",")));

            if (!nodes.length) {
                nodes = Array.from(notificationPanel.children).filter(el =>
                    el !== notificationPanel.querySelector(".notification-panel-header") &&
                    !el.classList.contains("notification-empty-state")
                );
            }
            return nodes;
        }

        function decorerNotifications() {
            candidatsNotifications().forEach(item => {
                if (!(item instanceof Element)) return;
                if (item.dataset.visiblNotificationDecorated === "true") return;
                if (item.closest(".notification-panel-header")) return;

                const texte = item.textContent || "";
                if (!texte.trim()) return;

                const [type, iconClass] = determinerTypeNotification(
                    item.dataset.notificationType || texte
                );

                const icon = document.createElement("span");
                icon.className = `visibl-notification-type-icon visibl-notification-type-${type}`;
                icon.setAttribute("aria-hidden", "true");
                icon.innerHTML = `<i class="${iconClass}"></i>`;

                item.prepend(icon);
                item.dataset.visiblNotificationDecorated = "true";
                item.dataset.visiblNotificationType = type;
            });
        }

        if (notificationPanel && "MutationObserver" in window) {
            const observer = new MutationObserver(function () {
                decorerNotifications();
            });
            observer.observe(notificationPanel, { childList: true, subtree: true });
        }
        decorerNotifications();

        window.VisiblHeader = {
            closeAll,
            decorerNotifications,
            afficherUtilisateurConnecte,
            ouvrirSidebar,
            fermerSidebar,
            actualiserHamburgerSidebar
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initVisiblHeader);
    } else {
        initVisiblHeader();
    }
})();
