// ===== SIDEBAR TOGGLE =====

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarClose = document.getElementById("sidebar-close");

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.add("active");
    });
}

if (sidebarClose && sidebar) {
    sidebarClose.addEventListener("click", () => {
        sidebar.classList.remove("active");
    });
}

// Fermer le sidebar en cliquant en dehors
document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove("active");
    }
});

// ===== PROFILE MENU DROPDOWN =====

const profileBtn = document.querySelector(".profile-menu .icon-btn");
const profileMenu = document.querySelector(".profile-menu");

if (profileBtn) {
    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();

        // Sur mobile, fermer la recherche si elle existe
        if (window.innerWidth <= 768 && searchContainer) {
            searchContainer.classList.remove("active");
        }

        const notificationPanel = document.getElementById("notification-panel");

        if (notificationPanel) {
            notificationPanel.setAttribute("hidden", "");
        }

        profileMenu.classList.toggle("active");
    });

    // Fermer le menu en cliquant ailleurs
    document.addEventListener("click", (e) => {
        if (!profileMenu.contains(e.target)) {
            profileMenu.classList.remove("active");
        }
    });
}

// ===== ACTIVE NAV LINK =====

const navLinks = document.querySelectorAll(".nav-link");
const currentPage = window.location.pathname.split("/").pop();

navLinks.forEach((link) => {
    const href = link.getAttribute("href").split("/").pop();

    if (href === currentPage) {
        link.classList.add("active");
    }
});

// ===== SEARCH FUNCTIONALITY =====

const searchInput = document.querySelector(".search-input");
const searchBtn = document.querySelector(".search-btn");

if (searchBtn) {
    searchBtn.addEventListener("click", performSearch);
}

if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            performSearch();
        }
    });
}

function performSearch() {
    const query = searchInput.value.trim();

    if (query) {
        console.log("Recherche pour :", query);

        // Ajouter la logique de recherche ici
    }
}

// ===== NOTIFICATIONS =====

const notificationsBtn = document.querySelector(".notifications");

if (notificationsBtn) {
    notificationsBtn.addEventListener("click", () => {
        console.log("Afficher les notifications");

        // Ajouter la logique des notifications ici
    });
}

// ===== USER GREETING =====

const userGreeting = document.getElementById("user-greeting");
const hour = new Date().getHours();

if (userGreeting) {
    if (hour < 12) {
        userGreeting.textContent = "Madame";
    } else if (hour < 18) {
        userGreeting.textContent = "Madame";
    } else {
        userGreeting.textContent = "Madame";
    }
}

// ===== SMOOTH SCROLL BEHAVIOR =====

document.documentElement.style.scrollBehavior = "smooth";

// ===== UTILITY FUNCTIONS =====

// Formater le nombre en devises
function formatCurrency(value) {
    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XOF"
    }).format(value);
}

// Log pour debugging (à retirer en production)
console.log("Application initialisée avec succès");

// ===== MENU ACCORDÉON SIDEBAR =====

const categories = document.querySelectorAll(".category-title");

console.log("Catégories trouvées :", categories.length);

categories.forEach(function (category) {

    category.addEventListener("click", function (e) {

        e.preventDefault();

        const submenu = this.parentElement.querySelector(".submenu");
        const arrow = this.querySelector(".arrow");

        if (submenu.style.display === "block") {

            submenu.style.display = "none";

            if (arrow) {
                arrow.textContent = "▼";
            }

        } else {

            submenu.style.display = "block";

            if (arrow) {
                arrow.textContent = "▲";
            }

        }

    });

});

// ===== MOBILE SEARCH TOGGLE =====

const mobileSearchBtn = document.getElementById("mobile-search-btn");
const searchContainer = document.querySelector(".search-container");

if (mobileSearchBtn && searchContainer) {

    mobileSearchBtn.addEventListener("click", function (e) {

        e.stopPropagation();

        // Sur mobile, fermer le menu profil avant d'ouvrir la recherche
if (window.innerWidth <= 768 && profileMenu) {
    profileMenu.classList.remove("active");
}

searchContainer.classList.toggle("active");

    });

}

// ========================================
// NOTIFICATIONS
// ========================================

function initialiserNotifications() {
    const bouton =
        document.getElementById("notification-button");

    const panneau =
        document.getElementById("notification-panel");

    if (!bouton || !panneau) {
        return;
    }

    bouton.addEventListener("click", function (event) {
    event.stopPropagation();

    // Fermer le menu profil s'il est ouvert
    if (profileMenu) {
        profileMenu.classList.remove("active");
    }

    const panneauFerme =
        panneau.hasAttribute("hidden");

    if (panneauFerme) {
        panneau.removeAttribute("hidden");
    } else {
        panneau.setAttribute("hidden", "");
    }

    bouton.setAttribute(
        "aria-expanded",
        String(panneauFerme)
    );
});

    panneau.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    document.addEventListener("click", function () {
        panneau.setAttribute("hidden", "");

        bouton.setAttribute(
            "aria-expanded",
            "false"
        );
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            panneau.setAttribute("hidden", "");

            bouton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserNotifications
    );
} else {
    initialiserNotifications();
}

// ========================================
// NOTIFICATIONS (TOAST)
// ========================================

function showToast(message, type = "success") {

    const container = document.getElementById("toast-container");

    if (!container) return;

    const toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(40px)";
        toast.style.transition = "all .3s ease";

        setTimeout(() => {
            toast.remove();
        }, 300);

    }, 3000);
}

// ========================================
// DÉCONNEXION GLOBALE
// ========================================

function initialiserDeconnexionGlobale() {
    const bouton =
        document.getElementById(
            "logout-button"
        );

    if (!bouton) {
        return;
    }

    if (
        bouton.dataset.logoutInitialized ===
        "true"
    ) {
        return;
    }

    bouton.dataset.logoutInitialized =
        "true";

    bouton.addEventListener(
        "click",
        function (event) {
            event.preventDefault();

            if (
                typeof logoutUser ===
                "function"
            ) {
                logoutUser();
                return;
            }

            localStorage.removeItem(
                "visibl_user"
            );

            window.location.replace(
                "connexion.html"
            );
        }
    );
}

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserDeconnexionGlobale
    );
} else {
    initialiserDeconnexionGlobale();
}


// =========================================================
// CONTRÔLE D'ACCÈS AUX MODULES
// =========================================================

const VISIBL_PAGE_MODULE_MAP = {
    "dashboard.html": "dashboard",
    "clients.html": "clients",
    "commandes.html": "commandes",
    "ventes.html": "ventes",
    "livraisons.html": "livraisons",
    "livreurs.html": "livreurs",
    "produits.html": "produits",
    "stock.html": "stock",
    "mouvements-stock.html": "mouvements_stock",
    "mouvements_stock.html": "mouvements_stock",
    "approvisionnements.html": "approvisionnements",
    "fournisseurs.html": "fournisseurs",
    "transitaires.html": "transitaires",
    "caisse.html": "caisse",
    "paiements.html": "paiements",
    "factures.html": "factures",
    "comptabilite.html": "comptabilite",
    "comptabilité.html": "comptabilite",
    "rapports.html": "rapports",
    "parametres.html": "parametres",
    "paramètres.html": "parametres"
};

const VISIBL_MODULE_PAGE_MAP = {
    dashboard: "dashboard.html",
    ventes: "ventes.html",
    commandes: "commandes.html",
    clients: "clients.html",
    livraisons: "livraisons.html",
    livreurs: "livreurs.html",
    produits: "produits.html",
    stock: "stock.html",
    mouvements_stock: "mouvements-stock.html",
    approvisionnements: "approvisionnements.html",
    fournisseurs: "fournisseurs.html",
    transitaires: "transitaires.html",
    caisse: "caisse.html",
    paiements: "paiements.html",
    factures: "factures.html",
    comptabilite: "comptabilité.html",
    rapports: "rapports.html",
    parametres: "paramètres.html"
};

/**
 * Déduit le module depuis un href de navigation.
 */
function obtenirModuleDepuisHrefVisibl(href) {
    if (!href || href === "#") {
        return "";
    }

    const sansQuery = String(href)
        .split("?")[0]
        .split("#")[0];

    const nomFichier =
        sansQuery.split("/").pop();

    return (
        VISIBL_PAGE_MODULE_MAP[nomFichier] ||
        ""
    );
}

/**
 * Choisit la première page réellement autorisée.
 */
function obtenirPremierePageAutoriseeVisibl() {
    const ordre = [
        "dashboard",
        "ventes",
        "commandes",
        "clients",
        "livraisons",
        "livreurs",
        "produits",
        "stock",
        "mouvements_stock",
        "approvisionnements",
        "fournisseurs",
        "transitaires",
        "caisse",
        "paiements",
        "factures",
        "comptabilite",
        "rapports",
        "parametres"
    ];

    const moduleAutorise = ordre.find(
        (module) =>
            typeof hasPermission === "function" &&
            hasPermission(module, "voir")
    );

    return moduleAutorise
        ? VISIBL_MODULE_PAGE_MAP[moduleAutorise]
        : "";
}

/**
 * Cache dans la sidebar tous les modules qui ne possèdent
 * pas l'autorisation "Voir".
 */
function appliquerPermissionsNavigationVisibl() {
    if (typeof hasPermission !== "function") {
        return;
    }

    document
        .querySelectorAll('a.nav-link[href]')
        .forEach((link) => {
            const module =
                obtenirModuleDepuisHrefVisibl(
                    link.getAttribute("href")
                );

            if (!module) {
                return;
            }

            const autorise =
                hasPermission(module, "voir");

            const item =
                link.closest("li");

            if (item) {
                item.hidden = !autorise;
            } else {
                link.hidden = !autorise;
            }
        });

    // Cache une catégorie dont tous les sous-modules
    // sont désormais invisibles.
    document
        .querySelectorAll(".menu-category")
        .forEach((categorie) => {
            const liens =
                Array.from(
                    categorie.querySelectorAll(
                        '.submenu a.nav-link[href]'
                    )
                );

            if (!liens.length) {
                return;
            }

            const auMoinsUnVisible =
                liens.some((link) => {
                    const item =
                        link.closest("li");

                    return item
                        ? !item.hidden
                        : !link.hidden;
                });

            categorie.hidden =
                !auMoinsUnVisible;
        });
}

/**
 * Empêche l'accès direct par URL à une page non autorisée.
 */
function protegerPageSelonPermissionsVisibl() {
    if (typeof hasPermission !== "function") {
        return true;
    }

    const fichierCourant =
        decodeURIComponent(
            window.location.pathname
                .split("/")
                .pop()
        );

    const moduleCourant =
        VISIBL_PAGE_MODULE_MAP[
            fichierCourant
        ];

    if (!moduleCourant) {
        return true;
    }

    if (
        hasPermission(
            moduleCourant,
            "voir"
        )
    ) {
        return true;
    }

    const pageSecours =
        obtenirPremierePageAutoriseeVisibl();

    if (pageSecours) {
        if (fichierCourant !== pageSecours) {
            window.location.replace(
                pageSecours
            );
        }

        return false;
    }

    console.warn(
        "Aucun module n'est autorisé pour ce compte."
    );

    return false;
}

/**
 * Applique le contrôle des modules dès que les permissions
 * fraîches ont été chargées par auth.js.
 */
function appliquerControleAccesVisibl() {
    const user =
        typeof getCurrentUser === "function"
            ? getCurrentUser()
            : null;

    if (
        !user ||
        user.permissionsLoaded !== true
    ) {
        return;
    }

    appliquerPermissionsNavigationVisibl();

    protegerPageSelonPermissionsVisibl();
}

// Vérification immédiate supplémentaire : si les permissions
// sont déjà présentes dans la session, une URL interdite est
// rejetée sans attendre DOMContentLoaded.
appliquerControleAccesVisibl();

window.addEventListener(
    "visibl:permissions-ready",
    appliquerControleAccesVisibl
);

// Cas où les permissions étaient déjà chargées
// avant l'exécution de app.js.
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        appliquerControleAccesVisibl
    );
} else {
    appliquerControleAccesVisibl();
}
