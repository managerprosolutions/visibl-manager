/**
 * Gestion de l'authentification côté frontend.
 */

const AUTH_CONFIG = {
    USER_STORAGE_KEY: "visibl_user",
    LOGIN_PAGE: "connexion.html",
    DASHBOARD_PAGE: "dashboard.html"
};

/**
 * Récupère l'utilisateur actuellement enregistré.
 */
function getCurrentUser() {
    const storedUser = localStorage.getItem(
        AUTH_CONFIG.USER_STORAGE_KEY
    );

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch (error) {
        console.error(
            "Données utilisateur invalides :",
            error
        );

        localStorage.removeItem(
            AUTH_CONFIG.USER_STORAGE_KEY
        );

        return null;
    }
}

/**
 * Vérifie si un utilisateur est connecté.
 */
function isAuthenticated() {
    return getCurrentUser() !== null;
}

/**
 * Protège une page réservée aux utilisateurs connectés.
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.replace(
            AUTH_CONFIG.LOGIN_PAGE
        );

        return false;
    }

    return true;
}

/**
 * Empêche un utilisateur déjà connecté
 * de retourner sur la page de connexion.
 */
function redirectAuthenticatedUser() {
    if (isAuthenticated()) {
        window.location.replace(
            AUTH_CONFIG.DASHBOARD_PAGE
        );

        return true;
    }

    return false;
}

/**
 * Déconnecte l'utilisateur.
 */
function logoutUser() {
    localStorage.removeItem(
        AUTH_CONFIG.USER_STORAGE_KEY
    );

    window.location.replace(
        AUTH_CONFIG.LOGIN_PAGE
    );
}
