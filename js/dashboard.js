/* ===========================================================
   VISIBL ERP — dashboard.js
   Frontend léger : une seule source backend getDashboard()
=========================================================== */

let graphiqueRevenusDashboard = null;
let graphiqueVentesDashboard = null;
let dashboardCharge = null;

const DASHBOARD_REFRESH_MS = 60000;


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

    await chargerDashboard();

    window.setInterval(
        chargerDashboard,
        DASHBOARD_REFRESH_MS
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
   CHARGEMENT
=========================================================== */

async function chargerDashboard() {
    try {
        const resultat =
            await apiGet(
                "getDashboard"
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

        afficherKPIPrincipaux();
        afficherKPISecondaires();
        afficherGraphiqueRevenus();
        afficherGraphiqueVentes();
        afficherNotificationsDashboard();

    } catch (error) {
        console.error(
            "Erreur chargement Dashboard :",
            error
        );
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
