const VISIBL_USER_KEY = "visibl_user";
const VISIBL_PERMISSION_EVENT = "visibl:permissions-ready";
let sessionConfirmeeVisibl = null;
const VISIBL_CACHE_OWNER = "visibl:session-cache-owner";

function profilSessionVisibl(user) {
    return user && typeof user === "object" && !Array.isArray(user) &&
        typeof user.roleId === "string" && user.roleId.trim() &&
        typeof user.sessionToken === "string" && user.sessionToken.trim() ? user : null;
}

function lireSessionVisibl() {
    try { return profilSessionVisibl(JSON.parse(localStorage.getItem(VISIBL_USER_KEY))); }
    catch { return null; }
}

function memeSessionVisibl(a, b) {
    return Boolean(a && b && a.sessionToken === b.sessionToken &&
        a.roleId === b.roleId && a.idUtilisateur === b.idUtilisateur && a.cacheScope === b.cacheScope);
}

function getCurrentUser() {
    return memeSessionVisibl(sessionConfirmeeVisibl, lireSessionVisibl()) ? sessionConfirmeeVisibl : null;
}

function isAuthenticated() { return Boolean(getCurrentUser()); }
function requireAuth() { return isAuthenticated(); }

function verrouillerSessionVisibl() {
    sessionConfirmeeVisibl = null;
    document.documentElement.setAttribute("data-visibl-session-locked", "");
}

function nettoyerCachesSessionVisibl() {
    const clesPrivees = new Set([
        "user", "utilisateur", "currentUser", "authUser", "isAuthenticated", "token", "authToken",
        "visibl_permissions", VISIBL_CACHE_OWNER, "visibl_commande_a_convertir_en_vente",
        "visibl_stock_alert_states", "visibl_fournisseurs_loader_deja_affiche",
        "VISIBL_DASHBOARD_BROWSER_CACHE_V1", "VISIBL_DASHBOARD_SESSION_SNAPSHOT_V1",
        "VISIBL_DASHBOARD_REFRESH_SIGNAL", "VISIBL_DASHBOARD_REFRESH_TRAITE", "VISIBL_RAPPORTS_REFRESH_SIGNAL"
    ]);
    for (const type of ["localStorage", "sessionStorage"]) {
        try {
            const storage = window[type];
            for (const key of Object.keys(storage)) {
                if (clesPrivees.has(key) || /^visibl:[^:]+:nav-cache:|^visibl_fournisseurs_cache_navigation_v/i.test(key)) {
                    storage.removeItem(key);
                }
            }
        } catch {}
    }
}

function terminerSessionVisibl({ effacerSession = true, avertir = false } = {}) {
    verrouillerSessionVisibl();
    if (effacerSession) {
        try { localStorage.removeItem(VISIBL_USER_KEY); } catch {}
    }
    nettoyerCachesSessionVisibl();
    for (const child of [...document.body.children]) {
        if (child.id !== "visibl-session-status") child.remove();
    }
    const raison = avertir ? "locale" : effacerSession ? "" : "change";
    window.location.replace(raison ? "connexion.html?session=" + raison : "connexion.html");
}

function logoutUser() {
    terminerSessionVisibl({ avertir: Boolean(lireSessionVisibl()) });
}

function refusSessionVisibl(result) {
    const code = String(result?.code || result?.errorCode || result?.error?.code || "").trim().toUpperCase();
    const message = normaliserPermissionVisibl(result?.message);
    return [401, 403].includes(Number(result?.status)) ||
        /^(?:INVALID_SESSION|SESSION_(?:INVALID|EXPIRED|REVOKED|REQUIRED)|UNAUTHENTICATED|UNAUTHORIZED|AUTH_REQUIRED)$/.test(code) ||
        /^(?:session_(?:invalide|expiree|revoquee)|(?:invalid|expired|revoked)_session|session_(?:invalid|expired|revoked))$/.test(message);
}

async function verifierSessionVisibl(user) {
    const resultat = await apiPost("getPermissions", { roleId: user.roleId, _session: user.sessionToken });
    if (refusSessionVisibl(resultat) || resultat?.success !== true || !Array.isArray(resultat.permissions)) {
        const erreur = new Error("La session n’a pas pu être confirmée.");
        erreur.sessionRefusee = refusSessionVisibl(resultat);
        throw erreur;
    }
    const idRetourne = resultat.user?.id ?? resultat.user?.idUtilisateur;
    const idProfil = user.id ?? user.idUtilisateur;
    if ((resultat.user?.roleId && resultat.user.roleId !== user.roleId) ||
        (idRetourne != null && String(idRetourne) !== String(idProfil ?? "").trim())) {
        const erreur = new Error("L’identité de la session a changé.");
        erreur.sessionRefusee = true;
        throw erreur;
    }
    return { ...user, permissions: resultat.permissions, permissionsLoaded: true };
}

function ouvrirSessionVisibl(user) {
    nettoyerCachesSessionVisibl();
    const cacheScope = globalThis.crypto?.randomUUID?.() || String(Date.now());
    localStorage.setItem(VISIBL_USER_KEY, JSON.stringify({ ...user, cacheScope }));
}

function confirmerSessionVisibl(user) {
    const owner = JSON.stringify([user.idUtilisateur ?? null, user.roleId, user.cacheScope || null]);
    try {
        if (!user.cacheScope || sessionStorage.getItem(VISIBL_CACHE_OWNER) !== owner) nettoyerCachesSessionVisibl();
        sessionStorage.setItem(VISIBL_CACHE_OWNER, owner);
    } catch {}
    sessionConfirmeeVisibl = user;
}

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
    "moncompte.html": null,
    "dashboard.html": "dashboard",
    "clients.html": "clients",
    "commandes.html": "commandes",
    "ventes.html": "ventes",
    "livraisons.html": "livraisons",
    "livreurs.html": "livreurs",
    "produits.html": "produits",
    "stock.html": "stock",
    "mouvement_stock.html": "mouvements_stock",
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
    mouvements_stock: "mouvement_stock.html",
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

function autorisationVisibl(user, module, action) {
    return Boolean(user?.permissions?.some(permission =>
        normaliserPermissionVisibl(permission?.module) === normaliserPermissionVisibl(module) &&
        normaliserPermissionVisibl(permission?.action) === normaliserPermissionVisibl(action)));
}

function getCurrentPermissions() { return getCurrentUser()?.permissions || []; }
function hasPermission(module, action = "voir") {
    return autorisationVisibl(getCurrentUser(), module, action);
}

function appliquerNavigationUtilisateur() {
    const user = getCurrentUser();
    if (!user) return;

    for (const link of document.querySelectorAll(".sidebar nav a[href]")) {
        const url = new URL(link.href, window.location.href);
        const module = VISIBL_AUTH_PAGE_MODULE_MAP[decodeURIComponent(url.pathname.split("/").pop())];
        if (!module) continue;
        const item = link.closest("li") || link;
        item.toggleAttribute("data-visibl-denied", !hasPermission(module, "voir"));
    }
    for (const group of document.querySelectorAll(".sidebar .menu-category")) {
        const items = [...group.querySelectorAll(".submenu li")];
        group.toggleAttribute("data-visibl-denied", items.length > 0 &&
            items.every(item => item.hasAttribute("data-visibl-denied")));
    }
}
