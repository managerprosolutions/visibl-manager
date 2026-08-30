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
    if (!isAuthenticated()) {
        return false;
    }

    const user = getCurrentUser();

    const destination =
        (
            user &&
            user.permissionsLoaded === true &&
            Array.isArray(user.permissions) &&
            typeof getFirstAuthorizedPageFromStoredUser ===
                "function"
        )
            ? getFirstAuthorizedPageFromStoredUser(user)
            : AUTH_CONFIG.DASHBOARD_PAGE;

    window.location.replace(
        destination || AUTH_CONFIG.LOGIN_PAGE
    );

    return true;
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


/* =========================================================
   AUTORISATIONS PAR RÔLE
   Source backend : "Autorisations Rôles"
========================================================= */

const VISIBL_PERMISSION_EVENT = "visibl:permissions-ready";

/**
 * Normalise un module/action pour éviter les écarts
 * d'accents, espaces et casse.
 */
function normaliserPermissionVisibl(valeur) {
    return String(valeur || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/* =========================================================
   GARDE D'ACCÈS IMMÉDIATE PAR URL
   Bloque une page interdite avant son affichage normal.
========================================================= */

const VISIBL_AUTH_PAGE_MODULE_MAP = {
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

const VISIBL_AUTH_MODULE_PAGE_MAP = {
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

function getFirstAuthorizedPageFromStoredUser(user) {
    if (!user) {
        return "";
    }

    if (
        String(user.roleId || "")
            .trim()
            .toUpperCase() === "ROL0001"
    ) {
        return "dashboard.html";
    }

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

    const permissions = Array.isArray(user.permissions)
        ? user.permissions
        : [];

    const modulesVisibles = new Set(
        permissions
            .filter(
                (permission) =>
                    normaliserPermissionVisibl(
                        permission?.action
                    ) === "voir"
            )
            .map(
                (permission) =>
                    normaliserPermissionVisibl(
                        permission?.module
                    )
            )
    );

    const premierModule = ordre.find(
        (module) => modulesVisibles.has(module)
    );

    return premierModule
        ? VISIBL_AUTH_MODULE_PAGE_MAP[premierModule]
        : "";
}

/**
 * Vérification SYNCHRONE avec les permissions déjà enregistrées
 * lors du login. Cela empêche le contournement par modification
 * manuelle de l'URL.
 */
function enforceStoredPagePermissionImmediately() {
    const user = getCurrentUser();

    if (!user) {
        return false;
    }

    const fichierCourant =
        decodeURIComponent(
            window.location.pathname
                .split("/")
                .pop()
        );

    // La page de connexion n'est pas un module métier.
    if (
        fichierCourant === "connexion.html" ||
        fichierCourant === ""
    ) {
        return true;
    }

    const moduleCourant =
        VISIBL_AUTH_PAGE_MODULE_MAP[
            fichierCourant
        ];

    if (!moduleCourant) {
        return true;
    }

    // ROL0001 conserve son accès complet.
    if (
        String(user.roleId || "")
            .trim()
            .toUpperCase() === "ROL0001"
    ) {
        return true;
    }

    /*
     * Depuis le correctif de connexion, les permissions sont
     * chargées AVANT la redirection. On peut donc refuser
     * immédiatement une URL interdite.
     */
    if (
        user.permissionsLoaded === true &&
        Array.isArray(user.permissions)
    ) {
        const autorise = user.permissions.some(
            (permission) =>
                normaliserPermissionVisibl(
                    permission?.module
                ) === moduleCourant &&
                normaliserPermissionVisibl(
                    permission?.action
                ) === "voir"
        );

        if (autorise) {
            return true;
        }

        const destination =
            getFirstAuthorizedPageFromStoredUser(
                user
            );

        if (destination) {
            window.location.replace(destination);
        } else {
            logoutUser();
        }

        return false;
    }

    /*
     * Ancienne session sans permissions en cache :
     * on masque immédiatement le document pendant la lecture
     * serveur, afin qu'une page interdite ne soit pas exposée.
     */
    if (document.documentElement) {
        document.documentElement.style.visibility =
            "hidden";
    }

    return null;
}

const VISIBL_EARLY_ACCESS_STATE =
    enforceStoredPagePermissionImmediately();


/**
 * Enregistre la version enrichie de l'utilisateur.
 */
function saveCurrentUser(user) {
    if (!user) {
        return;
    }

    localStorage.setItem(
        AUTH_CONFIG.USER_STORAGE_KEY,
        JSON.stringify(user)
    );
}

/**
 * Retourne les permissions déjà mises en cache.
 */
function getCurrentPermissions() {
    const user = getCurrentUser();

    if (!user || !Array.isArray(user.permissions)) {
        return [];
    }

    return user.permissions;
}

/**
 * Vérifie une autorisation.
 *
 * Exemple :
 * hasPermission("ventes", "voir")
 * hasPermission("ventes", "creer")
 */
function hasPermission(module, action = "voir") {
    const user = getCurrentUser();

    if (!user) {
        return false;
    }

    if (
        String(user.roleId || "")
            .trim()
            .toUpperCase() === "ROL0001"
    ) {
        return true;
    }

    const moduleRecherche =
        normaliserPermissionVisibl(module);

    const actionRecherche =
        normaliserPermissionVisibl(action);

    return getCurrentPermissions().some(
        (permission) =>
            normaliserPermissionVisibl(
                permission?.module
            ) === moduleRecherche &&
            normaliserPermissionVisibl(
                permission?.action
            ) === actionRecherche
    );
}

/**
 * Charge les autorisations correspondant au rôle
 * actuellement connecté et les stocke avec l'utilisateur.
 */
async function refreshCurrentUserPermissions(force = false) {
    const user = getCurrentUser();

    if (!user || !user.roleId) {
        return {
            success: false,
            permissions: []
        };
    }

    if (
        !force &&
        user.permissionsLoaded === true &&
        Array.isArray(user.permissions)
    ) {
        return {
            success: true,
            permissions: user.permissions
        };
    }

    if (typeof apiPost !== "function") {
        console.error(
            "apiPost est indisponible : impossible de charger les permissions."
        );

        return {
            success: false,
            permissions: []
        };
    }

    try {
        const resultat = await apiPost(
            "getPermissions",
            {
                roleId: user.roleId
            }
        );

        if (!resultat || resultat.success !== true) {
            throw new Error(
                resultat?.message ||
                "Impossible de récupérer les permissions."
            );
        }

        const utilisateurMisAJour = {
            ...user,
            permissions: Array.isArray(
                resultat.permissions
            )
                ? resultat.permissions
                : [],
            permissionsLoaded: true,
            permissionsLoadedAt:
                new Date().toISOString()
        };

        saveCurrentUser(utilisateurMisAJour);

        // Si une ancienne session avait été masquée en attendant
        // les permissions, on contrôle la page avant de la révéler.
        const accesApresActualisation =
            enforceStoredPagePermissionImmediately();

        if (
            accesApresActualisation === true &&
            document.documentElement
        ) {
            document.documentElement.style.visibility =
                "";
        }

        window.dispatchEvent(
            new CustomEvent(
                VISIBL_PERMISSION_EVENT,
                {
                    detail: {
                        user: utilisateurMisAJour,
                        permissions:
                            utilisateurMisAJour.permissions
                    }
                }
            )
        );

        return {
            success: true,
            permissions:
                utilisateurMisAJour.permissions
        };
    } catch (error) {
        console.error(
            "Erreur de chargement des permissions :",
            error
        );

        window.dispatchEvent(
            new CustomEvent(
                VISIBL_PERMISSION_EVENT,
                {
                    detail: {
                        user: user,
                        permissions:
                            getCurrentPermissions(),
                        error: true
                    }
                }
            )
        );

        return {
            success: false,
            permissions:
                getCurrentPermissions()
        };
    }
}

/**
 * Recharge systématiquement les permissions au démarrage
 * d'une page afin qu'une modification faite dans Paramètres
 * soit prise en compte à la prochaine navigation/reconnexion.
 */
function initialiserPermissionsUtilisateur() {
    if (!isAuthenticated()) {
        return;
    }

    refreshCurrentUserPermissions(true);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserPermissionsUtilisateur
    );
} else {
    initialiserPermissionsUtilisateur();
}
