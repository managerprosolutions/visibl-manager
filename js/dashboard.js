/* ===========================================================
   VISIBL ERP — dashboard.js
   Frontend léger : une seule source backend getDashboard()
=========================================================== */

let graphiqueRevenusDashboard = null;
let graphiqueVentesDashboard = null;
let dashboardCharge = null;

const DASHBOARD_SIGNAL_KEY = "VISIBL_DASHBOARD_REFRESH_SIGNAL";
const DASHBOARD_SIGNAL_TRAITE_KEY = "VISIBL_DASHBOARD_REFRESH_TRAITE";
const DASHBOARD_POLL_MS = 3000;
const DASHBOARD_POLL_MAX_MS = 120000;

// Cache navigateur : réaffichage instantané si aucune donnée n'a changé.
const DASHBOARD_BROWSER_CACHE_KEY = "VISIBL_DASHBOARD_BROWSER_CACHE_V1";
const DASHBOARD_BROWSER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// Synchronisation multi-appareils : vérification légère de la version serveur.
const DASHBOARD_VERSION_CHECK_INTERVAL_MS = 15000;
let dashboardDerniereVerificationServeur = 0;
let dashboardVerificationServeurEnCours = false;

let dashboardVerificationTimer = null;


/* ===========================================================
   INITIALISATION
=========================================================== */

async function initialiserDashboard() {
    if (
        typeof requireAuth === "function"
    ) {
        requireAuth();
    }

    const utilisateurConnecte =
        typeof getCurrentUser === "function"
            ? getCurrentUser()
            : null;

    if (
        typeof getCurrentUser === "function" &&
        !utilisateurConnecte
    ) {
        return;
    }

    afficherInformationsUtilisateur(
        utilisateurConnecte
    );

    initialiserDeconnexion();

    document
        .getElementById("periode-revenus")
        ?.addEventListener(
            "change",
            afficherGraphiqueRevenus
        );

    const cacheNavigateurDisponible = restaurerDashboardDepuisCacheNavigateur();
    const modificationEnAttente = existeModificationDashboardEnAttente();

    if (cacheNavigateurDisponible && !modificationEnAttente) {
        // Retour sur le Dashboard sans modification : affichage instantané,
        // sans loader et sans nouvel appel backend.
        masquerChargementDashboardImmediatement();
        // Le cache local s'affiche immédiatement, puis on vérifie en arrière-plan
        // si un autre appareil a publié une version plus récente.
        synchroniserDashboardAvecServeur(true);
    } else {
        // Premier passage, cache absent/expiré ou modification détectée.
        // Si un ancien cache est déjà affiché mais qu'une modification existe,
        // on force le loader pendant la récupération de la version fraîche.
        await chargerDashboard(false, modificationEnAttente);
    }

    demarrerVerificationDashboardSiNecessaire();

    window.addEventListener(
        "storage",
        function(event) {
            if (event.key === DASHBOARD_SIGNAL_KEY) {
                demarrerVerificationDashboardSiNecessaire(true);
            }
        }
    );

    // Même onglet / navigation interne.
    window.addEventListener(
        "visibl:dashboard-refresh",
        function() {
            demarrerVerificationDashboardSiNecessaire(true);
        }
    );

    // Quand l'utilisateur revient sur le Dashboard, on revérifie
    // immédiatement s'il existe une modification non encore traitée.
    window.addEventListener(
        "focus",
        function() {
            demarrerVerificationDashboardSiNecessaire();
            synchroniserDashboardAvecServeur(true);
        }
    );

    window.addEventListener(
        "pageshow",
        function() {
            demarrerVerificationDashboardSiNecessaire();
            synchroniserDashboardAvecServeur(true);
        }
    );

    document.addEventListener(
        "visibilitychange",
        function() {
            if (!document.hidden) {
                demarrerVerificationDashboardSiNecessaire();
                synchroniserDashboardAvecServeur(true);
            }
        }
    );
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserDashboard
    );
} else {
    initialiserDashboard();
}


/* ===========================================================
   ACTUALISATION APRÈS UNE MODIFICATION MÉTIER
=========================================================== */


/* ===========================================================
   CACHE NAVIGATEUR DU DASHBOARD
=========================================================== */

function lireCacheNavigateurDashboard() {
    try {
        const brut = localStorage.getItem(DASHBOARD_BROWSER_CACHE_KEY);
        if (!brut) return null;

        const cache = JSON.parse(brut);
        if (!cache || !cache.data || !cache.enregistreLe) return null;

        const age = Date.now() - Number(cache.enregistreLe);
        if (!Number.isFinite(age) || age < 0 || age > DASHBOARD_BROWSER_CACHE_MAX_AGE_MS) {
            localStorage.removeItem(DASHBOARD_BROWSER_CACHE_KEY);
            return null;
        }

        return cache;
    } catch (error) {
        console.warn("Cache navigateur Dashboard illisible :", error);
        return null;
    }
}

function enregistrerCacheNavigateurDashboard(data) {
    try {
        localStorage.setItem(
            DASHBOARD_BROWSER_CACHE_KEY,
            JSON.stringify({
                enregistreLe: Date.now(),
                version: String(data?.meta?.actualiseLe || ""),
                serverVersion: Number(data?.meta?.serverVersion || 0),
                data: data || {}
            })
        );
    } catch (error) {
        console.warn("Cache navigateur Dashboard non enregistré :", error);
    }
}

function existeModificationDashboardEnAttente() {
    const signal = lireSignalDashboard();
    if (!signal || !signal.timestamp) return false;
    return Number(signal.timestamp) > lireDernierSignalDashboardTraite();
}

function afficherDashboardCharge() {
    afficherKPIPrincipaux();
    afficherKPISecondaires();
    afficherGraphiqueRevenus();
    afficherGraphiqueVentes();
    afficherNotificationsDashboard();
}

function restaurerDashboardDepuisCacheNavigateur() {
    const cache = lireCacheNavigateurDashboard();
    if (!cache) return false;

    dashboardCharge = cache.data || {};
    dashboardCharge.meta = dashboardCharge.meta || {};
    if (!dashboardCharge.meta.serverVersion && cache.serverVersion) {
        dashboardCharge.meta.serverVersion = Number(cache.serverVersion || 0);
    }
    afficherDashboardCharge();
    return true;
}

function masquerChargementDashboardImmediatement() {
    const loader = document.getElementById("dashboard-loader");
    if (!loader) return;

    if (dashboardLoaderTimer) {
        clearInterval(dashboardLoaderTimer);
        dashboardLoaderTimer = null;
    }

    loader.classList.add("is-hidden");
    loader.setAttribute("aria-busy", "false");
}

async function lireVersionDashboardServeur() {
    try {
        const resultat = await apiGet("getDashboardVersion", {
            _versionCheck: Date.now()
        });

        if (!resultat || resultat.success === false) return null;

        return {
            dirtyVersion: Number(resultat.data?.dirtyVersion || 0),
            cacheVersion: Number(resultat.data?.cacheVersion || 0)
        };
    } catch (error) {
        console.warn("Version serveur Dashboard indisponible :", error);
        return null;
    }
}

function obtenirVersionServeurDashboardLocal() {
    return Number(dashboardCharge?.meta?.serverVersion || 0);
}

async function synchroniserDashboardAvecServeur(forcer = false) {
    if (dashboardVerificationServeurEnCours) return;

    const maintenant = Date.now();
    if (
        !forcer &&
        maintenant - dashboardDerniereVerificationServeur <
            DASHBOARD_VERSION_CHECK_INTERVAL_MS
    ) {
        return;
    }

    dashboardVerificationServeurEnCours = true;
    dashboardDerniereVerificationServeur = maintenant;

    try {
        const versionServeur = await lireVersionDashboardServeur();
        if (!versionServeur) return;

        const versionLocale = obtenirVersionServeurDashboardLocal();
        const versionReference = Math.max(
            versionServeur.dirtyVersion,
            versionServeur.cacheVersion
        );

        // Cache local déjà aligné avec le serveur.
        if (versionLocale && versionLocale >= versionReference) {
            return;
        }

        // Un autre appareil a modifié les données, ou ce cache navigateur
        // n'a pas encore de version serveur : on récupère la version fraîche.
        afficherChargementDashboard();

        try {
            const resultat = await apiGet("getDashboard", {
                _multiDeviceSync: Date.now()
            });

            if (!resultat || resultat.success === false) {
                throw new Error(
                    resultat?.message ||
                    "Impossible de synchroniser le Dashboard."
                );
            }

            const data = resultat.data || {};
            const versionApres = await lireVersionDashboardServeur();

            data.meta = data.meta || {};
            data.meta.serverVersion = Number(
                versionApres?.cacheVersion ||
                versionApres?.dirtyVersion ||
                versionReference ||
                0
            );

            dashboardCharge = data;
            afficherDashboardCharge();
            enregistrerCacheNavigateurDashboard(dashboardCharge);
        } finally {
            masquerChargementDashboard();
        }
    } finally {
        dashboardVerificationServeurEnCours = false;
    }
}

function lireSignalDashboard() {
    try {
        return JSON.parse(
            localStorage.getItem(DASHBOARD_SIGNAL_KEY) || "null"
        );
    } catch (error) {
        return null;
    }
}

function lireDernierSignalDashboardTraite() {
    return Number(
        localStorage.getItem(DASHBOARD_SIGNAL_TRAITE_KEY) || 0
    );
}

function marquerSignalDashboardTraite(timestamp) {
    try {
        localStorage.setItem(
            DASHBOARD_SIGNAL_TRAITE_KEY,
            String(timestamp || Date.now())
        );
    } catch (error) {
        console.warn("Signal Dashboard non marqué comme traité :", error);
    }
}

function obtenirVersionDashboard() {
    return String(
        dashboardCharge?.meta?.actualiseLe || ""
    );
}

/**
 * Convertit "dd/MM/yyyy HH:mm:ss" en timestamp navigateur.
 * Le backend utilise déjà ce format dans meta.actualiseLe.
 */
function convertirVersionDashboardEnTimestamp(version) {
    const texte = String(version || "").trim();
    const correspondance = texte.match(
        /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
    );

    if (!correspondance) return 0;

    const jour = Number(correspondance[1]);
    const mois = Number(correspondance[2]) - 1;
    const annee = Number(correspondance[3]);
    const heure = Number(correspondance[4]);
    const minute = Number(correspondance[5]);
    const seconde = Number(correspondance[6]);

    const date = new Date(
        annee,
        mois,
        jour,
        heure,
        minute,
        seconde
    );

    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Dit si le cache actuellement chargé a été généré après l'action métier.
 * Une tolérance de 2 secondes évite les faux négatifs liés à l'arrondi
 * de meta.actualiseLe à la seconde.
 */
function cacheDashboardEstPosterieurAuSignal(signal) {
    if (!signal || !signal.timestamp) return false;

    const versionTimestamp =
        convertirVersionDashboardEnTimestamp(
            obtenirVersionDashboard()
        );

    if (!versionTimestamp) return false;

    return versionTimestamp >= Number(signal.timestamp) - 2000;
}

function arreterVerificationDashboard() {
    if (dashboardVerificationTimer) {
        clearInterval(dashboardVerificationTimer);
        dashboardVerificationTimer = null;
    }
}

function demarrerVerificationDashboardSiNecessaire(forcer = false) {
    const signal = lireSignalDashboard();

    if (!signal || !signal.timestamp) return;

    if (
        !forcer &&
        signal.timestamp <= lireDernierSignalDashboardTraite()
    ) {
        return;
    }

    // Si le premier chargement de la page a déjà récupéré le cache produit
    // après l'action, inutile de continuer à interroger le backend.
    if (cacheDashboardEstPosterieurAuSignal(signal)) {
        marquerSignalDashboardTraite(signal.timestamp);
        arreterVerificationDashboard();
        return;
    }

    if (dashboardVerificationTimer) {
        return;
    }

    const debut = Date.now();
    let verificationEnCours = false;

    const verifier = async function() {
        if (verificationEnCours) return;
        verificationEnCours = true;

        try {
            await chargerDashboard(true);

            if (cacheDashboardEstPosterieurAuSignal(signal)) {
                marquerSignalDashboardTraite(signal.timestamp);
                arreterVerificationDashboard();
                console.log(
                    "Dashboard actualisé automatiquement après :",
                    signal.action
                );
                return;
            }

            if (Date.now() - debut >= DASHBOARD_POLL_MAX_MS) {
                arreterVerificationDashboard();
                console.warn(
                    "Le nouveau cache Dashboard n'est pas encore disponible après 120 secondes."
                );
            }
        } finally {
            verificationEnCours = false;
        }
    };

    // Première vérification immédiate, puis toutes les 3 secondes.
    verifier();
    dashboardVerificationTimer = window.setInterval(
        verifier,
        DASHBOARD_POLL_MS
    );
}

/* ===========================================================
   ÉTAT VISUEL DE CHARGEMENT
=========================================================== */

let dashboardLoaderTimer = null;
let dashboardLoaderProgression = 8;

function afficherChargementDashboard() {
    const loader = document.getElementById("dashboard-loader");
    if (!loader) return;

    const barre = document.getElementById("dashboard-loader-progress-bar");
    const texte = document.getElementById("dashboard-loader-progress-text");

    loader.classList.remove("is-hidden");
    loader.setAttribute("aria-busy", "true");

    dashboardLoaderProgression = 8;
    if (barre) barre.style.width = `${dashboardLoaderProgression}%`;
    if (texte) texte.textContent = `${dashboardLoaderProgression}%`;

    if (dashboardLoaderTimer) {
        clearInterval(dashboardLoaderTimer);
    }

    dashboardLoaderTimer = window.setInterval(function() {
        if (dashboardLoaderProgression >= 88) return;

        const reste = 88 - dashboardLoaderProgression;
        const increment = Math.max(1, Math.ceil(reste * 0.12));
        dashboardLoaderProgression = Math.min(88, dashboardLoaderProgression + increment);

        if (barre) barre.style.width = `${dashboardLoaderProgression}%`;
        if (texte) texte.textContent = `${dashboardLoaderProgression}%`;
    }, 450);
}

function masquerChargementDashboard() {
    const loader = document.getElementById("dashboard-loader");
    if (!loader) return;

    const barre = document.getElementById("dashboard-loader-progress-bar");
    const texte = document.getElementById("dashboard-loader-progress-text");

    if (dashboardLoaderTimer) {
        clearInterval(dashboardLoaderTimer);
        dashboardLoaderTimer = null;
    }

    dashboardLoaderProgression = 100;
    if (barre) barre.style.width = "100%";
    if (texte) texte.textContent = "100%";

    window.setTimeout(function() {
        loader.classList.add("is-hidden");
        loader.setAttribute("aria-busy", "false");
    }, 260);
}

/* ===========================================================
   CHARGEMENT
=========================================================== */

async function chargerDashboard(forcerFraicheur = false, forcerLoader = false) {
    const afficherLoader =
        !forcerFraicheur &&
        (forcerLoader || !dashboardCharge);

    if (afficherLoader) {
        afficherChargementDashboard();
    }

    try {
        const resultat =
            await apiGet(
                "getDashboard",
                forcerFraicheur
                    ? { _dashboardPoll: Date.now() }
                    : {}
            );

        if (
            !resultat ||
            resultat.success === false
        ) {
            throw new Error(
                resultat?.message ||
                "Impossible de charger le Dashboard."
            );
        }

        dashboardCharge =
            resultat.data || {};

        // Mémorise la version commune du serveur avec les données locales.
        // Cela permet aux autres ouvertures de comparer sans recharger inutilement.
        try {
            const versionServeur = await lireVersionDashboardServeur();
            dashboardCharge.meta = dashboardCharge.meta || {};
            dashboardCharge.meta.serverVersion = Number(
                versionServeur?.cacheVersion ||
                versionServeur?.dirtyVersion ||
                dashboardCharge.meta.serverVersion ||
                0
            );
        } catch (error) {}

        afficherDashboardCharge();
        enregistrerCacheNavigateurDashboard(dashboardCharge);

    } catch (error) {
        console.error(
            "Erreur chargement Dashboard :",
            error
        );
    } finally {
        if (afficherLoader) {
            masquerChargementDashboard();
        }
    }
}


/* ===========================================================
   KPI
=========================================================== */

function afficherKPIPrincipaux() {
    const kpi =
        dashboardCharge?.kpi || {};

    mettreAJourCarte(
        "revenus",
        kpi.revenus?.valeur || 0,
        " FCFA",
        texteEvolutionDashboard(
            kpi.revenus?.actuel || 0,
            kpi.revenus?.precedent || 0,
            "ce mois"
        )
    );

    mettreAJourCarte(
        "commandes",
        kpi.commandes?.valeur || 0,
        "",
        texteEvolutionDashboard(
            kpi.commandes?.actuel || 0,
            kpi.commandes?.precedent || 0,
            "ce mois"
        )
    );

    const produits =
        kpi.produits || {};

    mettreAJourCarte(
        "produits",
        produits.valeur || 0,
        "",
        `${formatNombre(produits.stocksFaibles || 0)} stock(s) faible(s) • ${formatNombre(produits.ruptures || 0)} rupture(s)`,
        (
            (produits.stocksFaibles || 0) > 0 ||
            (produits.ruptures || 0) > 0
        )
            ? "down"
            : "up"
    );

    mettreAJourCarte(
        "clients",
        kpi.clients?.valeur || 0,
        "",
        texteEvolutionDashboard(
            kpi.clients?.actuel || 0,
            kpi.clients?.precedent || 0,
            "ce mois"
        )
    );
}


function afficherKPISecondaires() {
    const kpi =
        dashboardCharge?.kpi || {};

    mettreAJourCarte(
        "conversion",
        kpi.conversion?.valeur || 0,
        "%",
        `${formatNombre(kpi.conversion?.converties || 0)} commande(s) convertie(s) sur ${formatNombre(kpi.conversion?.total || 0)}`,
        "up"
    );

    mettreAJourCarte(
        "livraisons",
        kpi.livraisons?.valeur || 0,
        "",
        `${formatNombre(kpi.livraisons?.terminees || 0)} livraison(s) terminée(s)`,
        "up"
    );

    mettreAJourCarte(
        "paiements",
        kpi.paiements?.valeur || 0,
        " FCFA",
        texteEvolutionDashboard(
            kpi.paiements?.actuel || 0,
            kpi.paiements?.precedent || 0,
            "ce mois"
        )
    );

    mettreAJourCarte(
        "factures",
        kpi.factures?.valeur || 0,
        "",
        texteEvolutionDashboard(
            kpi.factures?.actuel || 0,
            kpi.factures?.precedent || 0,
            "ce mois"
        )
    );
}


/* ===========================================================
   GRAPHIQUES
=========================================================== */

function afficherGraphiqueRevenus() {
    const canvas =
        document.getElementById(
            "revenus-chart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    const complet =
        dashboardCharge
            ?.graphiques
            ?.revenus || {
                labels: [],
                valeurs: []
            };

    const nombreMois =
        Math.max(
            1,
            Number(
                document
                    .getElementById(
                        "periode-revenus"
                    )
                    ?.value ||
                6
            )
        );

    const labels =
        complet.labels.slice(
            -nombreMois
        );

    const valeurs =
        complet.valeurs.slice(
            -nombreMois
        );

    graphiqueRevenusDashboard?.destroy();

    graphiqueRevenusDashboard =
        new Chart(
            canvas,
            {
                type: "line",
                data: {
                    labels:
                        labels,
                    datasets: [
                        {
                            label:
                                "Revenus nets",
                            data:
                                valeurs,
                            borderWidth:
                                3,
                            tension:
                                0.35,
                            fill:
                                true
                        }
                    ]
                },
                options: {
                    responsive:
                        true,
                    maintainAspectRatio:
                        false,
                    plugins: {
                        legend: {
                            display:
                                false
                        },
                        tooltip: {
                            callbacks: {
                                label:
                                    function(context) {
                                        return (
                                            formatNombre(
                                                context.raw
                                            ) +
                                            " FCFA"
                                        );
                                    }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero:
                                true,
                            ticks: {
                                callback:
                                    function(value) {
                                        return (
                                            formatNombre(
                                                value
                                            ) +
                                            " FCFA"
                                        );
                                    }
                            }
                        }
                    }
                }
            }
        );
}


function afficherGraphiqueVentes() {
    const canvas =
        document.getElementById(
            "ventes-chart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    const repartition =
        dashboardCharge
            ?.graphiques
            ?.ventes || {
                labels: [],
                valeurs: []
            };

    const labels =
        repartition.labels.length
            ? repartition.labels
            : ["Aucune vente"];

    const valeurs =
        repartition.valeurs.length
            ? repartition.valeurs
            : [0];

    const carte =
        canvas.closest(
            ".chart-card"
        );

    const sousTitre =
        carte?.querySelector(
            ".chart-header p"
        );

    if (sousTitre) {
        sousTitre.textContent =
            "Montant des ventes par mode de paiement";
    }

    graphiqueVentesDashboard?.destroy();

    graphiqueVentesDashboard =
        new Chart(
            canvas,
            {
                type: "doughnut",
                data: {
                    labels:
                        labels,
                    datasets: [
                        {
                            label:
                                "Montant des ventes",
                            data:
                                valeurs,
                            borderWidth:
                                2
                        }
                    ]
                },
                options: {
                    responsive:
                        true,
                    maintainAspectRatio:
                        false,
                    cutout:
                        "65%",
                    plugins: {
                        legend: {
                            display:
                                true,
                            position:
                                "bottom",
                            labels: {
                                usePointStyle:
                                    true,
                                padding:
                                    15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label:
                                    function(context) {
                                        const valeur =
                                            nombreDashboard(
                                                context.raw
                                            );

                                        const total =
                                            context.dataset.data.reduce(
                                                function(somme, nombre) {
                                                    return (
                                                        somme +
                                                        nombreDashboard(
                                                            nombre
                                                        )
                                                    );
                                                },
                                                0
                                            );

                                        const pourcentage =
                                            total > 0
                                                ? (
                                                    valeur /
                                                    total *
                                                    100
                                                  ).toFixed(1)
                                                : "0.0";

                                        return (
                                            context.label +
                                            " : " +
                                            formatNombre(
                                                valeur
                                            ) +
                                            " FCFA (" +
                                            pourcentage +
                                            " %)"
                                        );
                                    }
                            }
                        }
                    }
                }
            }
        );
}


/* ===========================================================
   NOTIFICATIONS
=========================================================== */

function afficherNotificationsDashboard() {
    const panneau =
        document.getElementById(
            "notification-panel"
        );

    const badge =
        document.querySelector(
            ".notification-badge"
        );

    if (!panneau) {
        return;
    }

    const notifications =
        Array.isArray(
            dashboardCharge?.notifications
        )
            ? dashboardCharge.notifications
            : [];

    panneau.innerHTML = `
        <div class="notification-panel-header">
            <h3>Notifications</h3>
        </div>
        ${
            notifications.length
                ? notifications
                    .map(
                        function(n) {
                            return `
                                <div class="notification-item">
                                    <span class="notification-item-icon">${n.icone || "ℹ️"}</span>
                                    <div>
                                        <strong>${echapperHTMLDashboard(n.titre || "")}</strong>
                                        <p>${echapperHTMLDashboard(n.texte || "")}</p>
                                        <small>Données actuelles</small>
                                    </div>
                                </div>
                            `;
                        }
                    )
                    .join("")
                : `
                    <div class="notification-item">
                        <span class="notification-item-icon">✅</span>
                        <div>
                            <strong>Aucune alerte</strong>
                            <p>Aucune information urgente à signaler.</p>
                            <small>Données actuelles</small>
                        </div>
                    </div>
                `
        }
    `;

    if (badge) {
        badge.textContent =
            String(
                notifications.length
            );

        badge.hidden =
            notifications.length === 0;
    }
}


/* ===========================================================
   CARTES
=========================================================== */

function mettreAJourCarte(
    nom,
    valeur,
    unite,
    texteTendance,
    classeForcee
) {
    const valeurElement =
        document.getElementById(
            `${nom}-value`
        );

    const tendanceElement =
        document.getElementById(
            `${nom}-trend`
        );

    if (valeurElement) {
        valeurElement.textContent =
            `${formatNombre(valeur)}${unite || ""}`;
    }

    if (!tendanceElement) {
        return;
    }

    tendanceElement.textContent =
        texteTendance || "";

    const classe =
        classeForcee ||
        (
            String(
                texteTendance || ""
            ).includes("↓")
                ? "down"
                : "up"
        );

    tendanceElement.classList.remove(
        "up",
        "down"
    );

    tendanceElement.classList.add(
        classe
    );
}


/* ===========================================================
   UTILISATEUR / DÉCONNEXION
=========================================================== */

function afficherInformationsUtilisateur(
    utilisateur
) {
    const userNameElement =
        document.getElementById(
            "user-name"
        );

    const userRoleElement =
        document.getElementById(
            "user-role"
        );

    if (!utilisateur) {
        return;
    }

    const nomComplet =
        utilisateur.nomComplet ||
        utilisateur.nom ||
        utilisateur.email ||
        "Utilisateur";

    const role =
        utilisateur.role ||
        "Utilisateur";

    if (userNameElement) {
        userNameElement.textContent =
            nomComplet;
    }

    if (userRoleElement) {
        userRoleElement.textContent =
            role;
    }
}


function initialiserDeconnexion() {
    const logoutButton =
        document.getElementById(
            "logout-button"
        );

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        function(event) {
            event.preventDefault();

            if (
                typeof logoutUser ===
                "function"
            ) {
                logoutUser();
            }
        }
    );
}


/* ===========================================================
   OUTILS
=========================================================== */

function formatNombre(nombre) {
    return new Intl.NumberFormat(
        "fr-FR",
        {
            maximumFractionDigits:
                1
        }
    ).format(
        nombreDashboard(
            nombre
        )
    );
}


function nombreDashboard(valeur) {
    if (
        typeof valeur === "number"
    ) {
        return Number.isFinite(valeur)
            ? valeur
            : 0;
    }

    const n =
        Number(
            String(
                valeur ?? ""
            )
                .replace(/\s/g, "")
                .replace(",", ".")
                .replace(/[^\d.-]/g, "")
        );

    return Number.isFinite(n)
        ? n
        : 0;
}


function arrondirDashboard(
    valeur,
    decimales
) {
    const puissance =
        Math.pow(
            10,
            decimales || 0
        );

    return Math.round(
        nombreDashboard(
            valeur
        ) *
        puissance
    ) /
    puissance;
}


function texteEvolutionDashboard(
    actuel,
    precedent,
    suffixe
) {
    actuel =
        nombreDashboard(
            actuel
        );

    precedent =
        nombreDashboard(
            precedent
        );

    if (
        precedent === 0
    ) {
        if (
            actuel === 0
        ) {
            return (
                "Aucun mouvement " +
                (suffixe || "")
            );
        }

        return (
            "↑ Activité démarrée " +
            (suffixe || "")
        );
    }

    const evolution =
        (
            (
                actuel -
                precedent
            ) /
            Math.abs(
                precedent
            )
        ) *
        100;

    const signe =
        evolution >= 0
            ? "↑ +"
            : "↓ ";

    return (
        signe +
        arrondirDashboard(
            evolution,
            1
        ) +
        "% " +
        (suffixe || "")
    );
}


function echapperHTMLDashboard(valeur) {
    return String(
        valeur ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
