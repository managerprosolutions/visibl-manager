// ===== SIDEBAR TOGGLE =====

const chargementsExportVisibl = new Map();

function chargerScriptExportVisibl(url, disponible) {
    if (disponible()) return Promise.resolve(true);
    if (chargementsExportVisibl.has(url)) return chargementsExportVisibl.get(url);

    const script = document.createElement("script");
    script.src = url;
    const chargement = new Promise(resolve => {
        script.addEventListener("load", () => resolve(disponible()), { once: true });
        script.addEventListener("error", () => resolve(false), { once: true });
    }).then(ok => {
        if (!ok) {
            script.remove();
            chargementsExportVisibl.delete(url);
        }
        return ok;
    });
    chargementsExportVisibl.set(url, chargement);
    document.head.append(script);
    return chargement;
}

async function chargerBibliothequeExport(format) {
    const cdn = "https://cdnjs.cloudflare.com/ajax/libs/";
    if (format === "excel") {
        return chargerScriptExportVisibl(cdn + "xlsx/0.18.5/xlsx.full.min.js", () => Boolean(window.XLSX?.utils));
    }
    if (format !== "pdf") return false;

    const pdf = await chargerScriptExportVisibl(cdn + "jspdf/2.5.1/jspdf.umd.min.js", () => Boolean(window.jspdf?.jsPDF));
    if (!pdf) return false;
    return chargerScriptExportVisibl(cdn + "jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
        () => typeof window.jspdf?.jsPDF?.API?.autoTable === "function");
}

const cadreClients = Boolean(document.querySelector('[data-visibl-sidebar]'));
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');

if (!cadreClients && sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
}

if (!cadreClients && sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}

// Fermer le sidebar en cliquant en dehors
document.addEventListener('click', (e) => {
    if (cadreClients || !sidebar) return;

    const clicDansSidebar = sidebar.contains(e.target);
    const clicSurToggle =
        sidebarToggle && sidebarToggle.contains(e.target);

    if (!clicDansSidebar && !clicSurToggle) {
        sidebar.classList.remove('active');
    }
});

// ===== PROFILE MENU DROPDOWN =====

const profileBtn = document.querySelector('.profile-menu .icon-btn');
const profileMenu = document.querySelector('.profile-menu');

if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Sur mobile, fermer la recherche avant d'ouvrir le profil
if (window.innerWidth <= 768 && searchContainer) {
    searchContainer.classList.remove("active");
}

profileMenu.classList.toggle("active");
    });

    // Fermer le menu en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!profileMenu.contains(e.target)) {
            profileMenu.classList.remove('active');
        }
    });
}

// ===== ACTIVE NAV LINK =====

const navLinks = document.querySelectorAll('.nav-link');
const currentPage = decodeURIComponent(window.location.pathname.split('/').pop());

navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    const filename = decodeURIComponent(href.split('/').pop());
    if (filename === currentPage) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
        const group = cadreClients && link.closest('.menu-category');
        const trigger = group && group.querySelector('.category-title');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
    }
});

// ===== SEARCH FUNCTIONALITY =====

const searchInput = document.querySelector('.search-input');
const searchBtn = document.querySelector('.search-btn');

if (!cadreClients && searchBtn) {
    searchBtn.addEventListener('click', performSearch);
}

if (!cadreClients && searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

function performSearch() {
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) return;
    const search = document.querySelector('.content input[type="search"], .content input[id*="search"]');
    if (!search || search === searchInput || search.value === query) return;
    search.value = query;
    search.dispatchEvent(new Event('input', { bubbles: true }));
}

// ===== NOTIFICATIONS =====

const notificationsBtn = document.querySelector('.notifications');

if (!cadreClients && notificationsBtn) {
    notificationsBtn.addEventListener('click', () => {
        console.log('Afficher les notifications');
        // Ajouter la logique des notifications ici
    });
}

// ===== USER GREETING =====

const userGreeting = document.getElementById('user-greeting');
const hour = new Date().getHours();

if (userGreeting) {
    if (hour < 12) {
        userGreeting.textContent = 'Madame';
    } else if (hour < 18) {
        userGreeting.textContent = 'Madame';
    } else {
        userGreeting.textContent = 'Madame';
    }
}

// ===== SMOOTH SCROLL BEHAVIOR =====

document.documentElement.style.scrollBehavior = 'smooth';

// ===== UTILITY FUNCTIONS =====

// Formater le nombre en devises
function formatCurrency(value) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

// Log pour debugging (à retirer en production)
console.log('Dashboard initialisé avec succès');
// ===== MENU ACCORDEON SIDEBAR =====

const categories = document.querySelectorAll(".category-title");

console.log("Catégories trouvées :", categories.length);

categories.forEach(function(category) {

    if (cadreClients) {
        const expanded = category.getAttribute("aria-expanded") === "true";
        category.setAttribute("aria-expanded", String(expanded));
        const submenu = category.parentElement.querySelector(".submenu");
        if (submenu && expanded) submenu.style.display = "block";
        const arrow = category.querySelector(".arrow");
        if (arrow && expanded) arrow.textContent = "▲";
    }
    category.addEventListener("click", function(e) {

        e.preventDefault();

        const submenu = this.parentElement.querySelector(".submenu");
        if (!submenu) return;
        const arrow = this.querySelector(".arrow");

        if (submenu.style.display === "block") {
            submenu.style.display = "none";
            this.setAttribute("aria-expanded", "false");

            if (arrow) {
                arrow.textContent = "▼";
            }

        } else {
            submenu.style.display = "block";
            this.setAttribute("aria-expanded", "true");

            if (arrow) {
                arrow.textContent = "▲";
            }

        }

    });

});

// ===== MOBILE SEARCH TOGGLE =====

const mobileSearchBtn = document.getElementById("mobile-search-btn");
const searchContainer = document.querySelector(".search-container");

if (!cadreClients && mobileSearchBtn && searchContainer) {

    mobileSearchBtn.addEventListener("click", function(e){

        e.stopPropagation();

        // Sur mobile, fermer le menu profil avant d'ouvrir la recherche
if (window.innerWidth <= 768 && profileMenu) {
    profileMenu.classList.remove("active");
}

searchContainer.classList.toggle("active");

    });

}
