console.log("dashboard.js chargé");
// ===== SIDEBAR TOGGLE =====

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.add('active');
});

sidebarClose.addEventListener('click', () => {
    sidebar.classList.remove('active');
});

// Fermer le sidebar en cliquant en dehors
document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

// ===== PROFILE MENU DROPDOWN =====

const profileBtn = document.querySelector('.profile-menu .icon-btn');
const profileMenu = document.querySelector('.profile-menu');

if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('active');
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
const currentPage = window.location.pathname.split('/').pop();

navLinks.forEach(link => {
    const href = link.getAttribute('href').split('/').pop();
    if (href === currentPage) {
        link.classList.add('active');
    }
});

// ===== SEARCH FUNCTIONALITY =====

const searchInput = document.querySelector('.search-input');
const searchBtn = document.querySelector('.search-btn');

if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
}

if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

function performSearch() {
    const query = searchInput.value.trim();
    if (query) {
        console.log('Recherche pour:', query);
        // Ajouter la logique de recherche ici
    }
}

// ===== NOTIFICATIONS =====

const notificationsBtn = document.querySelector('.notifications');

if (notificationsBtn) {
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
// Menu accordéon sidebar

const categories = document.querySelectorAll(".category-title");

categories.forEach(category => {

    category.addEventListener("click", function(e) {

        e.preventDefault();

        const submenu = this.nextElementSibling;

        if (submenu.style.display === "block") {
            submenu.style.display = "none";
        } else {
            submenu.style.display = "block";
        }

    });

});
