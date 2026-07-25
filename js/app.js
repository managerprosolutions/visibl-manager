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

        // Sur mobile, fermer la recherche si elle existe
if (window.innerWidth <= 768 && searchContainer) {
    searchContainer.classList.remove("active");
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
// MENUS DU HEADER
// ========================================

function initialiserMenusHeader() {
    const profileButton =
        document.getElementById("profile-button");

    const profileMenu =
        document.getElementById("profile-menu");

    const notificationButton =
        document.getElementById("notification-button");

    const notificationPanel =
        document.getElementById("notification-panel");


    function fermerMenuProfil() {
        if (!profileMenu) {
            return;
        }

        profileMenu.classList.remove("active");

        if (profileButton) {
            profileButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    function fermerNotifications() {
        if (!notificationPanel) {
            return;
        }

        notificationPanel.setAttribute("hidden", "");

        if (notificationButton) {
            notificationButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    // OUVRIR LE MENU DU PROFIL

    if (profileButton && profileMenu) {
        profileButton.addEventListener(
            "click",
            function (event) {
                event.stopPropagation();

                const menuEtaitOuvert =
                    profileMenu.classList.contains("active");

                // Fermer les notifications
                fermerNotifications();

                // Fermer la recherche sur mobile
                if (
                    window.innerWidth <= 768 &&
                    searchContainer
                ) {
                    searchContainer.classList.remove("active");
                }

                if (menuEtaitOuvert) {
                    fermerMenuProfil();
                } else {
                    profileMenu.classList.add("active");

                    profileButton.setAttribute(
                        "aria-expanded",
                        "true"
                    );
                }
            }
        );

        profileMenu.addEventListener(
            "click",
            function (event) {
                event.stopPropagation();
            }
        );
    }


    // OUVRIR LES NOTIFICATIONS

    if (notificationButton && notificationPanel) {
        notificationButton.addEventListener(
            "click",
            function (event) {
                event.stopPropagation();

                const panneauEtaitOuvert =
                    !notificationPanel.hasAttribute("hidden");

                // Fermer le menu du profil
                fermerMenuProfil();

                // Fermer la recherche sur mobile
                if (
                    window.innerWidth <= 768 &&
                    searchContainer
                ) {
                    searchContainer.classList.remove("active");
                }

                if (panneauEtaitOuvert) {
                    fermerNotifications();
                } else {
                    notificationPanel.removeAttribute("hidden");

                    notificationButton.setAttribute(
                        "aria-expanded",
                        "true"
                    );
                }
            }
        );

        notificationPanel.addEventListener(
            "click",
            function (event) {
                event.stopPropagation();
            }
        );
    }


    // CLIQUER EN DEHORS

    document.addEventListener(
        "click",
        function () {
            fermerMenuProfil();
            fermerNotifications();
        }
    );


    // TOUCHE ÉCHAP

    document.addEventListener(
        "keydown",
        function (event) {
            if (event.key === "Escape") {
                fermerMenuProfil();
                fermerNotifications();
            }
        }
    );
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserMenusHeader
    );
} else {
    initialiserMenusHeader();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserNotifications
    );
} else {
    initialiserNotifications();
}
